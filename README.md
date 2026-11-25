# Algorithmic Trading and Backtesting Simulator

Educational Python project for testing and comparing algorithmic trading
strategies on historical market data.

## Development

```bash
python -m pytest
```

The project is developed incrementally with one feature branch per milestone.

## BIST historical data

For the educational prototype, daily adjusted OHLCV data can be downloaded
from Yahoo Finance with Borsa Istanbul tickers such as `THYAO.IS`:

```python
from algorithmic_backtest.data_loader import DataLoader

prices = DataLoader().download_yfinance("THYAO.IS", start="2019-01-01")
prices.to_csv("data/THYAO.IS.csv", index_label="Date")
```

Yahoo Finance is a convenient delayed-data source and is not the official
exchange feed. Borsa İstanbul provides official historical data through its
DataStore, which may require registration or purchase. Check data rights and
adjustment conventions before redistributing or using downloaded data.

## Strategy parameter search

Split data chronologically before optimization and pass only the optimization
partition to the optimizer. Keep validation for model selection checks and
test data untouched until the final evaluation.

```python
from algorithmic_backtest.data_loader import DataLoader
from algorithmic_backtest.optimizer import StrategyOptimizer
from algorithmic_backtest.strategies import SMACrossoverStrategy

prices = DataLoader().load_csv("data/THYAO.IS.csv")
optimization, validation, test = DataLoader().split(prices)
ranked = StrategyOptimizer().optimize(
    optimization,
    SMACrossoverStrategy,
    {"fast_period": [5, 10, 20], "slow_period": [30, 50, 100]},
    n_jobs=2,
)
```

Parallel search uses Python worker processes. Define strategy classes at the
top level of an importable module when using `n_jobs` greater than one.

## Yerel backtest uygulaması

İlk kurulum için Python 3.11+ ile Node.js ve npm gerekir. Repo kökünde
Python bağımlılıklarını kurun:

```bash
python -m pip install -e .
```

Supabase bağlantısı için repo kökünde `.env.example` dosyasını `.env` olarak
kopyalayın ve `DATABASE_URL` değerini Supabase Session pooler bilgileriyle
doldurun. `.env` Git tarafından yok sayılır; parolayı kaynak koda veya frontend
ayarlarına koymayın. Uygulama yalnızca **Geçmişe kaydet** ile gönderilen son 10
backtesti özel `app_data.backtest_history` tablosunda tutar. Eski tarayıcı
geçmişi Supabase’e aktarılmaz.

Hisse seçimi, aynı Supabase projesindeki `app_data.stock_universe` kataloğunu
kullanır. Katalog KAP’ın BIST pazar listesi ve Nasdaq Trader’ın Nasdaq/NYSE
sembol dosyalarından alınan başlangıç listesini içerir; arama BIST veya ABD
piyasasına göre süzülür. Başlangıç listesinde bulunmayan arama eşleşmeleri
Yahoo Finance’ten bulunup kataloğa eklenir. Bu katalog arama içindir; yalnızca
“Geçmişe kaydet” ile gönderilen backtest sonuçları geçmiş tablosuna yazılır.

Uygulamayı tek terminalden başlatın:

```bash
python -m algorithmic_backtest.local_app
```

[Yerel uygulamayı](http://127.0.0.1:8765/) tarayıcıda açın. Hisse kodunu,
tarih aralığını ve stratejiyi seçip simülasyonu çalıştırın. Sonuç ekranında
portföy, hisse fiyatı, performans metrikleri ve işlem günlüğü yer alır.
THYAO verisi repo içinde bulunur. Diğer BIST hisseleri Yahoo Finance üzerinden
indirilir. Portu değiştirmek için `--port` kullanın.

Tahmin araştırması günlük fiyat, momentum, trend, oynaklık ve hacim özellikleri
üzerinde ridge regresyonu kullanır. Son tarihsel bölüm kronolojik doğrulama için
ayrılır. Eğitim satırları tahmin ufku kadar geriye çekilerek hedef sızıntısı
önlenir. Arayüz doğrulama hatasını değişim yok taban çizgisiyle karşılaştırır
ve model taban çizgisini geçemezse uyarı gösterir. Fiyat bandı geçmiş doğrulama
hatalarından hesaplanır, gelecekteki fiyat için garanti vermez.

### Arayüz geliştirme

The interface is a React and TypeScript application backed by the Python
simulation engine. Start the API and frontend in separate terminals:

```bash
python -m pip install -e .
python -m uvicorn algorithmic_backtest.api:app --reload
cd frontend && npm install && npm run dev
```

Open `http://127.0.0.1:5173`. THYAO data is included; other BIST symbols are
loaded from Yahoo Finance when the backtest runs.

