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
  onboarding: {
    concept:
      'Denge parayı ve anlamı birlikte sayar. Her harcamaya bir etiket: Gerekli, İstek, Boş. Pazar günü kısa bir hesaplaşma, vazgeçtiklerin kumbaraya. Yargı yok — sadece dürüstlük.',
    start: 'Başla',
    skip: 'Atla',
    next: 'Devam',
    back: 'Geri',
    salaryDayTitle: 'Maaş günün hangi gün?',
    salaryDayHint:
      'Bütçe ayı o gün başlar, sonraki ayın bir gün öncesinde biter. Sonradan değiştirebilirsin.',
    incomeTitle: 'Aylık net gelirin?',
    incomeOptional: 'İsteğe bağlı',
    incomeHint:
      'Güne düşen harcama payını hesaplamak için kullanılır. Boş bırakabilirsin.',
    incomePlaceholder: '0,00',
    invalidAmount: 'Tutar geçersiz.',
    kumbaraTitle: 'İlk hedefini koy (istersen sonra)',
    kumbaraHint:
      '🏦 Genel Kumbara hazır. İstersen şimdi adı ve hedefi olan bir kumbara daha aç.',
    goalNameLabel: 'Hedef adı',
    goalNamePlaceholder: 'Örn. Yeni gitar',
    goalTargetLabel: 'Hedef tutar (₺)',
    finish: 'Bitir',
    addGoalAndFinish: 'Hedefi ekle ve bitir',
  },
  errors: {
    dbUnavailable:
      'Denge bu tarayıcıda veri saklayamıyor. Gizli pencerede olabilirsin — normal bir pencerede tekrar dene.',
  },
} as const;
