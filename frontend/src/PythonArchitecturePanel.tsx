import { ChevronDown, Code2 } from 'lucide-react';

type View = 'backtest' | 'forecast' | 'research' | 'history';
type Strategy = 'SMA Crossover' | 'EMA Crossover' | 'RSI' | 'MACD' | 'Bollinger Bands' | 'Stochastic Oscillator' | 'Donchian Channel' | 'Combined' | 'Buy & Hold';

const strategyClassNames: Record<Strategy, string> = {
  'SMA Crossover': 'SMACrossoverStrategy',
  'EMA Crossover': 'EMACrossoverStrategy',
  RSI: 'RSIStrategy',
  MACD: 'MACDStrategy',
  'Bollinger Bands': 'BollingerBandsStrategy',
  'Stochastic Oscillator': 'StochasticOscillatorStrategy',
  'Donchian Channel': 'DonchianChannelStrategy',
  Combined: 'CombinedStrategy',
  'Buy & Hold': 'BuyAndHoldStrategy',
};

const viewDetails: Record<View, { title: string; description: string; stages: { name: string; role: string }[] }> = {
  backtest: {
    title: 'Backtest akışı',
    description: 'Seçtiğiniz sinyal, portföy ve risk katmanlarından geçerek ölçümlere dönüşür.',
    stages: [
      { name: 'DataLoader', role: 'OHLCV verisini yükler ve doğrular' },
      { name: 'BaseStrategy', role: 'Seçili sınıf al / nakitte kal sinyali üretir' },
      { name: 'BacktestEngine', role: 'Sinyali sonraki barda uygular' },
      { name: 'Portfolio + RiskManager', role: 'Sermaye, pozisyon ve çıkışları yönetir' },
      { name: 'PerformanceAnalyzer', role: 'Getiri ve risk ölçülerini hesaplar' },
    ],
  },
  forecast: {
    title: 'Tahmin akışı',
    description: 'Tarihsel özellikler Python’da hazırlanır; model geçmişte ayrılmış bölümde doğrulanır.',
    stages: [
      { name: 'DataLoader', role: 'Tarihsel fiyat ve hacmi hazırlar' },
      { name: 'Pandas + NumPy', role: 'Trend, momentum ve oynaklık özelliklerini üretir' },
      { name: 'HistoricalReturnForecaster', role: 'Ridge regresyonu ile getiriyi tahmin eder' },
      { name: 'Kronolojik doğrulama', role: 'Tahmini basit baz çizgisiyle karşılaştırır' },
    ],
  },
  research: {
    title: 'Rastgele araştırma akışı',
    description: 'Parametre ve sinyal kombinasyonları keşif döneminde sıralanır; sonraki dönemler raporlanır.',
    stages: [
      { name: 'generate_random_candidates', role: 'Tekrarlanabilir adaylar üretir' },
      { name: 'CombinedStrategy', role: 'İndikatör oylarını birleştirir' },
      { name: 'BacktestEngine', role: 'Adayları veri bölümlerinde simüle eder' },
      { name: 'API raporu', role: 'Keşif, doğrulama ve test ölçülerini döndürür' },
    ],
  },
  history: {
    title: 'Kayıtlı sonuç akışı',
    description: 'Kayıt özeti listelenir; ayrıntılı backtest açıldığında Python API’sinden alınır.',
    stages: [
      { name: 'React arayüzü', role: 'Kayıtları arar ve seçer' },
      { name: 'FastAPI', role: 'İstekleri Python uç noktalarına yönlendirir' },
      { name: 'database.py', role: 'PostgreSQL kaydını okur veya siler' },
      { name: 'BacktestResponse', role: 'Grafik ve işlem ayrıntılarını arayüze taşır' },
    ],
  },
};

