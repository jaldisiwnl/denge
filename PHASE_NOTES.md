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

**DURDUM — P2 (Transactions) için onayını bekliyorum.** ✅ Onaylandı (üç-şapkalı gözden geçirme sonrası).

---

## P1 gözden geçirme düzeltmeleri (2026-07-15)
Onay öncesi mühendis/finansçı/değerlendirmeci gözden geçirmesinde bulunanlar:
- **`recurringRules.isActive` indeksi kaldırıldı** (Dexie şema v2): IndexedDB boolean'ı anahtar olarak desteklemez; indeks hiç çalışmayacak, P3'te sorgu patlatacaktı. Az sayıda kural JS'te filtrelenecek.
- **`parseAmountMinor` sıkılaştırıldı:** nokta artık yalnızca 3'lü binlik gruplamada geçerli. `"1.5"` girdisi ₺15'e dönüşmek yerine reddediliyor — para uygulamasında 10 kat hata kabul edilemez.
- **`formatCompactMinor` eşik yuvarlaması:** ₺999.950 artık "₺1.000 B" değil "₺1 Mn".
- **Onboarding "Atla" tutarlılığı:** her Atla tam bir adım ilerletiyor; yalnızca son ekran bitiriyor.
- **`.gitattributes`** eklendi (LF normalize), CRLF uyarıları sustu.

---

## P2 — Transactions (2026-07-15)

### Ne yapıldı
- **Hızlı ekleme sheet'i (§9.1):** FAB → tam ekran sheet; özel numpad (OS klavyesi açılmaz, virgül tuşu, canlı binlik gruplama), son 90 günün kullanım sıklığına göre sıralı kategori çipleri, zorunlu Bilinç etiketi (Gerekli/İstek/Boş, seçilmeden Kaydet pasif), katlanır Detay (not, mekân, tarih, ruh hali çipleri), Gider|Gelir geçişi. Kaydet → mono tutarlı toast.
- **Kısayollar (§9.14):** sheet'in tepesinde yatay çip sırası — tek dokunuş anında kaydeder (bugünün tarihi, usageCount artar), uzun basış sheet'i önceden doldurur. Ayarlar'da tam CRUD + yukarı/aşağı sıralama (max 10). İşlem detayından "Kısayol yap".
- **İşlem listesi (§9.3):** güne göre gruplama (Bugün/Dün/"8 Temmuz Salı"), gün net alt toplamı mono, yapışkan filtre çubuğu (mali ay gezgini ‹ ›, kategori, bilinç, not+mekân araması Türkçe küçük harf duyarlı), satırda emoji + bilinç noktası + tutar (gelir yeşil/+, pişman üstü çizili).
- **Detay düzenleme:** satıra dokun → aynı sheet düzenleme kipinde; tüm alanlar değiştirilebilir, iki aşamalı Sil onayı. Review dışı etiket değişikliği `necessityRevisedAt` yazar ve `regret/reviewedAt` temizler (§9.2); `necessityOriginal` ilk kayıtta donar, bir daha değişmez.
- **Kategori yöneticisi (§9.4):** ekle/düzenle/sırala/arşivle; işlemi olan kategori silinemez — Arşivle ya da "Taşı ve arşivle" (işlemler hedefe taşınır, kategori arşive iner). Arşivli kategorinin kısayolları quick-add sırasından gizlenir (silinmez).

