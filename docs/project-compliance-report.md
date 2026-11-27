# SEN 4015 Proje Gereklilikleri Uyum Raporu

| Bilgi | Değer |
| --- | --- |
| Proje | Algorithmic Trading and Backtesting Simulator |
| Değerlendirme tarihi | 27 Kasım 2026 |
| Ölçüt | Yalnızca kullanıcı tarafından sağlanan SEN 4015 Term Project yönergesi |
| İnceleme kapsamı | Yönergenin 4 fazı ve mevcut depo dosyalarının statik incelenmesi |

## Yönetici özeti

Proje, yönergenin Python uygulaması ve nesne yönelimli mimari beklentileri için güçlü, kod içinde görülebilir bir temele sahip. Stratejiler ortak bir soyut sınıf üzerinden çalışıyor; tarihsel veriyi işleyen, işlemleri simüle eden ve performans ölçen ayrı Python modülleri bulunuyor.

Buna karşılık, yönergenin araştırma temelini oluşturan **en az iki nitelikli kaynağın eleştirel incelemesi**, bu kaynaklardan çıkarılan bulgular ve projenin onlarla ilişkisi depoda gösterilmiyor. Bu eksik, hem Faz 1’deki araştırma şartını hem de final raporundaki Foundational Analysis ve Innovation bölümlerinin kanıtlanmasını engelliyor. Grup kaydı, resmi teslim, sunum, katılım ve sözlü savunma ise depo üzerinden doğrulanamıyor.

**Genel durum: Kısmi uyum.** Yazılım çekirdeği mevcut; akademik araştırma ve final teslim kanıtları tamamlanmış görünmüyor. Bu belge bir uyum denetimidir; yönergede istenen kapsamlı final teknik raporun yerine geçmez.

## Durum anahtarı

- **Karşılanıyor:** Depoda doğrudan görülebilen uygulama kanıtı var.
- **Kısmi:** Bir bölümü mevcut; yönergenin tamamı için kanıt veya çalışma eksik.
- **Kanıt yok / doğrulanamıyor:** Depoda kanıt yok ya da gereklilik kod dışındaki bir işlemle doğrulanabilir.

## Faz 1 — Araştırma ve konu belirleme

| Yönerge gerekliliği | Durum | Depoda görülen kanıt ve eksik |
| --- | --- | --- |
| 2–4 kişilik ekip | Kanıt yok / doğrulanamıyor | Depoda ekip üye adlarını ve resmi grup kaydını gösteren bir kayıt yok. Ekip büyüklüğü yalnızca depodan teyit edilemiyor. |
| Python ile gerçek bir problemi ele alan proje | Kısmi | `README.md` tarihsel piyasa verilerinde strateji backtesti amacını tanımlıyor; Python simülasyon paketi mevcut. Ancak yönergenin araştırmaya dayalı amaçla doğrudan bağlantı şartı aşağıdaki kaynak eksikliği nedeniyle gösterilemiyor. |
| En az iki hakemli çalışma veya önemli açık kaynak projesinin eleştirel analizi | Karşılanmıyor / kanıt yok | Depoda kaynakça, sistematik literatür incelemesi veya iki kaynağın yöntem, bulgu ve sınırlamalarını karşılaştıran bir bölüm bulunmuyor. Yönerge bu kaynakları açıkça şart koşuyor. |
| Belirli problem/gap ve seçilen literatürle doğrudan ilişki | Kısmi | Uygulama tarihsel verilerle algoritmik strateji testi problemine odaklanıyor. Seçilmiş kaynaklar depoda analiz edilmediğinden projenin o çalışmalara doğrudan uzantı/uygulama/geliştirme olduğu kanıtlanamıyor. |

## Faz 2 — Geliştirme ve teknik rapor

