# アクセス解析

記事の読まれ方・流入元・アプリへの送客・検索キーワードを、GA4 と Search Console で取っています。

| 知りたいこと                               | どこで見るか                                    |
| ------------------------------------------ | ----------------------------------------------- |
| 記事ごとの PV・滞在・読了率                | GA4 / `npm run analytics:report`                |
| 流入元（X / Zenn / note / ChatGPT / 検索） | GA4 の「トラフィック獲得」/ レポート            |
| アプリへの送客                             | GA4 のキーイベント `app_store_click` / レポート |
| 検索キーワード・掲載順位                   | Search Console / レポート                       |

Vercel Web Analytics も残していますが、Hobby プランではカスタムイベントが記録されないので、PV と参照元をざっと見る用です。

## 送っているデータ

`src/components/Analytics.astro` と `src/layouts/Base.astro`。

| イベント                | いつ                                                       | パラメータ                                                                                                 |
| ----------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `page_view`             | 初回表示とページ遷移ごと（ViewTransitions のため手動送信） | `content_group`（article / top / apps / about / tags …）、`article_slug`、`article_tags`、`published_date` |
| `outbound_click`        | `data-track` 付きリンクのクリック                          | `link_target`（data-track の値）、`link_url`、`link_location`                                              |
| `app_store_click`       | `data-track="app:..."` のクリック                          | `app_name`、`link_target`、`link_detail`、`link_url`                                                       |
| `scroll_depth`          | 記事本文の 25 / 50 / 75 / 100% が画面に入った              | `percent`、`article_slug`                                                                                  |
| `article_read_complete` | 記事本文の末尾まで到達                                     | `article_slug`、`seconds_to_complete`                                                                      |

計測したいリンクを増やすときは `data-track="種別:名前:補足"` を付けるだけ（`app:` で始まるとアプリ送客として数える）。

転載先からのリンクには UTM を付けています（`scripts/lib/utm.cjs`）。

- X: `utm_source=x&utm_medium=social&utm_campaign=<記事ファイル名>`
- Zenn: `utm_source=zenn&utm_medium=referral&...`（`pubDate` が 2026-10-14 以降の記事だけ。既存記事を一斉に書き換えるとZennの投稿数上限に当たるため）
- note: `utm_source=note&utm_medium=referral&...`

## 初期設定（一度だけ）

人が画面で操作しないといけないのは 1〜4 だけ。GA4 の細かい設定と測定IDの反映は 5 のスクリプトがやる。

### 1. GA4 のプロパティとウェブストリームを作る

1. [Google アナリティクス](https://analytics.google.com/) → 管理 → 作成 → プロパティ（タイムゾーン: 日本、通貨: 円）。
2. データストリーム → ウェブ → URL `dev-blog-pi-six.vercel.app`。
3. 管理 → プロパティの詳細 の右上にある **数字のプロパティID** を控える（`G-` の測定IDではない）。

### 2. サービスアカウントを作る（Google Cloud）

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作る（課金設定は不要）。
2. APIとサービス → ライブラリ で **Google Analytics Admin API**、**Google Analytics Data API**、**Google Search Console API** を有効にする。
3. IAMと管理 → サービスアカウント → 作成（ロールは付けなくてよい）。
4. 作ったアカウントの「鍵」→ 鍵を追加 → JSON。ダウンロードしたファイルはリポジトリの外に置く（例: `~/.config/keys/dev-blog-analytics.json`）。

### 3. サービスアカウントに権限を付ける

- GA4: 管理 → プロパティのアクセス管理 → ＋ → サービスアカウントのメールアドレス（`…@….iam.gserviceaccount.com`）を **編集者** で追加。
- Search Console: 設定 → ユーザーと権限 → ユーザーを追加 → 同じアドレスを **制限付き** で追加。

### 4. Search Console を GA4 にリンクする

GA4 の 管理 → サービスとのリンク → Search Console のリンク → `https://dev-blog-pi-six.vercel.app/` を選んでウェブストリームと関連付ける（API が無いので手作業）。

### 5. セットアップスクリプトを実行する

`.env` に書く:

```sh
GA4_PROPERTY_ID=123456789
GSC_SITE_URL=https://dev-blog-pi-six.vercel.app/   # ドメインプロパティなら sc-domain:example.com
GOOGLE_APPLICATION_CREDENTIALS=/Users/<you>/.config/keys/dev-blog-analytics.json
```

```sh
npm run analytics:setup -- --dry-run   # 何をするか確認
npm run analytics:setup
git add src/config/config.json && git commit -m "chore: GA4の測定IDを設定" && git push
```

スクリプトがやること（何度実行しても同じ状態になる）:

- ウェブストリームの測定IDを `src/config/config.json` の `analytics.ga4MeasurementId` に書き込む
- 拡張計測の「ブラウザの履歴イベントに基づくページの変更」をオフ（page_view はサイト側で送るので二重計上を防ぐ）
- `app_store_click` と `article_read_complete` をキーイベントに
- イベントスコープのカスタムディメンション（`article_slug`、`article_tags`、`published_date`、`link_target`、`link_detail`、`app_name`、`percent`）を作成
- イベントデータの保持期間を 14 か月に（初期値は 2 か月）

測定IDを push すると、Vercel の **本番デプロイでだけ** GA4 が読み込まれる（`VERCEL_ENV=production`）。プレビューやローカルは集計に混ざらない。ローカルで動作確認したいときは `PUBLIC_GA_MEASUREMENT_ID=G-XXXX npm run build && npm run preview`。

確認: 自分のブログを開いて GA4 の レポート → リアルタイム に出れば成功（広告ブロッカーが入っているブラウザでは出ない）。

### 任意: 自分のアクセスを除外する

データストリーム → タグ設定を行う → 内部トラフィックの定義 で自宅の IP を登録し、管理 → データフィルタ で「Internal Traffic」を有効にする。

## レポートを出す

```sh
npm run analytics:report                                   # 直近7日（昨日まで）
npm run analytics:report -- --from 2026-10-01 --to 2026-10-31 --out reports/2026-10.md
```

記事別の PV・滞在・読了率・アプリ送客、流入元、記事 × 流入元、Search Console の記事別表示回数・CTR・順位・上位クエリを Markdown で出します。
