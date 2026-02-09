---
title: "【2026年1月】Web標準動向まとめ：Privacy Sandboxの崩壊と「実用性」への回帰"
description: "2026年1月のWeb標準動向解説。Privacy Sandboxの主要API削除、Canvas縦書き対応、AI開示属性など、開発者が知っておくべき変化をまとめました。"
pubDate: "2026-02-09"
heroImage: "/images/hero/20260209-web-standards.png"
tags: ["Web標準", "Browser", "Chrome", "PrivacySandbox"]
categories: ["Tech"]
author: "Yuki"
zenn:
  slug: "web-standards-trends-202601"
  emoji: "🌐"
  type: "tech"
  topics: ["web", "browser", "standard", "chrome"]
  published: false
---

**「2026年は、Webが『Googleの実験場』から『安定したプラットフォーム』へ回帰する年になる」**

1月のWeb標準動向を追いながら、私は確信に近い手応えを感じました。
数年間にわたりWeb業界を振り回してきた「Privacy Sandbox」の主要APIが、Chrome 143/144で相次いで削除されたからです。

これは単なる機能の廃止ではありません。
「複雑すぎる仕様は定着しない」という、Webエコシステムの健全な自浄作用が働いた結果です。

今回は、そんな激動の2026年1月のWeb標準動向から、私たちが知っておくべき「3つの大きな潮流」をピックアップして深掘りします。

1.  **Privacy Sandbox の崩壊とCookieの現状維持**
2.  **「地味だけど神」な実用機能の標準化（Canvas縦書き、select要素）**
3.  **AI規制に対するWebの回答（ai-disclosure属性）**

---

## 1. Privacy Sandbox の崩壊：夢の終わりと現実

2025年10月の「終了宣言」を受け、Chrome 143（1月6日リリース）と144（2月3日リリース）で、かつて次世代の広告基盤と謳われたAPI群が削除されました。

*   **Topics API**: ユーザーの興味関心に基づくターゲティング
*   **Protected Audience API**: ブラウザ内での広告オークション
*   **Attribution Reporting API**: クッキーを使わない効果測定

これらはすべて**「削除 (Removed)」**となりました。

### なぜうまくいかなかったのか？
最大の要因は「複雑すぎた」こと、そして「他ブラウザ（Safari/Firefox）の合意が得られなかった」ことです。
Web標準の世界では、Chrome一強とはいえ、他のベンダーがNOを突きつけた仕様は生き残りません。

結果として、私たちは元の世界――つまり**「Cookieとファーストパーティデータ」**の世界――に戻ってきました。
アドテク業界は再びサーバーサイド計測（CAPIなど）への回帰を余儀なくされていますが、開発者としては「ブラウザに変な黒魔術を実装しなくて済む」という意味で、歓迎すべき回帰かもしれません。

---

## 2. 「実用性」への回帰：Canvas縦書きとSelect要素

派手な広告APIが消えた一方で、現場のエンジニアが「やっと来たか！」と膝を打つような、実用的な機能強化が進んでいます。

### Canvas API での「縦書き」ネイティブ対応
これまで、HTML5 Canvasで「縦書き（Vertical Text）」をやるのは苦行でした。
一文字ずつ座標計算をして、回転させて……という実装が必要でしたが、ついに標準解決策が見えてきました。

```javascript
// 提案されている新しいAPI
ctx.textWritingMode = "vertical-rl";
ctx.fillText("縦書きのテキスト", x, y);
```

Blink (Chrome) エンジンでのプロトタイプ実装が進んでおり、日本語の帳票出力やデザインツールをWebで作る際のハードルが劇的に下がります。
これは、サイボウズ社などがW3Cに参加し、実務的なニーズを標準化プロセスに持ち込んだ成果の好例です。

### `<select>` 要素の完全カスタマイズ
長年の悲願だった「セレクトボックスのCSSスタイリング」も、`appearance: base-select` によって解決しつつあります。
Chrome 143やSafari 26.3で実装が進んでおり、もう「偽のdivセレクトボックス」を作る必要がなくなる日も近いです。

---

## 3. AIとWeb：透明性を確保する `ai-disclosure`

EU AI法やカリフォルニア州法（SB 243）の施行に伴い、Web標準側でも「AI生成コンテンツの明示」が求められています。

そこで議論されているのが **`ai-disclosure` 属性**です。

```html
<img src="generated-art.jpg" ai-disclosure="generated">
<p ai-disclosure="assisted">この文章はAIの支援を受けて執筆されました。</p>
```

このようにHTML属性として明示することで、ブラウザが自動的に「AI生成」ラベルを表示したり、スクリーンリーダーがユーザーに警告したりできるようになります。
WebNN (Web Neural Network API) によるブラウザ内推論の高速化とセットで、2026年は「AIとWebの融合」が法制・技術の両面で進む一年になりそうです。

---

## まとめ：2026年は「足場を固める」年に

Privacy Sandboxという「ノイズ」が去り、Web標準は再び**「相互運用性（Interop）」**と**「開発者の課題解決」**にフォーカスしています。

Interop 2026では、以下の機能が重点項目として議論されています。
*   **Grid Lanes (Masonry Layout)**: Pinterest風レイアウトの標準化
*   **WebXRの統一**: Vision Pro対応の加速
*   **Signature-based SRI**: CDN利用時のセキュリティ強化

私たち開発者は、振り回されるのではなく、これらの「確実に来る未来」をキャッチアップし、堅実なプロダクト開発に活かしていくべきでしょう。
とりあえず、私は自前のドロップダウンコンポーネントを `appearance: base-select` に置き換える準備から始めようと思います。