| Yönerge gerekliliği | Durum | Depoda görülen kanıt ve eksik |
| --- | --- | --- |
| Nihai Python uygulaması | Kısmi | `algorithmic_backtest/` altında modüler Python uygulaması ve `pyproject.toml` var. Kaynak kod mevcut; ancak bu inceleme resmi teslimin yapıldığını veya uygulamanın ders sunumunda doğrulandığını göstermez. |
| Temel problem, teknik yaklaşım ve kaynak çalışmanın bulgularını içeren Foundational Analysis | Karşılanmıyor / kanıt yok | Proje amacı ve teknik yaklaşım koddan açıklanabiliyor. Fakat dayanak kaynakların derin incelemesi ve bu kaynakların temel bulguları mevcut belgelerde yer almıyor. |
| Sınıflar, kalıtım ve ana mantığı açıklayan kapsamlı teknik uygulama bölümü | Kısmi | Kod mimarisi uygulanmış durumda (aşağıdaki mimari özeti). Bu uyum raporu sınıfları özetliyor; yönergenin istediği kapsamlı final teknik açıklama ve tasarım gerekçelerinin yerini tutmuyor. |
| Ayrı Innovation bölümü ve özgün katkının açıklanması | Kısmi | Paralel parametre araması ve rastgele gösterge kombinasyonları gibi özellikler kodda var. Bunların seçilen kaynaklara kıyasla özgün katkısı, yönergenin istediği ayrı final rapor bölümünde açıklanmıyor; kaynak analizi olmadan özgünlük iddiası temellendirilemiyor. |
| Rapor PDF’si ve `.py` kaynak dosyalarının ayrı ayrı teslimi; arşiv dosyası kullanmama | Kısmi / teslim doğrulanamıyor | Depoda `.py` dosyaları var ve bu uyum raporu PDF olarak ayrıca hazırlanıyor. Bunların ders sistemine ayrı dosyalar halinde yüklendiği ve arşiv yüklenmediği depo üzerinden doğrulanamaz. |
| Resmi teslimi ekipten yalnızca bir kişinin yapması | Kanıt yok / doğrulanamıyor | Resmi gönderim kaydı veya sorumlu temsilci bilgisi depoda yok. |
| Son tarih | Kanıt yok / doğrulanamıyor | Yönerge son tarihi dönemin son üçte birlik bölümünün sonu olarak tanımlıyor; dönem takvimi ve gönderim zamanı bu depoda bulunmadığından zamanında teslim değerlendirilemiyor. |

### Kodda gözlenen Python mimarisi

- `algorithmic_backtest/strategies/base.py`: `BaseStrategy`, `ABC` ve `@abstractmethod` ile soyut strateji arayüzü kuruyor.
- `algorithmic_backtest/strategies/`: SMA, EMA, RSI, MACD, Bollinger, Stochastic, Donchian, Buy & Hold ve birleşik strateji uygulamaları ortak arayüzü kullanıyor. `BacktestEngine`, somut strateji yerine `BaseStrategy` tipini kabul ederek polimorfik çalışıyor.
- `algorithmic_backtest/data_loader.py`: OHLCV verisini CSV veya Yahoo Finance üzerinden yüklüyor; kronolojik bölme ve zaman aralığı dönüştürme işlevlerini içeriyor.
- `algorithmic_backtest/backtest_engine.py` ve `portfolio.py`: sinyalleri sonraki barda uygular; sanal nakit, pozisyon, komisyon, portföy değeri ve kapanmış işlemleri hesaplar.
- `algorithmic_backtest/risk_manager.py` ve `performance.py`: pozisyon büyüklüğü, stop-loss/take-profit ve performans metriklerini ayrı sorumluluklarda tutuyor.
- `algorithmic_backtest/optimizer.py`: parametre kombinasyonlarını sıralı veya `ProcessPoolExecutor` süreç havuzuyla değerlendiriyor.
- `algorithmic_backtest/api.py`: Python çekirdeğini HTTP API olarak sunuyor. Arayüz kodu TypeScript olsa da simülasyon ve analiz çekirdeği Python’da.

Bu maddeler uygulama yapısının kodda görüldüğünü gösterir; performans, doğruluk veya sınıfta başarılı canlı çalıştırma iddiası değildir.

