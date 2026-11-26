# SEN 4015 Proje Gereklilikleri ve Yerel Çalıştırma Raporu

| Bilgi | Değer |
| --- | --- |
| Proje | Algorithmic Trading and Backtesting Simulator |
| İnceleme tarihi | 26 Kasım 2026 |
| İncelenen kaynak | `SEN 4015_Term Project.pdf` ve repodaki mevcut kod |

**Sonuç:** Çalışan bir prototip ve dersin teknik hedeflerinin çoğunu karşılayan çekirdek mevcut. Proje Python sürüm alt sınırı, yerel ortamla tutarlı olacak şekilde 3.9 olarak tanımlandı; paket kurulumu sırasında repo dışı klasörlerin Python paketi sanılmasına yol açan keşif ayarı da düzeltildi. Teslim edilebilir kapsamlı teknik rapor, literatür analizi ve uçtan uca out-of-sample optimizasyon akışı tamamlanmalı.

## 1. Yönetici özeti

Uygulama yerel ortamda `http://127.0.0.1:8765/` adresinde açıldı. FastAPI sağlık kontrolü `ok`, Supabase bağlantısı `connected` döndü. BIST kataloğunda `THYAO.IS` araması sonuç verdi ve bu hisse için SMA backtesti çalıştı: 251 günlük veri noktası ve 7 kapanmış işlem üretildi. Kayıt geçmişine kullanıcı isteğiyle yazılmadığı için geçmiş tablosu boş kaldı.

Kod tabanında dört strateji, nesne yönelimli motor, risk kuralları, performans metrikleri, sıralı ve süreç tabanlı optimizasyon, kronolojik veri bölme, FastAPI ve React/TypeScript arayüzü bulunuyor. Yerel doğrulamada 35 Python testi geçti ve frontend üretim derlemesi başarılı oldu.

Proje Python alt sınırı `pyproject.toml` içinde `>=3.9` olarak tanımlandı; yerel `.venv` Python 3.9.6 olduğundan mevcut geliştirme ortamıyla uyumlu. Setuptools paket keşfi yalnızca `algorithmic_backtest` paketini kapsayacak şekilde sınırlandı; böylece repo kökündeki `data`, `frontend`, `output` ve `supabase` klasörlerinin paket kurulumunu bozması önlendi. Bu sürümde kurulum, testler ve yerel uygulama doğrulandı. Ayrıca optimizasyon fonksiyonu kendisine verilen veri üzerinde çalışır; test kümesinin optimizasyona verilmesini kod düzeyinde engellemez. Kronolojik bölme yardımcı işlevi var, fakat optimizasyon, validasyon ve nihai test değerlendirmesini güvenli biçimde birleştiren bir akış bulunmuyor.

## 2. Yerel çalıştırma ve kontrol sonuçları

| Kontrol | Sonuç | Kanıt / not |
| --- | --- | --- |
| Web arayüzü | Başarılı | `http://127.0.0.1:8765/` adresinde `piyasa.lab` açıldı. |
| API ve veritabanı | Başarılı | `/api/health`: `status=ok`, `database=connected`. |
| BIST hisse araması | Başarılı | `THYAO` araması `THYAO.IS` / Türk Hava Yolları döndürdü. |
| SMA backtesti | Başarılı | `THYAO.IS`, 25.11.2025–24.11.2026; 251 veri noktası, 7 işlem. |
| Backtest geçmişi | Beklenen durum | `/api/history` boş. Sonuçlar yalnızca kullanıcı “Geçmişe kaydet” dediğinde kaydediliyor. |
| Python testleri | Başarılı | `.venv/bin/python -m pytest -q`: **35 geçti**. |
| Frontend üretim derlemesi | Başarılı | `npm run build` tamamlandı; Vite büyük bundle için uyarı verdi. |
| Python çalışma sürümü ve paket kurulumu | Uyumlu | Yerel `.venv`: 3.9.6; proje alt sınırı: `>=3.9`; setuptools paket keşfi açıkça yapılandırıldı. |

Uygulama şu anda yerel sunucu oturumunda çalışıyor. README’de belirtilen başlatma komutu:

```bash
python -m algorithmic_backtest.local_app
```

Uygulamayı yeniden başlatmak için önce etkin sunucu sürecini durdurup komutu repo kökünde çalıştırın. Supabase sağlık kontrolünün başarılı olması, bu yerel çalıştırmada yapılandırılmış veritabanı bağlantısının erişilebilir olduğunu gösterir.

## 3. PDF’deki ders gerekliliklerine uyum

