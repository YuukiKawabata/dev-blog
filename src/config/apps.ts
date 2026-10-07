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
export const publishedAppCount = 10;

export const developerPage = 'https://apps.apple.com/jp/developer/yuuki-kawabata/id1865457350';

// トップに載せるのは数本だけ。残りは otherAppNames として名前だけ出し、App Storeの一覧へ誘導する。
export const apps: AppItem[] = [
  {
    name: 'Koyori',
    tagline: '1日1分の健康記録',
    icon: '/app-icons/koyori.png',
    description:
      '食事・睡眠・運動・気分を、1日1分でひとつに。Respoとして出したアプリを、名前も見た目も作り直しました。',
    stores: [
      { label: 'App Store', url: 'https://apps.apple.com/jp/app/id6759490486' },
      { label: 'Google Play', url: 'https://play.google.com/store/apps/details?id=com.yuukikawabata.respo' },
    ],
    lead: true,
    badge: 'いちばん力を入れているアプリ',
    story: { label: 'Respoを作った理由', url: '/blog/20260307-respo-health-app/' },
  },
  {
    name: 'Atode',
    tagline: 'スクショを予定に',
    icon: '/app-icons/atode.png',
    description: 'スクショを、予定・リマインダー・買い物リストに。2.0で「整理して終わり」をやめました。',
    stores: [{ label: 'App Store', url: 'https://apps.apple.com/jp/app/id6778453895' }],
  },
  {
    name: 'コンビニ帝国',
    tagline: '放置系コンビニ経営ゲーム',
    icon: '/app-icons/konbini-empire.png',
    description: '放置で育てるコンビニ経営ゲーム。時間帯ごとの品揃えや客足の変化まで作り込みました。',
    stores: [{ label: 'App Store', url: 'https://apps.apple.com/jp/app/id6807601218' }],
    story: { label: '10本目を出すまで', url: '/blog/20260903-tenth-app-konbini-empire/' },
  },
];

export const otherAppNames = ['HitoLog', 'AirTalks', 'Patto', 'Cootap', 'MimaCam', '髪型チェッカー', '未来ベビー'];
