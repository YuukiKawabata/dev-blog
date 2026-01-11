# dev-blog

Astro で運用している個人ブログです。記事は `src/content/blog/` 配下の Markdown で管理します。

## セットアップ / 開発

```bash
npm install
npm run dev
```

## コマンド

| Command | Action |
| :-- | :-- |
| `npm run dev` | 開発サーバ起動 |
| `npm run build` | ビルド |
| `npm run preview` | ビルド成果物のプレビュー |
| `npm run newpost` | 新規記事ファイルの作成 |
| `npm run sync:zenn` | Zenn用記事を別リポジトリへ同期（下記参照） |

## 記事の追加

新規記事ファイルを作る:

```bash
npm run newpost
```

対話形式でファイルが `src/content/blog/` に生成されるので、本文を書いてください。

## 📰 Zenn Sync (初心者向け)

このリポジトリ（ブログ記事）から、別リポジトリ `zenn-articles` の `articles/` にZenn用Markdownを自動生成して同期します。

### 1) どの記事をZennに出すかを指定する

ブログ記事のfrontmatterに `zenn:` を追加した記事だけが同期対象になります。

#### 複数記事がある場合（1つだけZennに出したい）

- **Zennに出したい記事**: `zenn:` を書く（= 同期される）
- **Zennに出したくない記事**: `zenn:` を書かない（= 同期されない）

また、同期はするが **Zennで公開しない（下書き）** にしたい場合は、その記事だけ `published: false` にします。

例: `src/content/blog/xxxx.md`

```yaml
zenn:
  slug: your-zenn-slug
  emoji: '🚀'
  type: 'tech'
  topics: ['astro', 'mdx', 'blog', 'vercel']
  published: false
```

例: Zennに出さない記事（`zenn:` を書かない）

```yaml
---
title: 'Zennには出さない記事'
date: 2026-01-11
tags: ['memo']
---
```

### 2) ローカルで同期する（まずはdry-run推奨）

```bash
npm run sync:zenn -- --dry-run
```

実際にファイルを書き出す場合:

```bash
npm run sync:zenn
```

出力先はデフォルトで `../zenn-articles/articles` です。
ワークスペース構成が違う場合は `--dest` で変更できます。

```bash
npm run sync:zenn -- --dest /absolute/path/to/zenn-articles/articles
```

### 3) CIで自動化（dev-blog更新 → zenn-articlesにPR作成）

GitHub Actionsで、ブログ更新時に `zenn-articles` 側へブランチpush & PR作成まで自動化しています。
ワークフロー定義は [.github/workflows/sync-zenn.yml](.github/workflows/sync-zenn.yml) です。

#### (A) トークンを作成する

`zenn-articles` にpush/PR作成するため、GitHubのPersonal Access Token (PAT) が必要です。
Fine-grained PAT推奨です。

1. GitHub右上アイコン → Settings
2. Developer settings → Personal access tokens → Fine-grained tokens
3. 対象リポジトリを `YuukiKawabata/zenn-articles` に限定
4. 権限を付与
   - Repository permissions: `Contents: Read and write`
   - Repository permissions: `Pull requests: Read and write`
5. Tokenを発行して控える（この画面でしか見れません）

#### (B) dev-blogにSecretを登録する

`yuki-dev-blog` リポジトリの
Settings → Secrets and variables → Actions → New repository secret で、以下を登録します。

- Name: `ZENN_SYNC_TOKEN`
- Value: (上で作ったPAT)

#### (C) 動かし方

- 通常は `main` へのpush（`src/content/blog/**` 変更）で自動実行されます。
- 初回は手動実行が安心です: GitHub → Actions → "Sync Zenn articles" → Run workflow

#### よくあるエラー

- `Error: Input required and not supplied: token`
  - 原因: `ZENN_SYNC_TOKEN` が未登録、または空の値で登録されています。
  - 対処: `dev-blog` → Settings → Secrets and variables → Actions で `ZENN_SYNC_TOKEN` を作成/更新して、PAT文字列を入れた上で workflow を再実行してください。

## ライセンス

MIT License（詳細は `LICENSE` を参照）
