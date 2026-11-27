# SEN 4015 Literatür Kaynakları

Bu not, ders yönergesindeki en az iki teknik kaynağı bulma ve raporda inceleme ihtiyacı için saklanmıştır. Önerilen ikili, bir bilimsel makale ve bir önemli açık kaynak Python projesinden oluşur.

## 1. Bilimsel makale: backtest aşırı uyumu

**Bailey, D. H., Borwein, J. M., López de Prado, M., & Zhu, Q. J. (2017). “The Probability of Backtest Overfitting.” _Journal of Computational Finance_, 20(4).**

- [Yayıncı / makale sayfası](https://www.risk.net/journal-of-computational-finance/2471206/the-probability-of-backtest-overfitting)
- [DOI](https://doi.org/10.21314/jcf.2016.322)
- [Üniversite arşivi](https://escholarship.org/uc/item/4w1110bb)

**Kaynağın türü:** Hakemli finans matematiği/hesaplamalı finans dergisinde yayımlanmış araştırma makalesi. Derginin Nisan 2017, Cilt 20, Sayı 4 sayfası makaleyi listeler.

**Ele aldığı problem:** Çok sayıda strateji veya parametre geçmiş veride denenip en başarılısı seçildiğinde, seçilen sonucun aşırı uyumdan kaynaklanıp kaynaklanmadığını değerlendirmek.

**Teknik yaklaşım ve bulgu:** Makale, backtest aşırı uyumu olasılığını değerlendirmek için Probability of Backtest Overfitting (PBO) çerçevesini ve Combinatorially Symmetric Cross-Validation (CSCV) yöntemini önerir. Yazarlar CSCV’nin inceledikleri örneklerde PBO için makul tahminler verdiğini bildirir.

**Projeyle bağlantısı:** Projede parametre adaylarını test eden `StrategyOptimizer` ve kronolojik veri bölme işlevi bulunur. Bu makale, çok sayıda aday arasından seçim yaparken aşırı uyum riskini açıklamak ve projenin değerlendirme yaklaşımını gerekçelendirmek için uygundur.

**Dürüstçe belirtilecek fark:** Mevcut kodda CSCV/PBO uygulanmıyor. `DataLoader.split()` kronolojik bölme yapıyor; `StrategyOptimizer.optimize()` ise kendisine verilen veri üzerinde adayları değerlendiriyor. Rapor, bu uygulamayı CSCV ile aynı yöntemmiş gibi sunmamalı. Projenin yöntemi makaleyle karşılaştırılmalı ve hangi riski nasıl ele aldığı açıkça yazılmalı.

**Eleştirel inceleme soruları:**

- PBO hangi strateji seçimi riskini ölçmeye çalışıyor?
- CSCV, sıradan bir tek eğitim/test ayrımından hangi yönden farklı?
- Yazarların “makul tahmin” bulgusu hangi örneklerle sınırlı; gerçek piyasada başarı garantisi veriyor mu?
- Bizim kronolojik bölme ve parametre arama akışımız hangi noktada benziyor, hangi noktada ayrılıyor?
- Bu kaynağın önerdiği yöntemlerden hangileri uygulanıyor, hangileri kapsam dışında kalıyor?

## 2. Açık kaynak proje: backtesting.py

**kernc. _backtesting.py_. GitHub deposu.**

- [Resmi GitHub deposu](https://github.com/kernc/backtesting.py)
- [Ana motor kaynak kodu](https://github.com/kernc/backtesting.py/blob/master/backtesting/backtesting.py)
- [Proje dokümantasyonu](https://kernc.github.io/backtesting.py/)

**Kaynağın türü:** Python ile alım-satım stratejisi backtesti için herkese açık, kapsamlı ve topluluk kullanımı yüksek bir GitHub projesi. Depo incelendiği tarihte (27 Kasım 2026) yaklaşık 9,1 bin yıldız ve 1,6 bin fork gösteriyordu; bu ölçüler zamanla değişebilir.

**Teknik yaklaşım:** Proje `Strategy` ve `Backtest` gibi sınıflarla strateji mantığını yürütmeden ayırır; OHLC(V) verisi, işlemler, performans istatistikleri, grafikler ve parametre optimizasyonu için araçlar sunar. Kaynak kod ve dokümantasyon mimari inceleme için doğrudan kullanılabilir.

**Projeyle bağlantısı:** Bu depo, bizim `BaseStrategy`, `BacktestEngine`, portföy ve analiz modüllerimizle mimari karşılaştırma yapmak için uygundur. Ortak fikirleri (strateji arayüzü, motorun veriyi işlemesi, performans raporlaması) ve tasarım farklarını gösterin.

**Eleştirel inceleme soruları:**

- Strateji sınıfı ile backtest motoru hangi sorumlulukları üstleniyor?
- Sinyal, emir ve fiyat verisi nasıl işleniyor; ileriye bakma hatasını azaltan tasarım var mı?
- Komisyon, pozisyon ve performans hesaplamalarının kapsamı nedir?
- Kütüphanenin güçlü yönleri ve kullanım/tasarım sınırları nelerdir?
- Bizim modüler yapımız hangi yönlerden benzer; hangi kararları farklı ve neden?
- Depodaki örnek sonuçlar, kütüphanenin doğruluğu veya bir stratejinin gelecekte kârlı olacağı için kanıt sayılabilir mi? Hayır; örnekleri yazılımın nasıl kullanıldığını göstermek için ele alın.

## Rapor için kısa çalışma şablonu

Her kaynağı aşağıdaki başlıklarla 1–2 sayfada inceleyin; kaynakları sadece özetleyip bırakmayın:

1. **Kaynağın künyesi ve türü:** Yazar/kurum, tarih, dergi veya depo, kalıcı bağlantı.
2. **Problem:** Kaynak hangi somut sorunu ele alıyor?
3. **Teknik yaklaşım:** Hangi algoritma, yöntem, sınıf tasarımı veya Python araçları kullanılmış?
4. **Bulgular / sunduğu teknik değer:** Makale ne gösteriyor; açık kaynak proje ne sağlıyor?
5. **Eleştirel değerlendirme:** Varsayımlar, sınırlılıklar ve hangi koşullarda sonuçların geçerli olduğu.
6. **Bizim projeyle ilişki:** Ne örnek alındı, ne farklı yapıldı, ne uygulanmadı ve neden?

## Kaynak bulma yerleri

- Makaleler için: Google Scholar ile arama yapıp ardından yayıncı sayfasını veya üniversite arşivini açın. Ders yönergesinde IEEE, ACM ve arXiv örnek olarak veriliyor.
- Açık kaynak için: GitHub’da doğrudan proje deposuna, README’ye, dokümantasyona, kaynak koda ve lisansa bakın. Projenin gerçekten ilgili ve kapsamlı olup olmadığını kod ve kullanım kanıtıyla gerekçelendirin.
- Blog yazıları ve genel web sayfaları konuya giriş için yardımcı olabilir; iki ana teknik kaynağın yerine koymayın.

## Kullanım notu

Bu iki aday ders yönergesinin kaynak türlerine uygun ve projeyle doğrudan ilişkili bir başlangıç setidir. Final raporda kaynakları gerçekten okuyup, yöntem ve sınırlılıklarını kendi kodunuzla karşılaştırarak yazın. Kaynakta bulunan her özelliğin projede var olduğunu iddia etmeyin.
