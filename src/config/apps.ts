export type StoreLink = {
  label: string;
  url: string;
};

export type AppItem = {
  name: string;
  mark: string;
  accent: string;
  description: string;
  stores: StoreLink[];
};

export const apps: AppItem[] = [
  {
    name: 'Respo',
    mark: 'R',
    accent: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200',
    description: '食事と運動の記録。自分がきれいに挫折したので作りました。',
    stores: [
      { label: 'App Store', url: 'https://apps.apple.com/jp/app/id6759490486' },
      { label: 'Google Play', url: 'https://play.google.com/store/apps/details?id=com.yuukikawabata.respo' },
    ],
  },
  {
    name: 'Atode',
    mark: 'A',
    accent: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
    description: '増えるだけのスクショを、OCRとAIで「あとでやる」に変えます。',
    stores: [{ label: 'App Store', url: 'https://apps.apple.com/jp/app/id6778453895' }],
  },
  {
    name: 'HitoLog',
    mark: '人',
    accent: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
    description: 'AIがよく喋る時代に、あえて人間の言葉を残すSNSです。',
    stores: [{ label: 'App Store', url: 'https://apps.apple.com/jp/app/id6772677155' }],
  },
  {
    name: 'AirTalks',
    mark: '↔',
    accent: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200',
    description: 'ネットも履歴もいらない、その場限りのチャット。潔く消えます。',
    stores: [{ label: 'App Store', url: 'https://apps.apple.com/jp/app/id6760606408' }],
  },
  {
    name: 'Patto',
    mark: 'P',
    accent: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    description: '在庫と買い物をパッと管理。名前を決めた時点では自信満々でした。',
    stores: [
      { label: 'App Store', url: 'https://apps.apple.com/jp/app/id6760470920' },
      { label: 'Google Play', url: 'https://play.google.com/store/apps/details?id=com.yuuki.patto' },
    ],
  },
  {
    name: '髪型チェッカー',
    mark: '髪',
    accent: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
    description: '切ってから後悔する前に、髪型を先に試すアプリです。',
    stores: [{ label: 'App Store', url: 'https://apps.apple.com/jp/app/id6783818588' }],
  },
  {
    name: '未来ベビー',
    mark: '未',
    accent: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    description: 'AIで未来をちょっと想像する画像生成アプリ。結果は未来までのお楽しみ。',
    stores: [{ label: 'App Store', url: 'https://apps.apple.com/jp/app/id6786303465' }],
  },
  {
    name: 'VocabBoost',
    mark: 'V',
    accent: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
    description: '英単語を覚えるAndroidアプリ。作者の英語力も一緒にBoost中です。',
    stores: [{ label: 'Google Play', url: 'https://play.google.com/store/apps/details?id=com.yuuki.ja.vocabboost' }],
  },
];
