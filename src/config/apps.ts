export type StoreLink = {
  label: string;
  url: string;
};

export type AppItem = {
  name: string;
  icon: string;
  description: string;
  stores: StoreLink[];
};

export const apps: AppItem[] = [
  {
    name: 'Respo',
    icon: '/app-icons/respo.png',
    description: '食事と運動の記録。自分がきれいに挫折したので作りました。',
    stores: [
      { label: 'App Store', url: 'https://apps.apple.com/jp/app/id6759490486' },
      { label: 'Google Play', url: 'https://play.google.com/store/apps/details?id=com.yuukikawabata.respo' },
    ],
  },
  {
    name: 'Atode',
    icon: '/app-icons/atode.png',
    description: '増えるだけのスクショを、OCRとAIで「あとでやる」に変えます。',
    stores: [{ label: 'App Store', url: 'https://apps.apple.com/jp/app/id6778453895' }],
  },
  {
    name: 'HitoLog',
    icon: '/app-icons/hitolog.png',
    description: 'AIがよく喋る時代に、あえて人間の言葉を残すSNSです。',
    stores: [{ label: 'App Store', url: 'https://apps.apple.com/jp/app/id6772677155' }],
  },
  {
    name: 'AirTalks',
    icon: '/app-icons/airtalks.png',
    description: 'ネットも履歴もいらない、その場限りのチャット。潔く消えます。',
    stores: [{ label: 'App Store', url: 'https://apps.apple.com/jp/app/id6760606408' }],
  },
  {
    name: 'Patto',
    icon: '/app-icons/patto.png',
    description: '在庫と買い物をパッと管理。名前を決めた時点では自信満々でした。',
    stores: [
      { label: 'App Store', url: 'https://apps.apple.com/jp/app/id6760470920' },
      { label: 'Google Play', url: 'https://play.google.com/store/apps/details?id=com.yuuki.patto' },
    ],
  },
  {
    name: '髪型チェッカー',
    icon: '/app-icons/hairstyle-checker.png',
    description: '切ってから後悔する前に、髪型を先に試すアプリです。',
    stores: [{ label: 'App Store', url: 'https://apps.apple.com/jp/app/id6783818588' }],
  },
  {
    name: '未来ベビー',
    icon: '/app-icons/future-baby.png',
    description: 'AIで未来をちょっと想像する画像生成アプリ。結果は未来までのお楽しみ。',
    stores: [{ label: 'App Store', url: 'https://apps.apple.com/jp/app/id6786303465' }],
  },
  {
    name: 'MimaCam',
    icon: '/app-icons/mimacam.png',
    description: '使っていないiPhoneを、もう1台の見守りカメラに。ライブ映像も通知も手元から確認できます。',
    stores: [{ label: 'App Store', url: 'https://apps.apple.com/jp/app/id6789361362' }],
  },
  {
    name: 'Cootap',
    icon: '/app-icons/cootap.png',
    description: '授乳・睡眠・おむつをiPhoneとApple Watchでサッと記録。広告なしの育児ログです。',
    stores: [{ label: 'App Store', url: 'https://apps.apple.com/jp/app/id6801787210' }],
  },
];