| PDF gerekliliği | Not | Değerlendirme |
| --- | --- | --- |
| 2–4 kişilik grup | Karşılanıyor (verilen proje bilgisine göre) | Proje ekibi 3 kişi olarak tanımlanmış. Resmî grup kaydı repo üzerinden doğrulanamaz. |
| Gerçek bir Python projesi | Karşılanıyor | Backtest ve analiz çekirdeği Python. Kullanıcı tercihine uygun arayüz React/TypeScript. |
| En az iki hakemli çalışma veya önemli açık kaynak projeyi eleştirel inceleme | Kısmi / kanıt eksik | Proje önerisinde `backtesting.py` ve *The Probability of Backtest Overfitting* (2017) anılıyor. Repoda bu kaynakların bulgularını, yöntemlerini ve projeye etkisini karşılaştıran literatür bölümü yok. |
| Belirli problemi tanımlama ve literatürü genişletme/uygulama | Kısmi | Parametre optimizasyonunda aşırı uyum ve kronolojik OOS değerlendirmesi hedeflenmiş. Bu katkının deneysel karşılaştırması ve literatürle bağı raporlanmamış. |
| Nihai Python uygulaması | Büyük ölçüde karşılanıyor | Modüler Python paketi ve yerel çalışan uygulama var. Resmî Python gereksinimi mevcut ortamla uyuşmuyor. |
| Kapsamlı teknik rapor | Eksik | Bu rapor ilk uyum değerlendirmesini sağlar; ders PDF’sinin istediği kapsamlı final raporunun (literatür bulguları, yöntem, deneyler ve sonuçlar) yerini tek başına tutmaz. |
| Temel problem, teknik yaklaşım ve kaynak çalışmaların bulguları | Kısmi | Problem ve uygulama yaklaşımı kod/README’den anlaşılabiliyor. Kaynak çalışmaların bulgularının sistematik özeti eksik. |
| Mimari, OOP, sınıflar, kalıtım ve ana mantık | Karşılanıyor | `BaseStrategy` soyut sınıfı, somut stratejiler, `BacktestEngine`, `Portfolio`, `RiskManager`, `StrategyOptimizer` ve `PerformanceAnalyzer` modüler biçimde uygulanmış. |
| Yenilik ve katkının açıklanması | Kısmi | Paralel arama ve kronolojik bölme uygulanmış. Katkı iddiası karşılaştırmalı deneylerle henüz gösterilmemiş. |
| PDF raporu ve `.py` kaynaklarının ayrı teslimi | Repo dışı / hazırlık gerekli | Kaynak kod Git’te mevcut; resmî yükleme paketi ve ders formatında final rapor doğrulanamadı. Arayüzün TypeScript olması Python kaynak kodu teslimi gereğini ortadan kaldırmıyor. |
| Teams grup kaydı ve sunum zamanlaması | Repo dışı | Google Sheet kaydı ve W13–14 sunum planı uygulama reposundan doğrulanamaz. |
| Tüm üyelerin sunumu ve sözlü savunması | Repo dışı | Sunum, canlı demo ve bireysel katkı hazırlığı ekip tarafından ayrıca tamamlanmalı. |

### Genel değerlendirme

PDF’deki **yazılım/mimari beklentileri büyük ölçüde karşılanıyor**. **Araştırma, deneysel katkı ve akademik teslim beklentileri kısmen karşılanıyor**; repo içinde kanıtlanabilir kapsamlı literatür incelemesi ve final raporu henüz yok. Dersin idari ve sunum gereklilikleri kod reposundan değerlendirilemez.

## 4. İlk proje tanımındaki özelliklerle uyum

