// All user-facing strings live here (spec §0.6, §12).
// Never hardcode Turkish text in components.

export const tr = {
  app: {
    name: 'Denge',
    tagline: 'Paranla aranı düzelt.',
  },
  tabs: {
    ozet: 'Özet',
    islemler: 'İşlemler',
    butce: 'Bütçe',
    icgoru: 'İçgörü',
  },
  common: {
    settings: 'Ayarlar',
    comingSoon: 'Yakında', // placeholder screens during scaffolding phases
    addTransaction: 'İşlem ekle',
  },
  settings: {
    title: 'Ayarlar',
    theme: 'Tema',
    themeLight: 'Açık',
    themeDark: 'Koyu',
    themeSystem: 'Sistem',
  },
} as const;
