# Denge

> **Paranla aranı düzelt.** Yerel, hesapsız, çevrimdışı — senin defterin.

**Canlı:** https://jaldisiwnl.github.io/denge/ — telefonda aç, "Ana ekrana
ekle" de; ilk yüklemeden sonra tamamen çevrimdışı çalışır. Barındırma yalnız
statik dosyaları servis eder; **verilerin hiçbir zaman cihazından çıkmaz.**

Denge; her harcamaya bir **bilinç etiketi** (Gerekli / İstek / Boş) iliştiren,
pazar günleri *"Buna değdi mi?"* diye soran, vazgeçtiklerini **Kumbara**'ya
taşıyan, tek kullanıcılık bir kişisel bütçe PWA'sıdır. Veri asla cihazdan
çıkmaz: hesap yok, sunucu yok, analitik yok.

## Kurulum

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest — src/lib saf mantık testleri
npm run build      # tsc -b + vite build (PWA service worker dahil)
npm run preview    # üretim build'ini yerelde servis eder
```

## Yayınlama

`master`a atılan her push, GitHub Actions ile testleri koşturur, `/denge/`
base'iyle derler ve GitHub Pages'e yayınlar
([deploy.yml](.github/workflows/deploy.yml)). Yerelde alt dizinli build'i
denemek için: `DEPLOY_BASE=/denge/ npm run build`. Derin bağlantılar Pages'te
`404.html` SPA fallback'iyle çalışır.

## Mimari harita

```
src/
  app/            # router, Layout (kabuk + açılışta otomatik sabit yazımı),
                  # TabBar+FAB, theme (Zustand, kalıcı), ui (geçici UI state)
  components/     # Sheet, Numpad, Toast, RedPen (imza cihaz), useCountUp
  features/       # ekran başına bir klasör:
                  # dashboard, transactions (+quick-add), budgets, recurring,
                  # kumbara, cooldown, review, close, insights, recovery,
                  # onboarding, settings, templates
  db/
    db.ts         # Dexie şeması (v3) + ilk-açılış seed'i (populate)
    types.ts      # §7 otoriter veri modeli
    demo.ts       # demo verisi yükle/temizle (demo- id önekli)
    repo/         # TÜM okuma/yazma buradan geçer — component'ler tabloya
                  # doğrudan dokunmaz; iş kuralları (dürüstlük, idempotentlik,
                  # sıfır-altı koruması) bu katmanda yaşar
  lib/            # SAF mantık — React/Dexie import'u yasak, hepsi testli:
                  # money, fiscal, stats (metrik+safe-to-spend), grade,
                  # recurrence, streaks, lapse, budget, review, timecost
  i18n/tr.ts      # tüm kullanıcı metinleri (component'te Türkçe sabit yok)
  styles/         # tokens.css (renk değişkenleri) + index.css
```

**Veri akışı:** Component → `useLiveQuery(repo fonksiyonu)` → Dexie.
Yazımlar da repo üzerinden; UI hiçbir iş kuralını kendisi uygulamaz.

**Para:** her tutar tam sayı **kuruş** (`Minor`). Float yalnızca
görüntüleme/ayrıştırma sınırında (`lib/money.ts`).

**Mali ay:** `monthStartDay` (maaş günü) ayın başlangıcıdır; tüm "bu ay"
hesapları `lib/fiscal.ts`teki aralıklarla yapılır.

## Kategori rengi nasıl eklenir? (spec §11 notu)

Palet tek yerde tanımlı: [`src/db/defaults.ts`](src/db/defaults.ts) içindeki
`CATEGORY_COLORS` dizisi (tükenmez/yeşil/mürekkep tonlarından türetilmiş 8
sessiz renk — gökkuşağı yok). Yeni renk eklemek için diziye hex ekleyin;
kategori düzenleme sheet'indeki renk seçici ve donut'un benzersiz-renk
ataması otomatik olarak yeni rengi kullanır. Tema renkleri ise
[`src/styles/tokens.css`](src/styles/tokens.css) değişkenleridir.

## Yedekleme

Ayarlar → Yedekleme: JSON dışa aktarım tüm depoları içerir
(`schemaVersion: 2`); içe aktarım v1 yedeklerini de kabul eder (eksik
depolar eklenerek), id bazlı upsert yapar (zaman damgalı kayıtlarda yeni
olan kazanır) ve uygulamadan önce fark özeti gösterir. CSV, işlemleri
Excel'in Türkçe yerel ayarıyla açacağı formatta verir (noktalı virgül,
virgül ondalık, UTF-8 BOM).

## Testler

`src/lib` altındaki tüm saf fonksiyonlar Vitest ile test edilir: mali ay
sınırları, para ayrıştırma/formatlama gidiş-dönüşü, yineleme kenetlemesi ve
idempotentlik pencereleri, seri duraklatma, boşluk tespiti, karne
fixture'ları (ağırlık dağıtımı + gelişim bonusu) ve zaman maliyeti.