### Teknik kararlar (ve nedenleri)
1. **Tek sheet, iki kip:** hızlı ekleme ve işlem detayı aynı `QuickAddSheet` — düzenlemede tip sabitlenir, Kısayollar sırası gizlenir, Sil/Kısayol-yap eklenir. İki ayrı form tutmak alan eşitliğini (ve §9.2 kurallarını) iki yerde yaşatmak demekti.
2. **Dürüstlük kuralları repo katmanında** (`updateTransaction`): etiket değişince revizyon damgası + regret temizliği UI'da değil veri katmanında — hangi ekran düzenlerse düzenlesin kural atlanamaz. P5'teki review akışı kendi özel yolunu kullanacak.
3. **Kısayol sıralaması:** tüm `sortOrder`lar 0 iken kullanım sayısı belirler; kullanıcı ilk kez sıralayınca herkese kalıcı 1..n yazılır ve manuel sıra kazanır (§9.14'ün "manual wins" kuralının en yalın hali).
4. **İki aşamalı sil onayı** (buton "Emin misin? Sil"e dönüşür): ayrı bir dialog bileşeni ve fazladan dokunma katmanı yerine — mobilde daha hızlı, yanlışlıkla silmeye karşı yeterli.

### Belirsizlik notları (§0.7)
- Gün alt toplamı "day subtotal" net olarak yorumlandı: gelir − gider (gelir yoksa negatif görünür).
- Pişman tutarındaki çizgi şimdilik düz CSS `line-through`; elle çizilmiş `<RedPen strike>` P4'te tasarım sistemi bileşeni olarak gelecek (§11.5).
- Kategori sıralaması yukarı/aşağı oklarla (sürükle-bırak spec'te zorunlu değil, en yalın yorum).

### Elle doğrulama (tarayıcıda)
1. **5 saniye yolu:** FAB → rakamlar → kategori çipi → Boş → Kaydet. Toast'ta mono tutar görünmeli, İşlemler listesinde satır anında belirmeli (useLiveQuery). Tutar girmeden Kaydet → "Tutar boş olamaz."; Bilinç seçmeden buton pasif olmalı.
2. **Kısayol:** bir işleme dokun → "Kısayol yap" → FAB'ı tekrar aç: çip en üstte. Çipe dokun → sheet kapanıp anında kayıt + toast (1 dokunuş). Uzun bas → form dolu gelmeli. Ayarlar → Kısayollar'dan sırala/düzenle/sil.
3. **Dürüstlük kuralı:** bir gider ekle (İstek), sonra detayından etiketi Boş yap → DevTools'ta o kaydın `necessityOriginal: "istek"` kalmalı, `necessityRevisedAt` dolmalı. Filtrelerde Boş'u seç, arama kutusuna not/mekân yaz — liste daralmalı; ay okuyla önceki aya git — boş durum metni gelmeli.

**DURDUM — P3 (Budgets & recurring) için onayını bekliyorum.** ✅ Onaylandı.

---

## P3 — Budgets & recurring (2026-07-15)

### Ne yapıldı
- **Zarflar (§9.5):** kategori başına aylık zarf + "Bu aya özel" override + devir; kart başına ilerleme çubuğu (aşımda kırmızı), kalan/aşılan satırı, `+₺X devir` çipi; başlıkta toplam bütçe / harcanan / Güne düşen. Zarf yokken "Zarfları hazırla" — son 3 ayın medyanından toplu öneri. Düzenleme sheet'inde medyan öneri çipi.
- **Sabitler (§9.6):** kural listesi (sıradaki tarih hesaplı), Abonelikler alt bölümü aylık toplam + **Yıllık Şok** satırı + satır başına yıllık maliyet; kural sheet'i (aylık/haftalık/yıllık kadans kontrolleri, abonelik/otomatik yaz/aktif anahtarları, varsayılan bilinç etiketi).
- **Yineleme motoru (§8.7):** saf `dueDates` penceresi `(lastPostedDate, bugün]` — idempotentlik yapıdan geliyor; 29–31 ay sonuna kenetlenir (artık yıl Şubat'ı testli). Açılışta + pencere odağında `postDueRecurring` tek Dexie transaction'ında yazar. Otomatik olmayan kurallar dashboard'da **Bekleyen sabitler** kartı: `Onayla | Bu ay atla` (oluşum oluşum ilerler).
- **Canlı zarf satırı (§9.1.4):** quick-add'de kategori seçilince `"Yemek zarfında ₺180 kaldı"`; yazılan rakamla birlikte anlık güncellenir, aşım durumunda kırmızı `"Bu harcamayla zarf ₺45 aşılır"`. Bilgilendirir, asla engellemez.
- **Kırmızı Kalem (§11.5):** elle çizilmiş `<RedPen>` bileşeni (circle/strike), 400ms draw-in, reduced-motion'da statik. Aşılan zarf toplamında circle; listedeki pişman tutarlarında P2'deki düz çizginin yerine strike.
- 39 test yeşil (recurrence 10, budget 5 yeni), build temiz.

### Teknik kararlar (ve nedenleri)
1. **`lastPostedDate` kural oluşturulurken "dün" olarak tohumlanıyor.** §7'de kuralın `createdAt`i yok; pencere alt sınırı hep tanımlı olsun ve bugün vadesi gelen kural hemen yazılsın ama geçmişe dönük doldurma asla olmasın diye. Motor böylece spec'teki `(lastPostedDate, today]` sözleşmesine hiç istisnasız uyuyor.
2. **Devir bir seviye derin:** bu ayın devri = geçen ayın *taban* zarfı (override ?? varsayılan) − harcaması, negatifse 0. Zincirleme (devrin devri) bilerek yok — uzun boşluklarda şişen gerçekdışı zarfları önlüyor. (§0.7 en yalın yorum; kodda belgeli.)
3. **Bekleyen onaylar oluşum-bazlı ilerliyor:** kaçırılmış 3 ay varsa kartlar en eskiden başlayarak tek tek gelir; Onayla/Atla her seferinde `lastPostedDate`i bir oluşum ilerletir. Tek "hepsini onayla" düğmesinden daha fazla dokunuş ama her kayıt bilinçli — uygulamanın ruhuna uygun.
4. **Zarf önerisi sıfır harcamalı ayları yok sayan medyan** — 1 aylık geçmişte [X,0,0] medyanının 0 çıkıp öneriyi işe yaramaz kılmasını önlüyor (testli).

### Belirsizlik notları (§0.7)
- Otomatik yazılan işlemde kural adı `merchant` alanına yazılıyor (listede "Spotify" okunaklı dursun diye).
- Canlı zarf satırı yalnızca yeni kayıt kipinde (düzenlemede işlemin kendisi harcanmışın içinde olduğundan kalan hesabı yanıltıcı olurdu).
- Kumbara segmenti P5'te eklenecek; şimdilik Bütçe'de iki segment var.

### Elle doğrulama (tarayıcıda)
1. **Zarf + canlı satır:** Bütçe → Zarflar → bir kategoriye zarf koy (örn. Yemek ₺2.000). FAB'ı aç, o kategoriyi seç → altta "zarfında ₺X kaldı" görünmeli; zarfı aşan bir tutar yaz → satır kırmızıya dönüp "aşılır" demeli. Kaydet; Bütçe'de ilerleme çubuğu dolmalı. Zarfı aşarsan toplamın etrafında kırmızı kalem halkası çizilmeli.
2. **İdempotent otomatik kayıt:** Sabitler'den bugün günlü aylık bir kural ekle (Otomatik yaz açık) → kaydedince işlem listesinde belirmeli. Sayfayı 2–3 kez yenile, sekmeden çıkıp geri gel → **kopya oluşmamalı**. DevTools'ta kuralın `lastPostedDate`i bugün olmalı.
3. **Bekleyen onay:** "Otomatik yaz" kapalı bir kural ekle (günü bugün ya da geçmiş) → Özet'te "Bekleyen sabitler" kartı çıkmalı. Onayla → işlem yazılır, kart kaybolur (ya da sıradaki oluşum gelir). "Bu ay atla" → işlem yazılmadan kart kapanır.

**DURDUM — P4 (Dashboard & recovery) için onayını bekliyorum.** ✅ Onaylandı.

---

## P4 — Dashboard & recovery (2026-07-15)

### Ne yapıldı
- **Hero (§8.3 + §9.7.1):** birikim-farkındalıklı safe-to-spend — gelir (yoksa ayarlardaki net gelir), zarf toplamı tavanı, sabit giderler (yazılan + ay içinde kalan), değişken harcama ve kumbara mevduatı düşülür; `Kalan` 600ms count-up ile, altında `Güne düşen`, ince tempo çubuğu (dolgu = harcama oranı, çentik = geçen zaman oranı; harcama zamanın önündeyse kırmızı). Negatif kalan kırmızı kalem halkasında.
- **Grafikler (§9.7.5-7):** kategori donut'u (ilk 6 + Diğer, ortada toplam, dilime dokun → filtreli liste) + erişilebilir eş liste; 6 aylık eğilim çubukları (boş payı kırmızı katman); özel SVG ısı haritası (5 kademeli tükenmez yoğunluğu, boş içeren günlerde kırmızı köşe, geri doldurulan günler %60 opaklık, güne dokun → o günün listesi).
- **Seri kartı (§8.5):** 🔥 güncel + en iyi seri; lapse varken `⏸ Seri duraklatıldı…`; 3/7/14/30 kilometre taşlarında fosforlu süpürme animasyonlu toast (her seri başlangıcı için bir kez, uiFlags ile).
- **Boşluk affı (§8.8 + §9.15):** `findGaps/detectLapse` saf fonksiyonları (≥3 gün, otomatik kayıtlar aktivite sayılmaz, kısmi doldurma boşluğu küçültür); sıcak kart her zaman diğer bekleyenlerin üstünde, kırmızısız. `Boşluğu doldur` → gün gün stepper (Kısayol çipleri + mini form + "Harcama yoktu" + "Hatırlamıyorum", son 14 günle sınırlı §17); `Boş ver` → kart kapanır, quick-add bugüne açılır, seri matematiği bozulmaz.
- 61 test yeşil (lapse 10, streak 6, safe-to-spend 6 yeni); Dexie v3 (`uiFlags`); Recharts eklendi.

### Teknik kararlar (ve nedenleri)
1. **Spec'in §8.3 formülünde düzeltme (belgeli):** formül yalnızca `fixedRemaining` düşüyor ama `spentVariable` otomatik yazılanları dışlıyor — kural yazıldığı an `available` sıçrardı. Yazılan + kalan sabitlerin ikisini de düşüyorum; sayı ay boyunca kararlı ve liste toplamlarıyla mutabık (testle sabitlendi).
2. **`uiFlags` Dexie v3 store'u (spec §8.8'in açıkça izin verdiği seçenek):** temiz gün işaretleri (`cleanDay:`), kapatılan boşluklar (`gapDismissed:`) ve kutlanan kilometre taşları (`streakCelebrated:`) — §7 veri modelini kirletmeden, dışa aktarımın dışında kalabilecek hafif bayraklar.
3. **Duraklatma kümesi tüm boşluklardan türetiliyor** (kapatılanlar dahil): yalnızca gerçek veri (geri doldurma / temiz gün işareti) günü aktiviteye çevirip duraklamayı kaldırır — spec'in "only actual backfilled data un-pauses" kuralı, ayrı bir durum makinesi olmadan kümeler üzerinden kendiliğinden sağlanıyor.
4. **Grafik renkleri CSS class üzerinden** (`--ballpoint`/`--redpen` değişkenleri): SVG öznitelikleri `var()` çözmediği için Recharts elemanlarına class verildi — tema değişince grafikler de anında döner.

### Belirsizlik notları (§0.7)
- Stepper'daki mini form gider-odaklı (boşluktaki maaş vb. zaten yineleme motorunca yazılıyor).
- Bundle Recharts ile 828 KB'a çıktı (gzip 243 KB) — P7'de code-splitting/manualChunks planlandı.

### Elle doğrulama (tarayıcıda)
1. **Mutabakat:** Özet'teki donut toplamı ve gün karesine dokununca açılan liste, İşlemler sekmesindeki aynı ayın toplamlarıyla birebir tutmalı. Hero'daki `Kalan`, gelir − sabitler − harcama − kumbara hesabına uymalı (zarf varsa tavan).
2. **5 günlük boşluk (AC):** DevTools → IndexedDB → transactions'ta en son manuel işlemin tarihini 6 gün öncesine çek (ya da 6 gün önceye tarihli tek işlem bırak), sayfayı yenile → "X gündür yazmadın…" kartı gelmeli, seri kartı ⏸ göstermeli. `Boşluğu doldur` → her gün için Kısayol/mini form/"Harcama yoktu" seç; bitince kart kapanmalı, "Harcama yoktu" dediğin günler seriyi geri büyütmeli, doldurulan günler ısı haritasında soluk görünmeli.
3. **Boş ver yolu:** kartı tekrar tetikleyip `Boş ver, bugünden devam` de → kart kaybolur, quick-add bugüne açılır; seri, boşluk öncesi değerinden devam eder (boşluk günleri sayılmaz ama seri sıfırlanmaz).

---

## P3/P4 gözden geçirme düzeltmeleri (2026-07-15)
Finansçı + kullanıcı şapkalı gözden geçirme sonrası:
- **Boşluk kapatması artık aralık kapsaması:** kısmi geri doldurma boşluğu böldüğünde kalan parçalar, kapatılmış aralığın içindeyse çözülmüş sayılıyor — kart, akış biter bitmez geri gelmiyor. Sessizlik kapatılan aralığın ötesine uzarsa kart haklı olarak geri döner (ikisi de testli).
- **Duraklatılan sabit kural yeniden açılınca geçmişi doldurmuyor:** pasif→aktif geçişinde `lastPostedDate` düne çekiliyor; üyelik duraklatıp açan kullanıcı aylarca hayalet gider görmüyor.
- **Donut'ta grafik içi benzersiz renk garantisi** (P1 değerlendirmesinde verilen söz): palet sarmalarında çakışan dilim, kullanılmayan palet rengine atanıyor.
- **Gelir verisi hiç yokken zarflar bütçe tavanı sayılıyor** (belgeli §0.7 sapması): `min(0, zarflar) = 0` yüzünden anlamsız negatif `Kalan` gösterilmiyor; gelir girilince spec formülü aynen devreye giriyor (testli).
- **Tutarlılık:** ay gezgini tek-gün filtresini temizliyor; eğilim ve ısı haritası toplamları ileri tarihli işlemleri donut gibi hariç tutuyor.
- **P7'ye notlar:** arşivli kategorili kural/şablon düzenlemede select'in yanıltıcı görünümü; ısı haritası hücrelerine klavye erişimi; Recharts kaynaklı bundle büyümesi (code-splitting).

**DURDUM — P5 (Bilinç suite & Kumbara) için onayını bekliyorum.** ✅ Onaylandı.

---

## P5 — Bilinç suite & Kumbara (2026-07-15)

### Ne yapıldı
- **Pazar Muhasebesi (§9.8):** Özet'te rozet kartı ("… {N} kalem seni bekliyor"), tam ekran akış — kart başına Adım A (etiket doğru mu? — akış içi yeniden etiketleme regret'i silmez; Gerekli'ye çekilen kalem teşekkürle atlanır ve emeklur) + Adım B ("Buna değdi mi?" → Değdi/Eh/Pişman, Sonra ile atlanabilir). Özet ekranı havuç-önce: En çok değen → pişmanlık özeti + en pişman kategori + kuru-ama-nazik satır → istek→boş dürüstlük alkışı.
- **Soğuma Listesi (§9.9):** /islemler artık İşlemler | Soğuma segmentli. Ekleme sheet'i (başlık, tahmini fiyat, URL, not, 24/48/72sa/1hf bekleme), geri sayım halkası, süresi dolunca "Hâlâ istiyor musun?" → **Al** (quick-add tahmini tutar + başlıkla dolu açılır, kayıt işleme bağlanır) / **Vazgeç** → anında "₺X'i kurtardın. Kumbaraya atalım mı?" sheet'i — tek hedefte tek dokunuş, `SavingsEntry(source: vazgecme)` + çift yönlü bağlantı. Başlıkta iki sayaç: fosforlu "Vazgeçerek kurtardın: ₺X" + altta "₺Y'si gerçekten kumbarada."
- **Kumbara segmenti (§9.13):** hedef kartları (ilerleme, hedef tamamsa yeşil + 🎉 rozeti, son tarih çipi, ≥2 ay veriyle "Bu hızla: Kasım 2026" projeksiyonu), hedef ekle/düzenle/arşivle (silme yok — §17), hedef detayı: hareket listesi (kaynak rozetleri; vazgeçme girişleri istek başlığını taşır — paranın hikâyesi), Para ekle / Para çek (iki aşamalı onay, sıfır altı engelli). Özet'e Kumbara kartı: toplam + "Bu ay +₺X" + 6 aylık kümülatif sparkline; ilk hareket öncesi ince "Kumbarayı başlat" CTA'sı.
- **Zaman maliyeti (§9.10):** ayarlardan gelir + haftalık saat (+aç/kapa) → quick-add'de tutarın altında canlı "≈ 2 sa 15 dk çalışma", soğuma kartlarında da; gelir ve kumbarada asla.
- **Detayda regret:** istek/boş harcamalar detay sheet'inde de cevaplanabilir (§7) — kaçırılan haftaların kalemleri için emniyet supabı.
- 72 test yeşil (review-window 3, timecost 5 yeni).

### Teknik kararlar (ve nedenleri)
1. **Review penceresi = seçili güne biten 7 gün** (`reviewWindow` saf fonksiyonu): varsayılan Pazar'da bu tam olarak Pzt–Paz haftası — Pazar akşamı biten haftayı, sonraki günlerde de aynı haftayı gösterir; bir sonraki Pazar pencereyi devirir (testli). reviewDay değişirse kayan 7 günlük pencere olur (§0.7 en yalın yorum).
2. **İki ayrı yazım yolu:** `updateTransaction` (review dışı: etiket değişimi regret'i temizler) vs `reviewTransaction` (akış içi: aynı adımda cevaplanan regret korunur; Gerekli'ye çekiş temizler + emekli eder). Kural yine repo katmanında — UI atlatamaz.
3. **Vazgeç sayaçları iki ayrı gerçek:** üstteki sanal sayaç tahminlerin toplamı (motivasyon), alttaki gerçek `vazgecme` kaynaklı SavingsEntry toplamı (muhasebe). Bilerek eşitlenmiyor — köprünün amacı aradaki farkı görünür kılmak.
4. **Hedef tamamlama tespiti `addSavingsEntry` içinde** (öncesi < hedef ≤ sonrası): kutlama toast'ı hangi ekrandan yatırılırsa yatırılsın tetiklenir (vazgeç köprüsü dahil).

### Belirsizlik notları (§0.7)
- Bekleyen (süresi dolmamış) istekler için küçük Sil butonu eklendi (spec sessiz; yazım hatası düzeltme ihtiyacı için).
- Soğuma geri sayımları dakikada bir tazelenir; "Al" akışında bekleme süresi dolmadan satın alma yalnızca süre dolunca sunulur (spec'teki gibi).

### Elle doğrulama (tarayıcıda)
1. **Review (AC):** Geçen haftaya tarihli 2-3 İstek/Boş gider ekle (Detay'dan tarihi geçen haftaya çek) → Özet'te rozet kartı gelmeli. Akışta birini Gerekli'ye çek → "Tamam, gereğiydi" deyip kartı atlamalı; birine Pişman de → İşlemler listesinde tutarın üstünde elle çizilmiş kırmızı çizgi belirmeli. Özette "En çok değen" ve pişmanlık özetini gör.
2. **Soğuma → Kumbara köprüsü (AC):** Soğuma'ya tahmini fiyatlı bir istek ekle (bekleme 24sa seç); DevTools'ta `wishlist` kaydının `addedAt`ini 2 gün öncesine çek, yenile → "Hâlâ istiyor musun?" kartı + Özet'te rozet. Vazgeç → transfer sheet'i → Kumbaraya aktar → sayaçlar: üstte tahmin toplamı, altta kumbaradaki gerçek tutar; Kumbara segmentinde giriş "vazgeçme · <başlık>" rozetiyle görünmeli; Özet'teki `Kalan` aktarım kadar düşmeli (AC: birikim harcanabilirden düşer).
3. **Kumbara:** Bütçe → Kumbara → hedef ekle (hedefli), Para ekle ile hedefi aş → fosforlu "Hedef tamam 🎉" toast'ı; Para çek ile bakiyenin altına inmeyi dene → "Kumbara eksiye inemez." Ayarlar'dan zaman maliyetini aç (gelir + saat gir) → quick-add'de tutar yazarken "≈ … çalışma" satırı canlı güncellenmeli.

**DURDUM — P6 (İçgörüler & Ay Kapanışı) için onayını bekliyorum.** ✅ Onaylandı.

---

## P6 — İçgörüler & Ay Kapanışı (2026-07-15)

### Ne yapıldı
- **Metrikler (§8.4) `lib/stats`e eklendi:** boş oranı (güncel etiketlerle — geriye dönük dürüstlük sayılır), pişmanlık oranı (payda yalnız incelenenler), Dürtü Endeksi (50/50) + bantlar, dürüstlük sayaçları, net birikim oranı. `MonthStatsSnapshot` §7'nin istediği gibi burada tanımlandı; `MonthlyClose.stats` artık tam tipli.
- **Not motoru (§8.6) `lib/grade`:** 30/25/20/15/10 ağırlıkları, verisi olmayan bileşenin ağırlığının kalanlara oransal dağıtımı, önceki kapanış şartlı +5/+5 gelişim bonusu, 100 tavanı, harf sınırları — **7 fixture testiyle** sabit (AC ✓).
- **Ay Kapanışı (§9.12):** mali ayın son 2 gününde (ve kapatılmamış önceki ay için süresiz) Özet'te "Ayı kapat" kartı → 6 adımlı sihirbaz: özet ("Cebinde kalan"), bilinç dökümü (üçlü şerit + pişmanlık + dürüstlük), zarf performansı (aşımlarda kırmızı kalem), **birikim adımı** (önerilen devir = boşta kalan, düzenlenebilir, tek dokunuş `ayKapanisi` kaydı), gelecek ay (medyan önerili zarf düzenleme + isteğe bağlı boş limiti) ve **karne**: A–C'de kocaman Fraunces harfi + sayaçlı skor; D/F'te önce tek eyleme dönük gözlem (en büyük boş kategorisi / en çok aşan zarf / birikim / pişmanlık sırasıyla), harf sonra (no-shame ✓). Gelişim bonusu fosforlu satırla gösteriliyor; tek cümlelik not → arşiv.
- **İçgörüler (§9.11):** ay seçicili 9 kart — Dürtü kadranı + 6 aylık mini seri, 12 aylık kümülatif **birikim çizgisi** (hedef tamamlanan aya fosforlu nokta), boş oranı trendi, dürüstlük kartı (min 5), ruh hali etkisi (n≥5, n görünür), haftanın günleri (+ "zayıf gün" cümlesi), pişmanlık şampiyonları (min 3 incelenmiş), sık mekânlar, ay farkları — son ikisi ve trendler **enflasyon dipnotlu**; dashboard'daki 6 aylık eğilime de dipnot eklendi. Altta Arşiv (harf + skor + not) ve Pazar Muhasebesi geçmişi sheet'i. Verisiz kartlar sessizce gizli (AC ✓).
- 84 test yeşil (grade 7 + metrics 5 yeni), build temiz.

### Teknik kararlar (ve nedenleri)
1. **Karne kapanışta yeniden hesaplanıyor:** 4. adımdaki birikim transferi anlık `netSavingsRate`i değiştirir; "Ayı kapat"a basıldığında bağlam tazelenip donduruluyor — kullanıcının gördüğü karne, arşivlenen karne.
2. **Aksiyon cümlesi önceliği** (D/F): boş oranı ≥ %10 ve tek kategori boşun ≥ %30'uysa o cephe; değilse en çok aşan zarf; değilse sıfır birikim; değilse en pişman kategori — hep tek, kazanılabilir hedef (P2/P6 ilkeleri).
3. **Ruh hali kartı bilerek tüm-zaman** (§0.7 notu): aylık n'ler korelasyon için çok küçük; kart n değerlerini açıkça gösteriyor.
4. **`closableMonth` önce kapanmamış önceki ayı sunar,** sonra son-2-gün penceresindeki mevcut ayı — kaçırılan kapanış sessizce kaybolmaz.

### Elle doğrulama (tarayıcıda)
1. **Karne (AC):** Ayarlar'da maaş gününü yarına/2 gün sonrasına denk gelecek şekilde ayarla (ya da önceki aya birkaç işlem gir) → Özet'te "Ayı kapat" kartı. Sihirbazı gez: 4. adımda önerilen tutarı taşı → 6. adımda skor sayarak yükselmeli. İkinci bir ayı daha kapatınca (daha az boş / daha çok birikimle) "+X gelişim" satırı görünmeli. İçgörü → Arşiv'de harf + not listelenmeli.
2. **No-shame:** boş ağırlıklı bir ay kur (birkaç yüksek Boş gider) → kapanışta D/F: ekran önce "Boş harcamanın %X'i …" gözlemiyle açılmalı, harf ikincil ve gri.
3. **İçgörüler:** ay seçiciyle gez — verisiz aylarda kartlar kaybolmalı, tek boş-durum cümlesi kalmalı. Ruh hali kartı ancak bir duygu için ≥5 kayıt varsa çıkmalı (n görünür). Ay farkları ve boş trendi kartlarının altında enflasyon dipnotu olmalı.

---

## P5/P6 gözden geçirme düzeltmeleri (2026-07-15)
Kullanıcı + finansçı şapkalı gözden geçirme sonrası:
- **Pazar Muhasebesi akışı donmuş liste kullanıyor:** cevaplanan kalem canlı sorgudan düşünce adımlar kayıyor, son kalemde rozet kartı kaybolup akışı **özet gösterilmeden** söküyordu. Rozet artık akışı açarken listeyi donduruyor ve akış açıkken görünür kalıyor; kart etiketleri prop mutasyonu yerine yerel state'ten okunuyor.
- **Birikim çizgisindeki hedef-tamamlama noktası mali aya oturtuldu** (takvim ayı `slice(0,7)` yerine `getMonthKey`) — maaş günü 1 değilken nokta yanlış aya düşüyordu.
- **"Gelecek ay" zarf önerileri kapatılan ayı kapsıyor:** medyan penceresi kapatılan ay +1 referanslı — yeni biten ayın gerçekliği öneriye giriyor.
- **Detaydaki regret çipleri yalnız-seç:** eski davranışta seçim kaldırılınca görsel boş ama kayıt eskiyi koruyordu (dürüst olmayan görünüm).
- **Arşivlenen kumbara hedefi geri çıkarılabilir** ("Arşivden çıkar") — yanlışlıkla arşivleme tek yönlü kalmasın.
- **İçgörüler boş-durum koşulu** boş oranı trendi ve arşivi de sayıyor — kart varken "içgörü yok" yazmıyor. Kullanılmayan bir prop temizlendi.

**DURDUM — P7 (Polish & ship) için onayını bekliyorum.** ✅ Onaylandı.

---

## P7 — Polish & ship (2026-07-15)

### Ne yapıldı
- **Yedekleme (§14):** JSON dışa aktarım tüm depoların tam dökümü (`schemaVersion: 2`, `denge-yedek-YYYY-MM-DD.json`); CSV işlemleri Excel'in Türkçe yereliyle uyumlu (noktalı virgül, virgül ondalık, UTF-8 BOM). İçe aktarım v1 yedeklerini yerinde göç ettirir (eksik depolar eklenir), id bazlı upsert yapar (zaman damgalı kayıtlarda yeni kazanır, diğerlerinde gelen kazanır), uygulamadan önce **"X yeni, Y güncellenecek"** özeti + "Önce yedeği indir" seçeneği gösterir; yazım tek Dexie transaction'ında.
- **Demo seed (§18):** deterministik ~4 aylık veri — 15'inde maaş, aylık faturalar, 3 abonelik (kuralları + geçmiş kayıtları), haftalık market/yemek/ulaşım desenleri, akşam/hafta sonu ağırlıklı ruh halli boş harcamalar, 6 incelenmiş kalem (2'si dürüst istek→boş), her statüden birer soğuma kalemi (vazgeçilen kumbaraya aktarılmış), 🎸 Yeni gitar %40 dolu (üç kaynaktan), 3 kısayol, en eski ayda kısmen doldurulmuş 4 günlük boşluk ve **gerçek veriden hesaplanmış** 2 ay kapanışı (gelişim bonusu doğal oluşur). Tüm id'ler `demo-` önekli; "Demoyu temizle" yalnız onları siler, sahibin verisine dokunmaz.
- **PWA/perf:** font precache'i yalnız latin+latin-ext (41→26 girdi); `manualChunks` ile vendor/recharts ayrıştı — hiçbir chunk 500 KB'ı aşmıyor (ana chunk 185 KB); tarayıcı çubuğu rengi artık uygulama içi tema geçişini izliyor. Preview smoke: sw + manifest 200, NavigationRoute çevrimdışı fallback kayıtlı.
- **A11y:** ısı haritası hücreleri klavyeyle gezilebilir (rol/odak/Enter-Space + görünür odak çerçevesi), sheet açılışta odağı içine alıyor; kural/şablon düzenlemede arşivli kategori artık "(arşiv)" etiketiyle listede — görünen ile kaydedilen aynı.
- **Ayarlar:** Yedekleme + Demo bölümleri, birikim hedefi oranı seçici (%5–%50, karneyi besler), hakkında satırı. **README:** kurulum, mimari harita, veri akışı, kategori rengi ekleme rehberi (spec'in istediği), yedekleme ve test haritası.
- 84 test yeşil, build temiz.

### Teknik kararlar (ve nedenleri)
1. **İçe aktarımda "yeni kazanır" yalnız zaman damgalı depolarda** (transactions/wishlist/goals/entries/closes); kategoriler, bütçeler, kurallar ve ayarlarda gelen kazanır — damgasız kayıtlar için "hangisi yeni" bilinemez, belirsiz sezgisellik yerine belgeli basit kural (§0.7).
2. **Demo kapanışları fabrikasyon değil:** üretilen veriden `buildCloseContext` ile hesaplanıyor — karne, arşiv ve gelişim bonusu gerçek motorla tutarlı; harfler veriden çıkar (B civarı hedeflendi).
3. **`uiFlags` yedeğe dahil:** temiz gün işaretleri ve kapatılan boşluklar taşınmazsa geri yüklemede seri matematiği değişirdi; v1 yedeklerinde yoksa boş eklenir.
4. **Demo zarfları yalnız o kategoride zarf yoksa eklenir** — sahibin gerçek zarfı asla ezilmez; temizlik yalnız `demo-` id'li olanları alır.

### Elle doğrulama (AC'ler)
1. **Çevrimdışı:** `npm run build && npm run preview` → uygulamayı aç, bir kez gezin → DevTools → Network → Offline yap → yenile: uygulama tüm sekmeleriyle açılmalı, fontlar dahil (precache). Ana ekrana ekleyip uçak modunda da dene.
2. **Kayıpsız gidiş-dönüş:** Ayarlar → JSON dışa aktar → hemen İçe aktar ile aynı dosyayı seç → özet **"0 yeni, 0 güncellenecek"** demeli (birebir aynı veri). Demo yükle → dışa aktar → demoyu temizle → içe aktar → demo verisi aynen geri gelmeli.
3. **v1 göçü:** dışa aktardığın dosyada `schemaVersion`ı 1 yapıp `savingsGoals/savingsEntries/quickTemplates/uiFlags` anahtarlarını sil → içe aktar → "v1 — taşındı" notu görünmeli ve içe aktarım hatasız tamamlanmalı.
4. **Demo turu:** Demo verisi yükle → Özet (dolu hero, kartlar, grafikler, ısı haritasında soluk boşluk günleri), İşlemler, Soğuma (üç statü + sayaçlar), Bütçe (zarflar/sabitler + Yıllık Şok/Kumbara %40 gitar), İçgörü (kartlar + arşivde 2 karne) — hepsi tek dokunuşta dolu. "Demoyu temizle" → yalnız demo kayıtları gitmeli.

---

## P7 gözden geçirme düzeltmeleri (2026-07-15)
Mühendis + kullanıcı şapkalı son tur:
- **Demo temizliği sızıntısı kapatıldı:** demo kuralları yüklüyken vadesi gelen abonelik/maaş gerçek uuid ile yazılıyor ve `demo-` filtresinden kaçıyordu — temizlik artık demo kurallarından türeyen işlemleri de siler (kullanıcının bilerek girdiği kayıtlar, ör. demo kısayoluna dokunuşlar, korunur).
- **İçe aktarım `lastPostedDate`i asla geri sarmaz:** eski yedek, kuralın yazım imlecini geriye çekip motorun arayı **mükerrer** yazmasına yol açabilirdi — birleştirmede en yeni imleç kazanır.
- **Sheet odak çalması giderildi:** odak yalnız mount'ta içeri alınır; ebeveyn render'ları (canlı sorgu güncellemeleri) yazma/dokunma sırasında odağı artık kaçırmaz.
- **Demo yükle/temizle çift-dokunuş yarışına karşı kilitli** (meşgulken pasif).
- **CSV BOM'u açık `\uFEFF` kaçışı** — kaynaktaki görünmez karakter araç zincirinde kaybolmaya fazla açıktı.

---

# 🏁 v1.1 spec'inin tüm fazları (P0–P7) tamamlandı.
Parking lot (v2, §19) dışında açık iş yok. İyi birikimler! 🏦

---

## v1.2 — Masaüstü düzeni, haftalık durum, harçlık modeli (2026-07-15)
Sahibin talebiyle spec sonrası kapsam:
- **Masaüstü kabuğu (lg ≥1024px):** sol kenar çubuğu (marka + "İşlem ekle" + gezinme), geniş içerik (max-w-5xl); Özet kartları 2/3 kolonlu ızgarada (hero ve uyarı kartları tam genişlik), İçgörü kartları masonry kolonlarında, zarflar ve kumbara hedefleri 2 kolon, sheet'ler daha geniş. **Telefon düzeni aynen korunur** — alt bar + FAB yalnız mobilde, kenar çubuğu yalnız masaüstünde.
- **"Bu hafta" kartı:** Pzt→bugün harcanan + gelen (harçlık buraya düşer), gerekli/istek/boş şeridi, geçen haftanın aynı dönemiyle %kıyas, günlük ortalama.
- **Maaş çerçevesi kaldırıldı:** "Maaş günü" → "Bütçe ayının başlangıç günü" (düzensiz gelir için 1 önerilir), "Aylık net gelir" → "Aylık ortalama gelir (isteğe bağlı)"; onboarding metinleri düzensiz gelire göre; varsayılan gelir kategorisi Harçlık 💵 (mevcut veritabanında Ayarlar → Kategoriler'den yeniden adlandırılabilir). Demo artık haftalık düzensiz harçlığı otomatik-olmayan haftalık kuralla modelliyor (her hafta "Onayla | Atla" kartı) ve öğrenci ölçekli tutarlarla üretiliyor.
- Mali ay altyapısı (zarflar/karne/kapanış) aynen duruyor — yalnız maaş varsayımı gitti.

---

## v1.3 — Ödemeler Takvimi (2026-07-15)
Bir haftalık kullanım geri bildiriminin 1+2+5. maddeleri (tek özellik olarak):
- **Bütçe → "Sabitler" artık "Ödemeler".** Üstte **takvim/önizleme:** "Bu ay / Gelecek ay" toggle'ı, "Toplam çıkış: ₺X" ve **gün gün ne çıkıyor** listesi (abonelik + sabit + kredi kartı + borç + planlı — hepsi tek yerde, tarih sıralı). Altında: Abonelikler & sabitler (mevcut motor, dokunulmadı), **Borçlar** (kredi kartı + kişiye borç, kalan bakiye + "≈ N ödeme kaldı"), **Planlı ödemeler** (tek seferlik önemli gün/ödeme).
- **Yeni `Obligation` modeli (Dexie v4):** `kart` (aylık, gün, tutar), `borc` (aylık taksit + kalan bakiye, sıfırlanınca biter), `planli` (tek tarih). Yalnız yeni store eklendiği için mevcut veriler korunuyor (ek migration gerekmez).
- **Ödeme akışı = onaylı:** kredi kartı/borç/planlı, tutar ve tarih değişebildiği için "Ödedim" ile işlenir (borçta ödenen tutar düzenlenebilir, kalan düşer). Sabit tutarlı kredi kartı istersen "Otomatik yaz" ile açılışta kendiliğinden yazılabilir (abonelikler gibi).
- **Özet'e "Yaklaşan ödemeler" kartı:** önümüzdeki ~7 gün (geçmiş vadeler de dahil — kaçmasın) içindeki ödemeler, "bugün / 3 gün içinde / gecikti" etiketiyle ve tek dokunuş "Ödedim".
- **Madde 1 doğrulaması:** abonelikler zaten belirlenen günde otomatik gider yazıyordu (Otomatik yaz açıksa); eksik olan ileriye dönük görünürlüktü — takvim onu çözdü.
- Yedekleme (export/import + v1 göçü) ve demo verisi obligations'ı kapsıyor (demo: kredi kartı, arkadaşa borç, anne doğum günü hediyesi).
- 94 test yeşil (payments 10 yeni), build temiz.

**Sırada:** madde 3 (Soğuma "harcamadığın paranın kıymeti" iyileştirmesi), sonra madde 4 (Supabase ile gerçek hesap + cihazlar arası senkron).
