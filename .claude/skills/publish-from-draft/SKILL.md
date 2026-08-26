---
name: publish-from-draft
description: Coworkのスケジュールタスク（記事ネタ受信箱チェック）が下書き止まりで作った記事（Obsidianの`個人/発信/記事/公開済み/`にfrontmatter込みで保存済み）を受け取り、ヒーロー画像生成からブログ・Zenn・X公開・実績記録まで仕上げる。Coworkのサンドボックスはapi.openai.com/vercel.app/zenn.dev/x.comへのネットワーク接続が構造的にできないため、この続きはこの端末（Mac）のClaude Codeから手動で実行する。ユーザーが「さっきの下書きを公開して」「記事を公開まで進めて」「公開済みフォルダの記事を出して」と言ったとき、または対象slugを指定してきたときに使う。
---

# publish-from-draft

## これは何のためのスキルか

Coworkの`scheduled-task`（記事ネタ受信箱チェック）は、実行環境（Coworkのクラウドサンドボックス）から
`api.openai.com` / `*.vercel.app` / `zenn.dev` / `x.com`・`api.x.com` に接続できないため、
**記事を下書きまで作って`公開済み/`へ置いたところで必ず止まる設計**になっている
（2026-08-26に実機検証済み。github.comだけは到達できるが、それ以外の公開に必要なドメインは全滅）。

この記事を実際に公開する「続き」は、フルにネットへ出られるこの端末（Claude Code）で仕上げる。
つまり `publish-article` スキルの ⓪〜⑥（人格読み込み・事実確認・執筆・自己点検・公開済みへの移動）
はCowork側で完了済みという前提で、**⑥.5〜⑬だけをここで実行する。**

## 前提条件（実行前に確認）

- 対象記事が `Obsidian /個人/発信/記事/公開済み/YYYYMMDD-<slug>.md` にfrontmatter込みで存在する
- `.env` に `OPENAI_API_KEY` / `X_API_KEY` / `X_ACCESS_TOKEN`（と関連シークレット）が入っている
- `node` / `npm` / `git` が使える

**このスキルは記事の書き直しをしない。** 文体・事実確認・frontmatterの妥当性に疑問があれば、
公開経路に乗せる前に自分の目で記事を読む。書き直しが要ると判断したら
`publish-article`（`.claude/skills/publish-article/SKILL.md`）を最初からやり直すよう促す。

## 対象記事の特定

引数でslug（basename、例: `20260826-openai-api-key-leak-warning`）を渡されたらそれを使う。

渡されなければ、`公開済み/` にあるが `src/content/blog/` にまだ同期されていない記事を探す。

```bash
V="/Users/yuki/Library/Mobile Documents/iCloud~md~obsidian/Documents/YukiKawabata /個人"
comm -23 \
  <(ls "$V/発信/記事/公開済み/" | sed 's/\.md$//' | sort) \
  <(ls src/content/blog/ | sed 's/\.md$//' | sort)
```

複数見つかったら、**黙って全部処理せず、どれを公開するかユーザーに確認する。**
frontmatterが `draft: true` や `zenn.published: false` になっているファイルは対象から除外する
（`公開済み`フォルダに置かれているだけの未完成稿があり得るため。記事研究.mdの2026-08-24の
記録漏れチェック参照）。

## 実行手順

詳細は必ず本体を読んで実行する。ここは要点の再掲であり、省略した工程があるので
このメモだけで進めない。

- `.claude/skills/publish-article/references/publishing.md` — ⑥.5〜⑪の手順とコマンド
- `.claude/skills/publish-article/references/review.md` — ⑫〜⑬の記録項目と測り方

順番に意味があるので入れ替えない。

1. **⑥.5 ヒーロー画像を確定させる**（すべての公開より前）
   ```bash
   npm run generate:hero -- --slug <basename> --theme "<記事のテーマを1〜2文で>"
   ```
   `OPENAI_API_KEY`が無い、または2回連続で失敗したら、画像を`public/images/hero/<basename>.webp`
   に手動で置くよう頼んで止まる。**画像が確定するまで、ブログ・Zenn・Xのどれにも公開しない。**
   Xはリンクカードの画像を投稿時にキャッシュし、後から直せないため。