## Faz 3 — Grup kaydı ve takvim

| Yönerge gerekliliği | Durum | Depoda görülen kanıt ve eksik |
| --- | --- | --- |
| Teams General kanalındaki Google Sheet’e proje başlığı ve tüm üye adlarının kaydı | Kanıt yok / doğrulanamıyor | Google Sheet veya Teams kaydına ait kanıt depoda yok. |
| Kayıt tamamlanması ve sunum uygunluğu | Kanıt yok / doğrulanamıyor | Yönerge kaydı sunum için ön koşul sayıyor; kayıt durumu bu incelemede doğrulanamadı. |
| W13–W14 sunum saatinin takibi | Kanıt yok / doğrulanamıyor | Nihai sınıf takvimi depoda bulunmuyor. |

## Faz 4 — Sunum ve sözlü savunma

| Yönerge gerekliliği | Durum | Depoda görülen kanıt ve eksik |
| --- | --- | --- |
| Her üyenin katılımı ve aktif sunumu | Kanıt yok / doğrulanamıyor | Katılım, kod deposundan ölçülemez. |
| Her üyenin teorik arka planı ve kodu açıklayabilmesi | Kanıt yok / doğrulanamıyor | Bu bireysel yeterlilik sözlü savunma sırasında değerlendirilir; depodan doğrulanamaz. |
| Problem, literatür, mimari, yenilik ve bireysel katkıları kapsayan profesyonel slaytlar | Kanıt yok | Depoda sunum slaytı bulunmuyor. Yönerge bu beş başlığı zorunlu kılıyor. |
| Sınıfta canlı kod çalıştırma ve öğretim elemanının teknik doğrulaması | Kanıt yok / doğrulanamıyor | Çalıştırılabilir Python modüllerinin bulunması, sınıfta canlı çalıştırma veya öğretim elemanının doğrulamasının yapıldığını kanıtlamaz. |
| Tüm üyelere Python, kütüphaneler ve uygulama mantığı hakkında soru-cevap | Kanıt yok / doğrulanamıyor | Sözlü savunma henüz depo kanıtıyla değerlendirilemez. |

## Öncelikli tamamlanacaklar

1. Yönergenin kabul ettiği türlerde en az iki teknik kaynak seçin ve her biri için problem, yöntem, bulgular, sınırlamalar ve projenin bu kaynağı nasıl uyguladığı/geliştirdiğini yazın.
2. Final teknik raporu yönergedeki yapıya göre tamamlayın: Foundational Analysis (Core Problem, Technical Approach, Key Findings), kapsamlı Technical Implementation ve ayrı Innovation & Contribution bölümü.
3. Yenilik iddiasını seçilen kaynaklarla açıkça karşılaştırın; hangi ekleme veya iyileştirmenin projeye ait olduğunu somutlaştırın.
4. Raporu PDF, Python kaynaklarını `.py` dosyaları olarak ayrı ayrı teslim edin; `.zip` veya `.rar` kullanmayın. Resmi yüklemeyi tek ekip üyesi yapsın ve son tarihi ders takviminden doğrulayın.
5. Teams General kanalındaki Google Sheet’e proje başlığını ve tüm üyelerin tam adlarını kaydedin; sunum takvimini takip edin.
6. İstenen beş başlıklı slaytları hazırlayın. Her üye teorik arka plan, kod ve kendi katkısını anlatmaya; sınıfta canlı çalıştırma ve soru-cevaba hazır olsun.

## İnceleme sınırı

Bu rapor, yalnızca sağlanan iki sayfalık ders yönergesini ölçüt olarak alır ve mevcut depo belgeleri/kodunu statik olarak inceler. Bu turda Python testleri, canlı uygulama veya resmi ders kayıtları çalıştırılıp/doğrulanmadı. Bu nedenle “kanıt yok” ifadeleri gerekliliğin kesinlikle yapılmadığını değil, eldeki depo kanıtıyla doğrulanamadığını belirtir. Dış kaynak, ek proje planı veya başka ders ölçütü kullanılmamıştır.
