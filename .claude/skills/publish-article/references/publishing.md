# 公開手順

**順番に意味がある。** 特に守るべき順序は2つ。

1. **画像が確定してから、初めてどこかに公開する。** ブログもZennもXも例外なし。次項の理由による
2. **ブログを最初に公開する。** Zennより先でないと検索エンジンにどちらが原典か示せない。
   そしてXのCTAリンクが404になる

前提: `.env` に X の認証情報4つが入っている。無い場合はその時点で止めてユーザーに伝える。

## ヒーロー画像を、公開より前に確定させる

以前は「ブログとZennは画像なしで公開してよく、Xの手前だけで待つ」運用だったが、
**やめた。** 画像が無いまま一部だけ公開すると、公開状態がプラットフォームごとに
バラバラになり、どこまで済んでいるかの管理コストが上がる。今は**1本の記事のうち
どれか1つでも公開する前に、画像を確定させる**。

**Xはリンクカードを投稿した瞬間に画像をキャッシュする。** 後から画像を追加しても、
すでに投稿済みのカードには**遡って反映されない**。貼り直す以外に直す方法がない。
この非対称性（ブログ・Zennは後から直せる、Xは直せない）が、画像を最優先に置く理由。

## ⑥ Obsidian の `公開済み` へ移す

記事のマスターは Obsidian。まず `下書き` から `公開済み` へ移動する。

```bash
V="/Users/yuki/Library/Mobile Documents/iCloud~md~obsidian/Documents/YukiKawabata /個人"
mv "$V/発信/記事/下書き/<basename>.md" "$V/発信/記事/公開済み/"
```

## ⑥.5 ヒーロー画像を生成する（すべての公開の前に、ここで完結させる）

```bash
npm run generate:hero -- --slug <basename> --theme "<記事のテーマを1〜2文で>"
```

`GEMINI_API_KEY` があれば、Gemini API（gemini-3.1-flash-image）で自動生成し、
`public/images/hero/<basename>.webp` に保存する。1本につきAPI呼び出しは1回だけ。
失敗しても自動リトライしない（コストが不必要に膨らむため）。

**この画像生成APIは実際のキーでまだ検証できていない。** 初回実行時にエラーが出た場合は、
エラーメッセージ（レスポンスの生JSON）をそのままユーザーに見せて、スクリプト側の
レスポンス解析（`scripts/generate-hero-image.mjs` の `extractImageBase64`）を直す。
黙って手動生成にフォールバックしない — 直せる不具合を放置したまま次の記事に進まない。

**次のいずれかに該当したら、生成をスキップして手動を待つ。**

- `.env` に `GEMINI_API_KEY` が無い
- API呼び出しが2回連続でエラーになった（1回の再試行は許容、2回目で止める）
- 生成された画像が明らかに記事のテーマと無関係（例: セキュリティ記事なのに無関係な風景）

手動待ちに切り替えた場合は、「画像を `public/images/hero/<basename>.webp` に
置いてください。置いたら公開します」と伝えて止まる。**ここで止まるのは待つ価値が
あるからで、承認を求めているわけではない。**

画像が確定したら（自動生成でも手動でも）、次に進む前に必ずローカルで確認する。

```bash
ls -la public/images/hero/<basename>.webp
file public/images/hero/<basename>.webp
```

拡張子は frontmatter の `heroImage` と一致させる。違うならどちらかを合わせる。

## ⑦ ブログへ同期して公開する

最初にブログ。理由は2つ。

- Zenn より先に公開しないと、検索エンジンにどちらが原典か示せない
- X の CTA リンクの飛び先が404になる

```bash
npm run sync:obsidian
git status --short src/content/blog/
```

`sync:obsidian` は `rsync --delete` なので、**新規1本だけが差分に出ることを必ず確認する。**
他の記事が消える差分が出たら、Obsidian 側が欠けている。止めて報告する。

```bash
npm run build
```

ビルドが通ることを確認してからコミットする。

```bash
git add -A && git commit -m "feat: <記事タイトル>を公開" && git push origin main
```

## ⑧ デプロイ完了を待つ

Vercel のデプロイは1〜3分かかる。**200が返るまで待つ。**

```bash
URL="https://dev-blog-pi-six.vercel.app/blog/<basename>/"
for i in $(seq 1 20); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -L "$URL?cb=$(date +%s)")
  echo "[$i] $CODE"
  [ "$CODE" = "200" ] && break
  sleep 20
done
```

