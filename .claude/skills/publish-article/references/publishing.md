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

## ⑥ ブログへ配置する

公開済み記事の正本は `src/content/blog/`。点検が通った下書きを `hasshin` から移す（`$H` は `references/persona.md` を参照）。

```bash
cp "$H/articles/下書き/<basename>.md" src/content/blog/
git -C "$H" rm -q "articles/下書き/<basename>.md"
git -C "$H" commit -m "articles: <basename> を dev-blog へ移して公開" && git -C "$H" push
```

## ⑥.5 ヒーロー画像を生成する（すべての公開の前に、ここで完結させる）

```bash
npm run generate:hero -- --slug <basename> --theme "<記事のテーマを1〜2文で>"
```

`OPENAI_API_KEY` があれば OpenAI（gpt-image-1.5, medium品質）で自動生成し、
`public/images/hero/<basename>.webp` に保存する。

**スタイルはスクリプト（`STYLE_GUIDE`）に固定してある。** ブログのデザイン（`tailwind.config.cjs`・
`public/og-yuki-kawabata.png`）に合わせた、無地のオフホワイト背景・墨色の線と単純な図形・
オレンジ（#DD5A35）を1点だけ・余白の多いフラットなイラスト。`--theme` で色や画風を指定しない。
`--theme` には、記事を象徴する**身近な物を1〜2個、具体的に**書く。抽象語（「成長」「AI」）だけだと
ありがちな図になる。文字・看板・ロゴは頼まない（生成モデルは文字を崩す）。

- 良い例: `無地の本が並ぶ本棚で、2冊だけ少し前に出ている。横に右肩上がりの棒グラフ`
- 悪い例: `ASOで成長したアプリ`（抽象的）、`App Storeのロゴと「ASO」の文字`（文字・ロゴ）1本につきAPI呼び出しは1回だけ。
失敗しても自動リトライしない（コストが不必要に膨らむため）。実測で動作確認済み。

Gemini を使いたい場合は `--provider gemini` を付ける（`GEMINI_API_KEY` が必要）。
Gemini 側は Google AI Studio の**課金ページで前払いクレジット購入**（最低$10）が要る。
カードを登録しただけでは quota=0 のまま動かない。

**次のいずれかに該当したら、生成をスキップして手動を待つ。**

- 使うプロバイダのAPIキーが `.env` に無い
- API呼び出しが2回連続でエラーになった（1回の再試行は許容、2回目で止める）
- 生成された画像が明らかに記事のテーマと無関係（例: セキュリティ記事なのに無関係な風景）
- 画像に文字・数字・ロゴが描かれている、または暗い背景・グラデーション・光の演出など
  ブログのデザインから明らかに外れている（この2つに当たったときは、`--theme` を具体的にして
  `--force` で1回だけ作り直してよい。2回目も外れたら手動待ちに切り替える）

手動待ちに切り替えた場合は、「画像を `public/images/hero/<basename>.webp` に
置いてください。置いたら公開します」と伝えて止まる。**ここで止まるのは待つ価値が
あるからで、承認を求めているわけではない。**

画像が確定したら（自動生成でも手動でも）、次に進む前に必ずローカルで確認する。
**ファイルの存在だけでなく、画像そのものを開いて目で見る**（webpはそのまま読めないので
`sips -s format png` でPNGにしてから Read で見る）。

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
git status --short src/content/blog/
```

**新規1本だけが差分に出ることを必ず確認する。** 他の記事に差分が出ていたら、止めて報告する。

```bash
npm run build
```

ビルドが通ることを確認してからコミットする。**`git add -A` は使わない。** 別の作業の変更が
手元に残っていることがあり（2026-10-12 に `package.json` などが混ざりかけた）、記事に関係するファイルだけを足す。

```bash
git add src/content/blog/<basename>.md public/images/hero/<basename>.webp public/images/articles/<basename>
git commit -m "feat: <記事タイトル>を公開" && git push origin main
```

push が non-fast-forward で拒否されたら、`git fetch` してリモートの新しいコミットを確認し、
`git rebase origin/main` で載せ直す。載せ直したら**もう一度ビルドする**（依存パッケージが増えていたら
`npm install` が必要。`publish-from-draft` から来た場合は、依存の変更はユーザーに確認してから）。

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

**新規記事1本（と、その本文画像）だけが差分に出ることを確認する。** 他の記事に差分が出ていたら、意図しない再生成なので止めて報告する。
`.DS_Store` はコミットしない。

`sync:zenn` は次の2つを自動でやる（2026-10-14〜）。

- 本文が参照している `/images/articles/<basename>/` を、`zenn-articles/images/articles/<basename>/` に同じパスでコピーする（Zennが取り込む）
- 末尾の「この記事は個人ブログにも掲載しています」のリンクに、`pubDate` が 2026-10-14 以降の記事だけUTMを付ける。
  それより前の記事は書き換えない（まとめて変わると、Zennの直近24時間の投稿数上限で新規記事ごと止まるため）

```bash
cd ../zenn-articles && git add articles/<slug>.md images/articles/<basename> && git commit -m "feat: <タイトル>を追加" && git push origin main
```

push後、Zennの記事URLを**ブラウザで開いて、本文と画像が表示されるか**を確認する。
存在確認は curl で `"likedCount":` が返るかを見る（存在しないslugでも200が返るので、ステータスコードは当てにしない）。

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

`article_enabled: false` の場合は告知の投稿だけが出る（Articleの下書きも作られない）。
`--thread` は `x.thread` の配列をそのまま投稿するオプション。要素が1つなら単体の投稿になる。

### 確認は必ずブラウザで

**curl で x.com を叩いて200を見ても意味がない。** SPAなので存在しないURLでも200を返す。

ブラウザツールで確認する:

- 投稿URL（`https://x.com/Yuki_K25/status/<threadRootId>`）を開き、本文とリンクカードの画像が出ているか
- 「記事」タブ → Article を出した場合、そこに出る（ポストのタイムラインには**流れない**）

