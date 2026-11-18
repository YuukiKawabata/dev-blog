# Threads 連携（記事の告知）

記事PRが `main` にマージされたら、X と同じタイミングで Threads にも告知を1投稿する（2026-11〜）。
X の仕組み（[x-sync.md](./x-sync.md)）と同じ考え方で、別の workflow として動く。どちらかが失敗しても、もう片方は動く。

```
記事PRのマージ（main への push）
  └─ Sync Threads（.github/workflows/sync-threads.yml）
       ├─ scripts/threads-new-articles.mjs … その push で「追加された」記事を探す
       ├─ ブログの記事ページとヒーロー画像が200になるまで待つ（最大10分）
       ├─ scripts/sync-threads.mjs --publish --only <slug>
       │    POST /v1.0/{user-id}/threads（media_type=TEXT, text, link_attachment）
       │    POST /v1.0/{user-id}/threads_publish（creation_id）
       └─ .threads/state.json をコミット（二重投稿の防止）

月2回（1日・15日）
  └─ Refresh Threads token（.github/workflows/refresh-threads-token.yml）
       ├─ GET /refresh_access_token … 長期トークンを60日延ばす
       └─ gh secret set THREADS_ACCESS_TOKEN … 新しいトークンを Secrets に書き戻す
```

API のドメインは `https://graph.threads.com`（2026-11 時点の公式ドキュメント）。

## 何が投稿されるか

- 文面: frontmatter の `threads.text`。無ければ `x.thread[0]`（X 用に本人の声で書いた告知）をそのまま使う
- 文面の中のブログURLには `utm_source=threads&utm_medium=social` が自動で付く。同じURLを `link_attachment` に渡すので、リンクカードが出る。文面にURLが無ければ最後の行に足す
- 500字（Threads の上限。絵文字はUTF-8のバイト数で数える）を超えたら投稿せずエラーにする。切り詰めはしない
- 投稿しないもの: 既存記事の編集 / 告知文（`threads.text` か `x.thread`）が無い記事 / `threads.auto: false` か `x.auto: false` の記事 / ブログかヒーロー画像が10分待っても開けなかった記事

```yaml
x:
  thread:
    - "1行目で事件を言い切る。\nhttps://dev-blog-pi-six.vercel.app/blog/<basename>/"
threads: # 任意。無ければ x.thread[0] を使う
  text: 'Threads だけ文面を変えたいときに書く（500字まで）'
  auto: false # Threads には出さないとき
```

## 手で動かす

GitHub の Actions → **Sync Threads** → Run workflow（スマホの GitHub アプリからでもよい）。

| action    | やること                                                                                                       |
| --------- | -------------------------------------------------------------------------------------------------------------- |
| `dry-run` | 文面を出すだけ（既定）。slug を空にすると全記事                                                                |
| `publish` | slug の記事を投稿する。投稿済みなら何もしない（`force` で再投稿）                                              |
| `record`  | 投稿はせず「投稿済み」と記録する。Threads のアプリから手で投稿したときに使う（`post_id` / `permalink` は任意） |

手元（Mac）では:

```bash
node scripts/sync-threads.mjs                       # 全記事の文面（ネットワークなし）
node scripts/sync-threads.mjs --only <slug>         # 1記事の文面と字数
node scripts/sync-threads.mjs --publish --only <slug>   # .env に THREADS_ACCESS_TOKEN / THREADS_USER_ID が要る
```

手元で投稿・記録したら `.threads/state.json` をコミットする（忘れると Actions がもう一度投稿する）。

## Secrets

| 名前                   | 中身                                                 | 更新                                          |
| ---------------------- | ---------------------------------------------------- | --------------------------------------------- |
| `THREADS_ACCESS_TOKEN` | Threads の長期アクセストークン（60日）               | Refresh Threads token が月2回自動で書き換える |
| `THREADS_USER_ID`      | Threads のユーザーID（数字）                         | 変わらない                                    |
| `THREADS_SECRETS_PAT`  | 上のトークンを書き戻すための GitHub fine-grained PAT | PAT の期限（最長1年）が来たら作り直す         |

App Secret は Secrets に置かない（トークンの更新には要らない。取り直すときだけ手元で使う）。

## 最初の設定（1回だけ）

1. [Meta for Developers](https://developers.facebook.com/apps/) でアプリを作る。ユースケースは「Threads APIにアクセス」。
   権限に `threads_basic` と `threads_content_publish` を足す
2. アプリの「役割」→ Threads テスターに自分の Threads アカウントを追加し、Threads の設定
   （アカウント → ウェブサイトのアクセス許可 → 招待）で承認する。自分のアカウントに投稿するだけなら、アプリ審査は要らない（開発モードのまま）
3. ユースケースの設定画面の「ユーザートークン生成ツール」で、テスターのトークンを作る。
   値は画面に出さずにコピーして、そのまま Secrets に入れる:

   ```bash
   # コピーしたのが長期トークンの場合
   pbpaste | gh secret set THREADS_ACCESS_TOKEN -R YuukiKawabata/dev-blog
   # 短期トークン（1時間）の場合は、App Secret を .env の THREADS_APP_SECRET に入れてから交換する
   pbpaste | node scripts/threads-token.mjs exchange | gh secret set THREADS_ACCESS_TOKEN -R YuukiKawabata/dev-blog
   # ユーザーID
   pbpaste | node scripts/threads-token.mjs me | gh secret set THREADS_USER_ID -R YuukiKawabata/dev-blog
   ```

   `threads-token.mjs` はトークンを画面に出さない（パイプかファイルにだけ書く）

4. GitHub で fine-grained PAT を作る（Settings → Developer settings → Fine-grained tokens）。
   Repository access: `YuukiKawabata/dev-blog` だけ / Permissions: **Secrets: Read and write** だけ / 期限: 1年。
   `gh secret set THREADS_SECRETS_PAT -R YuukiKawabata/dev-blog` に貼る
5. トークンを作ってから24時間たったら、Actions → Refresh Threads token を手で1回動かして、成功するのを確かめる

## トークンの期限と更新

- 長期トークンは60日で切れる。作ってから24時間以上たっていて期限内なら、更新するとまた60日になる。**60日更新しないと二度と更新できない**（取り直しになる）
- アプリへの許可（threads_basic など）は90日で切れる。公開プロフィールなら、トークンを更新するたびに90日延びる。非公開プロフィールにすると延びないので注意
- Refresh Threads token は毎月1日と15日に動く。失敗すると workflow が赤くなり、GitHub からメールが届く
- 更新後の残りが30日を切っていたら、わざと失敗させている

### 失敗したとき・トークンを取り直す

1. Actions のログでエラーを見る（トークンは出ない）。`Missing secret` なら Secrets の名前を確かめる
2. `Error validating access token` / `expired` なら、「最初の設定」の3をやり直して `THREADS_ACCESS_TOKEN` を入れ直す
3. PAT の期限切れ（`gh secret set` が 401/403）なら、4をやり直す
4. Refresh Threads token を手で動かして、成功を確かめる

告知の投稿がトークン切れで失敗した記事は、トークンを直してから Sync Threads を `publish` と slug で手動実行する。