**404 のまま5分以上経つ場合**、デプロイが起動していない可能性がある。過去に実際にあった原因:

- GitHub App（Vercel）の権限更新が承認待ちだった。承認しても過去のpushは遡って処理されないので、**空コミットを1つ push すると起動する**
- Vercel のデプロイ一覧に対象コミットが「キューにも失敗にも出ていない」ならこれ

```bash
git commit --allow-empty -m "chore: trigger deployment" && git push origin main
```

デプロイ後、画像とOGPも確認する（⑥.5で画像は既に確定しているはずなので、ここは反映確認）。

```bash
curl -s -L "$URL" | grep -oE 'property="og:image" content="[^"]*"'
curl -s -o /dev/null -w "%{http_code}\n" -L "https://dev-blog-pi-six.vercel.app/images/hero/<画像名>"
```

## ⑨ Zenn へ配信

```bash
npm run sync:zenn
cd ../zenn-articles && git status --short
```

**新規記事1本だけが差分に出ることを確認する。** 他の記事に差分が出ていたら、意図しない再生成なので止めて報告する。
`.DS_Store` はコミットしない。

```bash
cd ../zenn-articles && git add articles/<slug>.md && git commit -m "feat: <タイトル>を追加" && git push origin main
```

## ⑩ X へ配信

画像は⑥.5で既に確定しているので、ここでの確認は「デプロイが本当に反映されたか」だけ。
**この2つが両方200であることを確認してから投稿する。** 片方でも404なら投稿しない。

```bash
BASE="https://dev-blog-pi-six.vercel.app"
curl -s -o /dev/null -w "記事: %{http_code}\n" -L "$BASE/blog/<basename>/"
curl -s -o /dev/null -w "画像: %{http_code}\n" -L "$BASE/images/hero/<画像ファイル名>"
```

記事が404ならCTAリンクが死ぬ。画像が404ならリンクカードが画像なしで固定される。
**どちらも投稿後に直せない。**

```bash
node scripts/sync-x.mjs --publish --thread --only <slug>
```

`article_enabled: false` の場合はスレッドのみ投稿される（Articleの下書きも作られない）。

### 確認は必ずブラウザで

**curl で x.com を叩いて200を見ても意味がない。** SPAなので存在しないURLでも200を返す。

ブラウザツールで確認する:

- プロフィール `https://x.com/Yuki_K25` の「ポスト」タブ → スレッドが並んでいるか
- 「記事」タブ → Article を出した場合、そこに出る（ポストのタイムラインには**流れない**）

## ⑪ note へ配信（`note:` がある場合のみ）

note には公式の投稿APIがない。**ブラウザ操作で投稿する。**

```bash
npm run sync:note -- --only <slug>
```

`.note/<slug>.json` に `title` と `body` が入る。これをブラウザで note のエディタに流し込む。

1. `https://note.com/notes/new` を開く
2. タイトル欄に `title` を入力
3. 本文欄に `body` を入力
4. **入力後、必ずスクリーンショットで見た目を確認する。** note のエディタは Markdown を解釈しないので、記号が残っていないか、改行が潰れていないかを見る
5. 問題なければ公開する

崩れていたら公開せずに報告する。note は貼り直しが効くので、慌てて公開しない。

## ⑫ state.json をコミットする

**忘れると次回に二重投稿する。** `.x/state.json` には article_id・post_id・本文ハッシュが入っており、
これが無いと「未投稿」と判定されて記事もスレッドも再投稿される。

```bash
git add .x/state.json && git commit -m "chore: update X sync state" && git push origin main
```

## 完了報告

以下を表で報告する。推測ではなく、実際に確認した結果を書く。

| 媒体 | 状態 | URL |
| ---- | ---- | --- |

失敗した工程があれば、成功したものと分けて明示する。「たぶん大丈夫」と書かない。

## コスト

X API は従量課金。

- ポスト作成 $0.015/件、**URLを含むポストは $0.20/件**
- スレッドは最終投稿だけURLを含む設計なので、4投稿で約 $0.25
- Articles の単価は非公開

画像生成（Gemini API, gemini-3.1-flash-image）は1枚あたり約$0.045。
1記事1回、失敗しても自動リトライしないので、想定外の多重課金は起きない設計。