## ⑪ note へ配信（`note:` がある場合のみ）

note には公式の投稿APIがない。**ブラウザ（Claude in Chrome）で note のエディタを操作して投稿する。**

```bash
npm run sync:note -- --only <slug>
```

`.note/<slug>.json` に次のものが入る。画像は `.note/<slug>/` に note が受け付けるJPGで書き出される。

| キー | 中身 |
| --- | --- |
| `title` | タイトル |
| `hero` | 見出し画像（`.note/<slug>/hero.jpg`） |
| `blocks` | 本文を読む順に並べた配列。`{type:"text", text}` と `{type:"image", file, alt}` が交互に並ぶ |
| `body` | 画像を除いた本文だけ（画像を入れない場合の予備） |

### 手順

1. `https://note.com/notes/new` を開き、タイトル欄に `title` を入力する
2. **本文のテキストを先にすべて入れる。** 本文欄にカーソルを置き、`blocks` のテキストを順に入れる。
   長文は `type` より、本文欄（`.ProseMirror`）に `DataTransfer` を使った `paste` イベントを
   `javascript_tool` で送る方が速く確実。ブロックの間は Enter で段落を分ける
3. **画像はあとから入れる。** 画像を入れたい段落（`blocks` で画像の直前にあるテキストの最後の段落）の
   末尾にカーソルを置き、左の「＋（メニューを開く）」→「画像」で挿入する。画像はその段落の**直後**に入る
   - 「画像」を押すとOSのファイル選択ダイアログが開いてしまうので、先に `javascript_tool` で
     `HTMLInputElement.prototype.click` を差し替え、`type="file"` の input を `document.body` に
     つなぐだけにしておく。その input を `find` で探し、`file_upload` で `.note/<slug>/NN-*.jpg` を渡す
   - 挿入後、画像の下のキャプション欄（`figcaption`）にカーソルを置いて、短いキャプションを入力してよい。
     **キャプション欄で Enter や Backspace を押さない**（画像ごと消える）
4. 見出し画像は、タイトル上の「画像を追加」→「画像をアップロード」で `hero` を同じ方法でアップロードし、
   トリミング画面で「保存」を押す
5. **入力後、必ずスクリーンショットで見た目を確認する。** 記号の残り、改行の潰れ、画像の数（`blocks` の
   画像の数＋見出し画像1枚）、画像の位置を見る。`document.querySelectorAll('figure').length` でも数を確かめる
6. 問題なければ「公開に進む」→ ハッシュタグを確認 →「投稿する」

### 過去に起きたこと

- **画像を本文の末尾に入れると、その後ろに段落を作れない。** カーソルを下に移そうとして Backspace を
  押したら画像ごと消えた（2026-10-12）。だから「テキストを全部入れてから、各段落の後ろに画像を入れる」順にする
- **空の段落にカーソルを置いて画像を入れると、空の段落が画像の上に残る。** 最後に空の段落が残っていないか
  確認し、あれば消す

崩れていたら公開せずに報告する。note は貼り直しが効くので、慌てて公開しない。

## ⑫ state.json をコミットする

**忘れると次回に二重投稿する。** `.x/state.json` には article_id・post_id・本文ハッシュが入っており、
これが無いと「未投稿」と判定されて記事も告知も再投稿される。

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
- 記事の告知はURL入りの1投稿なので、約 $0.20
- Articles の単価は非公開

画像生成（OpenAI, gpt-image-1.5, medium品質）は1枚あたり約$0.05〜0.06。
1記事1回、失敗しても自動リトライしないので、想定外の多重課金は起きない設計。