export function strategyPythonNote(strategy: Strategy): string {
  if (strategy === 'Combined') {
    return 'CombinedStrategy, farklı BaseStrategy nesnelerinin sinyallerini AND, OR veya çoğunluk kuralıyla birleştirir.';
  }
  return `${strategyClassNames[strategy]}, BaseStrategy sınıfından türeyip generate_signals() metodunu uygular. BacktestEngine aynı arayüzü kullanarak stratejileri polimorfik biçimde çalıştırır.`;
}

export function PythonArchitecturePanel({ view, strategy, riskEnabled }: { view: View; strategy: Strategy; riskEnabled: boolean }) {
  const details = viewDetails[view];
  const screenContext = view === 'backtest'
    ? `${strategyPythonNote(strategy)} ${riskEnabled ? 'RiskManager, seçili stop-loss ve take-profit sınırlarını uygular.' : 'RiskManager kapalı; pozisyonlar strateji sinyaline göre kapanır.'}`
    : view === 'forecast'
      ? 'HistoricalReturnForecaster, pandas ile özellikleri hazırlar ve NumPy matris işlemleriyle ridge regresyonu kurar.'
      : view === 'research'
        ? 'Adaylar API içinde BacktestEngine ile değerlendirilir. Bu akışta StrategyOptimizer.ProcessPoolExecutor kullanılmaz.'
        : 'FastAPI kayıt özetini döndürür; ayrıntılı sonuç seçildiğinde veritabanından okunur.';
  const exampleTitle = view === 'backtest' ? 'Bu backtestte' : view === 'forecast' ? 'Bu tahminde' : view === 'research' ? 'Bu araştırmada' : 'Bu arşivde';
  return (
    <details className="architecture-panel">
      <summary>
        <span className="architecture-summary-icon" aria-hidden="true"><Code2 size={18} /></span>
        <span className="architecture-summary-copy">
          <strong>Proje mimarisi ve Python kavramları</strong>
          <small>{details.title} · sınıfların gerçek görevleri</small>
        </span>
        <span className="architecture-summary-action">Açıklamayı aç <ChevronDown size={16} aria-hidden="true" /></span>
      </summary>
      <div className="architecture-body">
        <div className="architecture-intro">
          <h2>{details.title}</h2>
          <p>{details.description}</p>
        </div>
        <ol className="architecture-flow" aria-label={details.title}>
          {details.stages.map((stage, index) => (
            <li key={stage.name}>
              <span className="architecture-stage-name">{stage.name}</span>
              <span className="architecture-stage-role">{stage.role}</span>
              {index < details.stages.length - 1 && <span className="architecture-connector" aria-hidden="true" />}
            </li>
          ))}
        </ol>
        <div className="architecture-example">
          <div>
            <span className="architecture-label">{exampleTitle}</span>
            <p>{screenContext}</p>
          </div>
          <pre aria-label="Python strateji arayüzü"><code>{'class BaseStrategy(ABC):\n    @abstractmethod\n    def generate_signals(self, data: pd.DataFrame) -> pd.Series: ...'}</code></pre>
        </div>
        <div className="python-concepts" aria-label="Projede kullanılan Python özellikleri">
          <section><h3>Abstract class + inheritance</h3><p><code>BaseStrategy</code> ortak metot sözleşmesini tanımlar; her strateji bu sınıftan türetilir.</p></section>
          <section><h3>Polymorphism</h3><p><code>BacktestEngine</code>, stratejinin türüne bakmadan aynı <code>generate_signals()</code> metodunu çağırır.</p></section>
          <section><h3>Decorators + exceptions</h3><p><code>@app.post</code> API uç noktalarını kaydeder; doğrulama ve hata yönetimi geçersiz istekleri açık yanıtlarla ele alır.</p></section>
          <section><h3>Multiprocessing</h3><p><code>StrategyOptimizer</code> parametre aramasını <code>ProcessPoolExecutor</code> ile paralel çalıştırabilir. Rastgele araştırma ekranındaki adaylar şu an sırayla değerlendirilir.</p></section>
        </div>
      </div>
    </details>
  );
}
