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
- Zenn: `utm_source=zenn&utm_medium=referral&...`
- note: `utm_source=note&utm_medium=referral&...`

## 初期設定（一度だけ）

### 1. GA4 のタグを有効にする

1. [Google アナリティクス](https://analytics.google.com/) でプロパティを作り、ウェブストリームを `https://dev-blog-pi-six.vercel.app` で追加する。
2. ウェブストリームの「拡張計測機能」で **ページビューの「ブラウザの履歴イベントに基づくページの変更」をオフ**にする（ページ遷移はこちらで送っているので二重計上になる）。
3. 測定ID（`G-XXXXXXX`）を Vercel の Project → Settings → Environment Variables に `PUBLIC_GA_MEASUREMENT_ID` として登録し、再デプロイする。

### 2. GA4 側の設定

- 管理 → イベント（キーイベント）で `app_store_click` と `article_read_complete` をキーイベントにする。
- 管理 → カスタム定義で、イベントスコープのカスタムディメンションとして `article_slug`、`article_tags`、`link_target`、`app_name`、`percent` を登録する（`content_group` は GA4 標準の「コンテンツグループ」に入るので登録不要）。
- 管理 → データ保持を 14 か月にする（初期値は 2 か月）。

### 3. Search Console をつなぐ

- Search Console のプロパティは所有権確認済み（`Base.astro` の `google-site-verification`）。
- GA4 の管理 → Search Console のリンクから関連付ける。

### 4. レポートスクリプト用の認証

1. Google Cloud でプロジェクトを作り、**Google Analytics Data API** と **Google Search Console API** を有効にする。
2. サービスアカウントを作って JSON 鍵をダウンロードする（リポジトリの外に置く）。
3. GA4 の管理 → プロパティのアクセス管理で、サービスアカウントのメールアドレスに「閲覧者」を付ける。
4. Search Console の設定 → ユーザーと権限で、同じメールアドレスを「制限付き」で追加する。
5. `.env` に書く:

```sh
GA4_PROPERTY_ID=123456789          # 管理 → プロパティの詳細（G- の測定IDではない）
GSC_SITE_URL=https://dev-blog-pi-six.vercel.app/   # ドメインプロパティなら sc-domain:example.com
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

## レポートを出す

```sh
npm run analytics:report                                   # 直近7日（昨日まで）
npm run analytics:report -- --from 2026-10-01 --to 2026-10-31 --out reports/2026-10.md
```

記事別の PV・滞在・読了率・アプリ送客、流入元、記事 × 流入元、Search Console の記事別表示回数・CTR・順位・上位クエリを Markdown で出します。