2. **⑦ ブログへ同期・公開**（必ずZennより先。CTAリンクの原典を先に確定させるため）
   ```bash
   npm run sync:obsidian
   git status --short src/content/blog/   # 新規1本だけが差分に出ることを確認
   npm run build
   git add -A && git commit -m "feat: <記事タイトル>を公開" && git push origin main
   ```
   新規1本以外の差分（他記事の変更・削除）が出たら、Obsidian側が壊れている可能性がある。
   止めて報告する。

3. **⑧ デプロイ完了を待つ**
   ```bash
   URL="https://dev-blog-pi-six.vercel.app/blog/<basename>/"
   for i in $(seq 1 20); do
     CODE=$(curl -s -o /dev/null -w "%{http_code}" -L "$URL?cb=$(date +%s)")
     echo "[$i] $CODE"
     [ "$CODE" = "200" ] && break
     sleep 20
   done
   ```
   5分以上404が続く場合はVercelのデプロイが起動していない可能性がある。
   `git commit --allow-empty -m "chore: trigger deployment" && git push origin main` で再起動を試す。

4. **⑨ Zennへ配信**
   ```bash
   npm run sync:zenn
   cd ../zenn-articles && git status --short   # 新規1本だけか確認
   git add articles/<slug>.md && git commit -m "feat: <タイトル>を追加" && git push origin main
   ```
   push後、**Zenn URLを実際にブラウザで開いて記事が存在することを目視確認する。**
   `published: true`でも実際には反映されない事故が過去にある（記事研究.md A14）。
   ステータスコード200は当てにならない（存在しないslugでも200を返す）。

5. **⑩ Xへ配信**
   投稿前に、記事ページと画像の両方が200であることを確認する（片方でも404なら投稿しない）。
   ```bash
   BASE="https://dev-blog-pi-six.vercel.app"
   curl -s -o /dev/null -w "記事: %{http_code}\n" -L "$BASE/blog/<basename>/"
   curl -s -o /dev/null -w "画像: %{http_code}\n" -L "$BASE/images/hero/<画像ファイル名>"
   node scripts/sync-x.mjs --publish --thread --only <slug>
   ```
   投稿できたかどうかは**必ずブラウザで確認する**（x.comはSPAなのでcurlの200は無意味）。
   プロフィールの「ポスト」タブにスレッドが並んでいるか、`article_enabled: true`の場合は
   「記事」タブも確認する。

6. **⑪ noteへ配信**（frontmatterに`note:`があるときだけ）
   `npm run sync:note -- --only <slug>` で生成された`.note/<slug>.json`をブラウザ操作で
   noteのエディタに流し込み、スクリーンショットで崩れがないか確認してから公開する。

7. **⑫ 記録する（省略しない）**
   - `SNS/99_システム/投稿済み台帳/投稿済みX_ID.txt` — 投稿したポストURL全部（追記専用）
   - `SNS/99_システム/実績/投稿実績.csv` — スロット`記事配信`、型`記事告知スレッド(n/m)`
   - `個人/発信/記事/実績/記事実績.csv` — 公開直後は数値空でよい
   - `個人/発信/記事/記事研究.md` — 学びをA番号の仮説として追記
   - `.x/state.json` をコミットする（忘れると次回二重投稿する）
   ```bash
   git add .x/state.json && git commit -m "chore: update X sync state" && git push origin main
   ```

8. **⑬ 報告する**
   媒体ごとの状態とURLを表で報告する。推測を書かない。

   | 媒体 | 状態 | URL |
   | ---- | ---- | --- |

## このスキル固有の注意

- **依存関係を書き換えない。** `npm install`や`package.json`/`package-lock.json`の変更が
  必要に見えても、勝手に実行せずユーザーに確認する。過去にCowork側のサンドボックスで
  ネイティブモジュールの環境差異をトラブルシュートしようとして無断でこれを行い、
  リポジトリに一時的な差分を残してしまった事故がある（2026-08-26）
- Coworkが書いた下書きは既にですます調・一人称・コード例なしのはずだが、
  **Xスレッドが常体・絵文字なしになっているかだけは投稿前に自分の目でも確認する**
  （`.claude/skills/publish-article/references/persona.md`の「AIっぽさが出る典型」参照）
- 途中で止まった場合、次に呼ばれたときは同じslugから再開できるよう、
  どこまで終えたかを報告に明記する
