# PHASE_NOTES

## P0 — Scaffold (2026-07-15)

### Ne yapıldı
- Vite 5 + React 18 + TypeScript (strict, ayrıca `noUncheckedIndexedAccess`) + Tailwind 3.4 iskeleti kuruldu; bağımlılıklar §5 kapalı listesinden, P0'da gerekmeyenler (Dexie, Recharts, date-fns, Vitest) kendi fazlarında eklenecek.
- "Modern Bakkal Defteri" renk token'ları `src/styles/tokens.css` içinde CSS değişkeni olarak tanımlandı; Tailwind tüm renkleri `var()` üzerinden okuyor. Tip ölçeği (13/15/17/22/28/40), radius ve gölge kuralları (§11.3) Tailwind config'de.
- Fontlar self-hosted (`@fontsource`): Fraunces 600/700, IBM Plex Sans 400/500/600, IBM Plex Mono 500. Latin-ext alt kümeleri pakete girdiği için Türkçe glifler (ğüşiİıçö) CDN'siz çalışıyor.
- Uygulama kabuğu: react-router-dom 6 ile 4 tab rotası (`/`, `/islemler`, `/butce`, `/icgoru`) + `/ayarlar`; alt tab bar, ortada 56px tükenmez-mavisi FAB placeholder'ı; tüm UI metinleri `src/i18n/tr.ts`te.
- Tema değiştirme (Sistem/Açık/Koyu) Ayarlar'da çalışıyor; `vite-plugin-pwa` config'i (manifest, `theme_color`, precache glob'unda woff2) + placeholder ikonlar ("d" + kırmızı alt çizgi) hazır. `npm run build` temiz geçiyor, service worker üretiliyor.

### Teknik kararlar (ve nedenleri)
1. **Tema `data-theme` attribute'u ile, Zustand persist + `index.html` içinde pre-paint inline script.** Spec §5 temayı UI state (Zustand) olarak tanımlıyor. Inline script localStorage'daki tercihi ilk boyamadan önce okuyup `<html data-theme>` yazıyor — koyu tema kullanıcısında açık tema "flash"ini engelliyor. Tailwind `darkMode: ['selector', '[data-theme="dark"]']` ile buna bağlı; ama pratikte tüm renkler CSS değişkeninden geldiği için `dark:` varyantına neredeyse hiç ihtiyaç yok (tek tanım, iki tema).
2. **Renkler Tailwind'e sabit hex olarak değil `var(--token)` olarak verildi.** Böylece tema geçişi tek yerden (tokens.css) yönetiliyor; ileride bir rengi düzeltmek component taraması gerektirmiyor. `.font-mono`'ya global `tabular-nums` eklendi — P4 "sayılar kutsaldır" ilkesinin altyapısı.
3. **PWA ikonları şimdilik programatik placeholder** (System.Drawing ile üretilmiş "d" + kırmızı çizgi; Fraunces yerine Georgia). Gerçek Fraunces tabanlı ikon P7 cilasında. Not: precache şu an fontların tüm alt kümelerini (kiril/yunan/vietnam, ~634 KB) içeriyor; P7'de sadece latin+latin-ext'e daraltılabilir.

### Belirsizlik notları (§0.7)
- Spec commit istiyor ama klasör git deposu değildi → `git init` yapıldı, depo-yerel kimlik olarak "Selim" + iCloud e-postan ayarlandı. Yanlışsa söyle, düzeltirim.
- ESLint/Prettier §5 listesinde yok → eklenmedi; tip güvenliği TS strict'e emanet.

### Elle doğrulama (tarayıcıda)
1. `npm run dev` → `http://localhost:5173` aç. Alt bardaki 4 sekmeye (Özet, İşlemler, Bütçe, İçgörü) tıkla — her biri kendi başlığını göstermeli, aktif sekme mavi olmalı. Ortadaki `+` butonu görünmeli (henüz işlevsiz — P2).
2. Özet'in sağ üstündeki dişliden Ayarlar'a gir, temayı "Koyu" yap — tüm ekran "Gece Defteri" paletine dönmeli. Sayfayı yenile: koyu tema açılışta beyaz parlama olmadan gelmeli. "Sistem"e alıp Windows temasını değiştirerek de sınayabilirsin.
3. Özet'teki kare kağıt dokulu kartta `₺0,00` mono fontta, başlıklar Fraunces'ta görünmeli; sekme adlarındaki `İ/ü/ç/ö` glifleri (İşlemler, Bütçe, İçgörü) bozulmadan render olmalı. (İstersen `npm run build && npm run preview` ile PWA build'ini de aç.)

**DURDUM — P1 (Data core) için onayını bekliyorum.** ✅ Onaylandı.

---

## P1 — Data core (2026-07-15)

### Ne yapıldı
- §7'deki otoriter veri modeli `src/db/types.ts`te bire bir; Dexie v1 şeması 11 store ve spec'teki indekslerle (`transactions: date, categoryId, [type+date], necessity`; `savingsEntries: goalId, date`) kuruldu.
- İlk açılışta seed: 12 gider + 3 gelir varsayılan kategorisi (8'li sessiz palet renkleriyle), 🏦 Genel Kumbara ve settings singleton'ı — Dexie `populate` event'i içinde, yani tekrarlanması yapısal olarak imkânsız.
- Repository katmanı başladı: `repo/settings.ts` (get/update), `repo/categories.ts` (aktif liste), `repo/savings.ts` (hedef oluştur/listele). Component'ler tabloya doğrudan dokunmuyor (§6).
- `lib/money.ts` (formatla/kompakt formatla/Türkçe girdi ayrıştır) ve `lib/fiscal.ts` (`getMonthKey`, `getMonthRange`, `getDaysRemaining`) saf fonksiyonlar olarak yazıldı; **20 unit test yeşil** — startDay 1/15/28, artık yıl Şubat'ı, yıl sınırı, kenetleme (clamp) senaryoları dahil.
- 4 ekranlık onboarding (konsept → maaş günü 1–28 → isteğe bağlı gelir → Kumbara starter), her adımda atlanabilir; bitişte settings yazılıyor. IndexedDB açılamazsa (gizli pencere) engelleyici dostane bildirim gösteriliyor (§13).

### Teknik kararlar (ve nedenleri)
1. **Seed `db.on('populate')` içinde.** Populate yalnızca veritabanı ilk yaratıldığında, aynı transaction'da çalışır — "kategoriler boş mu?" kontrolü gibi yarış koşuluna açık bir yaklaşıma gerek kalmadı, idempotentlik bedava.
2. **Primitif tip takma adları (`Minor`, `ISODate`, `MonthKey`…) `src/lib/types.ts`te.** `lib/` saf kalmalı (§6, React/Dexie import'u yasak); db katmanı tipleri lib'den alıyor, tersi asla. Tek kaynak, sıfır çakışma.
3. **Onboarding sonrası yönlendirme yok.** Layout, settings'i `useLiveQuery` ile izliyor; `onboardingDone: true` yazıldığı anda kabuk kendiliğinden render oluyor. Ayrıca tema tercihi canlı olarak Zustand'da (§5) ama settings satırına da aynalanıyor ki dışa aktarım (§14) tam olsun.
4. **Fiscal ay anahtarı = ayın *başladığı* takvim ayı.** `startDay=15` iken `2026-08-14` → `"2026-07"`. Aralıklar bitişik ve boşluksuz: bir sonraki başlangıç bağımsız kenetleniyor (31 → Şubat'ta 28'e), testlerle sabitlendi.

### Elle doğrulama (tarayıcıda)
1. `npm run dev` → önce onboarding gelmeli (uygulama kabuğu değil). 4 adımı gez: maaş günü seç (örn. 15), gelir gir (örn. `45.000`), istersen bir hedef ekle, bitir → sekmeli kabuk açılmalı. Sayfayı yenile: onboarding bir daha **gelmemeli**.
2. DevTools → Application → IndexedDB → `denge`: `categories`te 15 kayıt (12 gider + 3 gelir), `savingsGoals`ta Genel Kumbara (+ eklediysen hedefin), `settings`te `monthStartDay` seçtiğin gün ve `monthlyNetIncomeMinor` kuruş cinsinden (45.000 → 4500000) görünmeli.
3. `npm test` → 20 test yeşil. Sıfırdan denemek için: DevTools → Application → Storage → IndexedDB'yi sil (`denge`) + Local Storage'daki `denge-ui`yi bırakabilirsin, yenile → onboarding baştan gelir.

**DURDUM — P2 (Transactions) için onayını bekliyorum.**
