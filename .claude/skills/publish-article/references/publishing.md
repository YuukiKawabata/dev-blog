# 公開手順

ユーザーの承認を得たあとに実行する。**順番に意味がある。**

前提: `.env` に X の認証情報4つが入っている。無い場合はその時点で止めてユーザーに伝える。

## ⑥ ブログを公開する

最初にブログ。理由は2つ。

- Zenn より先に公開しないと、検索エンジンにどちらが原典か示せない
- X の CTA リンクの飛び先が404になる

```bash
npm run build
```

ビルドが通ることを確認してからコミットする。

```bash
git add -A && git commit -m "feat: <記事タイトル>を公開" && git push origin main
```

## ⑦ デプロイ完了を待つ

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

デプロイ後、画像とOGPも確認する。

```bash
curl -s -L "$URL" | grep -oE 'property="og:image" content="[^"]*"'
curl -s -o /dev/null -w "%{http_code}\n" -L "https://dev-blog-pi-six.vercel.app/images/hero/<画像名>"
```

## ⑧ Zenn へ配信

```bash
npm run sync:zenn
cd ../zenn-articles && git status --short
```

**新規記事1本だけが差分に出ることを確認する。** 他の記事に差分が出ていたら、意図しない再生成なので止めて報告する。
`.DS_Store` はコミットしない。

```bash
cd ../zenn-articles && git add articles/<slug>.md && git commit -m "feat: <タイトル>を追加" && git push origin main
```

## ⑨ X へ配信

**ブログが200を返していることを確認済みであること。**

```bash
node scripts/sync-x.mjs --publish --thread --only <slug>
```

`article_enabled: false` の場合はスレッドのみ投稿される（Articleの下書きも作られない）。

### 確認は必ずブラウザで

**curl で x.com を叩いて200を見ても意味がない。** SPAなので存在しないURLでも200を返す。

ブラウザツールで確認する:

- プロフィール `https://x.com/Yuki_K25` の「ポスト」タブ → スレッドが並んでいるか
- 「記事」タブ → Article を出した場合、そこに出る（ポストのタイムラインには**流れない**）

## ⑩ note へ配信（`note:` がある場合のみ）

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

## ⑪ state.json をコミットする

**忘れると次回に二重投稿する。** `.x/state.json` には article_id・post_id・本文ハッシュが入っており、
これが無いと「未投稿」と判定されて記事もスレッドも再投稿される。

```bash
git add .x/state.json && git commit -m "chore: update X sync state" && git push origin main
```

## 完了報告

以下を表で報告する。推測ではなく、実際に確認した結果を書く。

| 媒体 | 状態 | URL |
| --- | --- | --- |

失敗した工程があれば、成功したものと分けて明示する。「たぶん大丈夫」と書かない。

## コスト

X API は従量課金。

- ポスト作成 $0.015/件、**URLを含むポストは $0.20/件**
- スレッドは最終投稿だけURLを含む設計なので、4投稿で約 $0.25
- Articles の単価は非公開
