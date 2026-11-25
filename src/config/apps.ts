export type StoreLink = {
  label: string;
  url: string;
};

export type AppItem = {
  name: string;
  icon: string;
  // トップの一覧で使う短い一言。
  tagline: string;
  description: string;
  stores: StoreLink[];
  // 本命アプリだけ大きく表示する。
  lead?: boolean;
  badge?: string;
  story?: StoreLink;
};

// App Storeで公開中の本数。アプリが増えたらここを更新してください。
export const publishedAppCount = 13;

export const developerPage = 'https://apps.apple.com/jp/developer/yuuki-kawabata/id1865457350';

// 主力は apps に説明つきで載せ、残りは otherAppNames として名前だけ出し、App Storeの一覧へ誘導する。
export const apps: AppItem[] = [
  {
    name: 'コンビニ帝国',
    tagline: '放置系コンビニ経営ゲーム',
    icon: '/app-icons/konbini-empire.png',
    description:
      '元コンビニ店長が本気で作る、放置で育てるコンビニ経営ゲーム。小さな店から始めて、商品・スタッフ・設備・店舗網を育てます。収益化テストの数字も全部公開しながら育てている、いまの主力アプリです。',
    stores: [{ label: 'App Store', url: 'https://apps.apple.com/jp/app/id6807601218' }],
    lead: true,
    badge: 'いちばん力を入れているアプリ',
    story: { label: 'コンビニ帝国を出すまで', url: '/blog/20260903-tenth-app-konbini-empire/' },
  },
  {
    name: 'カロリング',
    tagline: '写真で食事記録・AIカロリー計算',
    icon: '/app-icons/karoring.svg',
    description:
      '食事の写真からAIがカロリー・PFCを計算し、歩数と睡眠を合わせて「食べた・動いた・休んだ」の3リングで1日を見せる健康管理アプリ。すべての機能を無料で使えます。',
    stores: [
      { label: 'App Store', url: 'https://apps.apple.com/jp/app/id6759490486' },
      { label: 'Google Play', url: 'https://play.google.com/store/apps/details?id=com.yuukikawabata.respo' },
    ],
  },
  {
    name: 'Atode',
    tagline: 'スクショをAIで自動整理',
    icon: '/app-icons/atode.png',
    description:
      '撮りっぱなしのスクリーンショットをAIが読み取り、予定・タスク・買い物リストへの登録を提案する整理アプリ。合っていればスワイプで登録、いらなければ流すだけです。',
    stores: [{ label: 'App Store', url: 'https://apps.apple.com/jp/app/id6778453895' }],
  },
  {
    name: 'Wamori',
    tagline: '親しい人との交換日記',
    icon: '/app-icons/wamori.svg',
    description:
      '親しい人だけで今日を交換するクローズドSNS。2〜5人の招待制グループ「輪」で、1日1つの出来事や気持ちを残す交換日記です。',
    stores: [{ label: 'App Store', url: 'https://apps.apple.com/jp/app/id6772677155' }],
  },
  {
    name: 'AirTalks',
    tagline: 'オフライン近距離チャット',
    icon: '/app-icons/airtalks.svg',
    description:
      'インターネットもアカウントも不要。端末間の直接通信で近くの相手と会話し、終了すると履歴が残らないメモリ内設計の近距離チャットです。',
    stores: [{ label: 'App Store', url: 'https://apps.apple.com/jp/app/id6760606408' }],
  },
  {
    name: 'Patto',
    tagline: '在庫管理・買い物リスト',
    icon: '/app-icons/patto.svg',
    description:
      '食品・日用品の在庫を家族で共有し、切らしたものを買い物リストへ自動でまとめるアプリ。バーコード登録やウィジェットにも対応しています。',
    stores: [
      { label: 'App Store', url: 'https://apps.apple.com/jp/app/id6760470920' },
      { label: 'Google Play', url: 'https://play.google.com/store/apps/details?id=com.yuuki.patto' },
    ],
  },
  {
    name: '髪型チェッカー',
    tagline: 'AI髪型シミュレーション',
    icon: '/app-icons/kamigata-checker.svg',
    description:
      '切る前に、気になる髪型を自分の写真で試せるアプリ。83種類のヘアスタイルから選んでAI画像を作り、Before / Afterで比べられます。美容室で見せられるオーダーカード付き。',
    stores: [{ label: 'App Store', url: 'https://apps.apple.com/jp/app/id6783818588' }],
  },
];

export const otherAppNames = ['まちかどマート', '盤上召喚', 'マチアカリ', 'いきもの列島', 'Cootap', '未来ベビー'];
