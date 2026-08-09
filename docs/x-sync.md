# X 連携（Articles ダイジェスト + 告知スレッド）

Zenn 連携（`npm run sync:zenn`）と同じ作法で、`src/content/blog/*.md` から X へ配信する仕組み。
記事本文はブログに残し、X には**ダイジェスト（Article）**と**告知スレッド**を出して流入を戻す。

```
src/content/blog/*.md ─┬─ sync:zenn → ../zenn-articles/articles/*.md
                       └─ sync:x    → .x/drafts/<slug>.json ─┬─ POST /2/articles/draft
                                                             ├─ POST /2/articles/{id}/publish
                                                             └─ POST /2/tweets (スレッド)
                                                                        ↓
                                                             .x/state.json（ID とハッシュ）
```

## セットアップ

1. [X Developer Console](https://console.x.com) にログインする（旧 `developer.x.com` は 404。審査はなく規約同意のみ）
2. **Apps → + New app** でアプリを作る
3. アプリ権限を **Read and write** にする（変更後に必ず Access Token を再生成すること）
4. **Keys & Tokens** から 4 つを取得
5. クレジットを購入する（従量課金制。残高 $0 では API が一切通らない）
6. **支出上限（spend limit）を必ず設定する**（既定は無制限）
7. ローカルは `.env`、CI は Settings → Secrets and variables → Actions に登録

```
X_API_KEY=...
X_API_SECRET=...
X_ACCESS_TOKEN=...
X_ACCESS_TOKEN_SECRET=...
SITE_URL=https://example.com   # 任意。CTA リンクの生成元
```

投稿アカウントに **X Premium** が必要（2026年1月以降は最下位プランでも可）。
認証は OAuth 1.0a ユーザーコンテキスト。OAuth 2.0 の refresh token は使うたびにローテートして
CI と相性が悪いため、期限のない 1.0a を採用している。

### 費用の目安

Free / Basic / Pro は廃止され、従量課金のみ（2026年2月〜）。

| 操作 | 単価 |
| --- | --- |
| ポスト作成 | $0.015 / 件 |
| **URL を含むポスト作成** | **$0.200 / 件** |
| ポスト読み取り | $0.005 / 件 |

Articles エンドポイントの単価は公式に記載がない。スレッドは URL を最終投稿1件だけに寄せてあるので、
1記事あたり 4投稿なら `0.015 × 3 + 0.200 = 約 $0.25`（Article 分を除く）。

## 記事側の書き方

frontmatter に `x:` を足すだけで対象になる（`zenn:` と同じ）。

```yaml
---
title: '記事タイトル'
description: '1〜2文の要約。スレッド1投稿目に使われる'
pubDate: '2026-08-09'
tags: ['AI']
zenn:
  slug: my-article
  published: true
x:
  slug: my-article # state のキー兼ファイル名。既定はファイル名
  mode: digest # digest（既定） | full
  hashtags: ['ClaudeCode'] # スレッド最終投稿に付く
---
```

### `x:` で使えるキー

| キー               | 既定値                           | 説明                                                 |
| ------------------ | -------------------------------- | ---------------------------------------------------- |
| `slug`             | ファイル名                       | `.x/state.json` のキー、生成 JSON のファイル名       |
| `title`            | frontmatter の `title`           | Article のタイトル                                   |
| `description`      | frontmatter の `description`     | スレッド1投稿目の本文                                |
| `mode`             | `digest`                         | `digest` = 導入＋見出し＋CTA / `full` = 全文転載     |
| `url`              | `<SITE_URL>/blog/<ファイル名>/`  | CTA のリンク先                                       |
| `cta`              | `続きはブログで読めます。` | ダイジェスト末尾の一文                               |
| `hashtags`         | `[]`                             | スレッド最終投稿の末尾                               |
| `thread`           | 自動生成                         | 文字列配列を書くとスレッドを完全に手動指定           |
| `thread_enabled`   | `true`                           | `false` でスレッドを出さない                         |
| `max_points`       | `8`                              | 「この記事で書いたこと」の箇条書き上限               |
| `skip_points`      | `[]`                             | 箇条書きから除く h2（`はじめに` 等は既定で除外済み） |
| `max_thread_posts` | `5`                              | スレッドの投稿数上限                                 |
| `code_blocks`      | `blockquote`                     | `blockquote` / `text` / `omit`                       |

## コマンド

```bash
npm run sync:x        # 生成のみ。ネットワークもコストも発生しない
npm run x:draft       # 下書きを作成（非公開のまま）
npm run x:publish     # 下書き作成 + 公開
npm run x:thread      # 告知スレッドを投稿
```

個別指定やオプションはスクリプトに直接渡す。

```bash
node scripts/sync-x.mjs --only my-article
node scripts/sync-x.mjs --publish --thread --only my-article
node scripts/sync-x.mjs --help
```

**まず `npm run sync:x` で `.x/drafts/<slug>.json` を目視確認する**のを推奨。
ブロック構成とスレッド全文がそのまま入っている。

## 冪等性

`.x/state.json` に `articleId` / `postId` / 本文ハッシュ / スレッド ID を記録している。
本文が変わっていない記事は再実行してもスキップされるので、CI が何度走っても二重投稿しない。
意図的に作り直したいときだけ `--force`。

> X Articles API に更新エンドポイントはない。公開済み記事を直したい場合は
> `--force` で新しい下書きを作り、古い方を UI から消すことになる。

## GitHub Actions

`.github/workflows/sync-x.yml`。

- **push（main）**: 生成と検証のみ。X へは何も送らない。成果物は artifact に上がる
- **workflow_dispatch**: `build` / `draft` / `publish` / `thread` / `publish+thread` を選んで実行

外向きの操作は必ず手動トリガーにしてある。実行後は `.x/state.json` が自動でコミットされる。

## 制約と既知の割り切り

- **コスト**: 2026年2月から X API は従量課金。投稿作成 $0.015/件、**リンクを含む投稿は $0.20/件**。
  スレッド5投稿＋Article で 1 記事あたり数十円規模を見込む
- **テーブル**: X Articles にテーブルブロックがないため `セル | セル` のテキストに落ちる
- **コードブロック**: 対応するブロック型がないため既定で引用ブロックに落ちる。`code_blocks: omit` で除去可
- **インラインコード**: 等幅スタイルがないためプレーンテキストになる
- **画像**: `mode: full` かつ `--apply` 時のみ、`public/` 配下のローカル画像をアップロードして埋め込む。
  外部 URL の画像はスキップされる
- **カバー画像**: API 側に設定パラメータが公開されていないため未対応
- **リンクの entity 型**: 公式ドキュメントに link entity の実例がなく、`{"type":"link"}` を採用している。
  API が拒否する場合は `X_LINK_MODE=text` を設定するとリンクを `ラベル (URL)` のプレーンテキストに切り替えられる