| Özellik | Not | Bulgular |
| --- | --- | --- |
| Tarihsel veri yükleme | Var | CSV/Yahoo Finance yükleme; README’de veri kaynağının resmî Borsa İstanbul verisi olmadığı belirtilmiş. |
| Buy & Hold, SMA, RSI, MACD | Var | Strateji sınıfları ortak soyut arayüzden türetiliyor. |
| Komisyon ve portföy simülasyonu | Var | Nakit, miktar, equity ve kapanmış işlemler hesaplanıyor; sinyal bir sonraki barda uygulanıyor. |
| Stop-loss, take-profit ve pozisyon boyutu | Var | Risk yöneticisi limitleri uygular; çıkışlar kapanış fiyatıyla değerlendirilir. |
| Getiri, Sharpe, maksimum düşüş, kazanma oranı | Var | `PerformanceAnalyzer` metrikleri hesaplıyor. |
| Sıralı/paralel parametre taraması | Var | `StrategyOptimizer`, tek süreç veya `ProcessPoolExecutor` ile adayları sıralıyor. |
| Arayüzde hisse/strateji seçimi ve sonuçlar | Var | React/TypeScript istemcisi Python API’sine bağlı. |
| Optimizasyon/validasyon/test kronolojik ayrımı | Kısmi | `DataLoader.split` 60/20/20 bölüyor; optimizasyon sınıfı verilen veri dilimini kabul ediyor ve sınırları kendisi doğrulamıyor. |
| Riskli/risk yönetimsiz karşılaştırma | Kısmi | Motor risk yöneticisiyle veya onsuz çalışabiliyor; sistematik karşılaştırma raporu/deneyi yok. |
| Optimizasyon sonrası OOS değerlendirme | Kısmi | Bölme yapıtaşı mevcut; validasyon seçimi ve testte tek seferlik nihai ölçümü bir araya getiren deney akışı yok. |

## 5. Mimari ve yöntem özeti

- `DataLoader`: OHLCV verisini yükler, doğrular ve kronolojik dilimlere ayırır.
- `BaseStrategy`: Stratejilerin sinyal arayüzünü tanımlar. SMA, RSI, MACD ve Buy & Hold uygulamaları bu arayüzü kullanır.
- `BacktestEngine`: Sinyali takip eden bardaki kapanışta uygular; komisyon, portföy değeri ve işlem günlüğünü üretir.
- `Portfolio` ve `RiskManager`: Sanal nakit/pozisyonu ve tahsis, stop-loss, take-profit kurallarını yönetir.
- `PerformanceAnalyzer`: Portföy eğrisinden getiri, Sharpe, drawdown ve win rate hesaplar.
- `StrategyOptimizer`: Parametre kombinasyonlarını bir ölçüte göre sıralar; paralel seçenekte süreç havuzu kullanır.
- `FastAPI` ve React/TypeScript: Uygulama API’sini ve tarayıcı arayüzünü sağlar; Supabase hisse kataloğu ve kullanıcı tarafından kaydedilen backtest geçmişini tutar.

Motorun long/flat (uzun pozisyon/nakit) modeli açığa satış veya çoklu eşzamanlı hisse portföyü simüle etmez. Bu, kapsam açıkça genişletilmedikçe raporda bir prototip sınırı olarak belirtilmelidir. Yahoo Finance verisi de akademik deneyi tekrarlanabilir kılmak için tarih aralığı, sembol, indirme tarihi ve veri düzeltme politikasını sonuçlarla birlikte kaydetmeyi gerektirir.

## 6. Öncelikli tamamlanacak işler

1. CI’da Python 3.9 ve güncel bir Python sürümünde test matrisi çalıştırın.
2. Optimizasyon, validasyon ve test akışını ayrı API/servis adımlarıyla kurun. Parametreyi yalnızca optimizasyon bölümünde seçin; validasyonla karar verin; test bölümünü seçilen ayarlar sabitlendikten sonra bir kez ölçün.
3. Aynı veri, başlangıç sermayesi, komisyon ve strateji ızgarasında sıralı/paralel süre ve sonuç eşitliğini raporlayın.
4. Risk açık/kapalı senaryolarını aynı dönem ve aynı strateji parametreleriyle karşılaştırın; metrikleri ve işlem sayısını tabloya alın.
5. En az iki kaynağın problem, yöntem, bulgu, sınırlama ve projedeki kullanımını içeren eleştirel literatür bölümünü yazın; kaynakçayı ve atıfları ekleyin.
6. Sonuç tabloları, veri kaynağı, deney protokolü, sınırlılıklar ve ekip katkılarıyla dersin istediği kapsamlı teknik raporu tamamlayıp PDF olarak dışa aktarın. Ayrı `.py` teslimini hazırlayın.
7. Teams grup kaydı, W13–14 sunum takvimi, herkesin canlı kod demosu ve sözlü savunma hazırlığını repo dışındaki ders adımlarında tamamlayın.

## 7. Kanıt sınırı

Bu değerlendirme 26 Kasım 2026 tarihinde çalışma alanındaki PDF, README, kaynak kod, testler, frontend derlemesi ve yerel uygulamanın gözlenen yanıtlarına dayanır. Dış ders kayıtları, ekip sunumu, teslim portalı ve resmi teslim onayı incelenmemiştir. Performans çıktıları yatırım tavsiyesi veya gelecekteki fiyatlar için garanti değildir.
