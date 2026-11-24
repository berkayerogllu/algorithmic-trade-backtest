import { useEffect, useMemo, useState } from 'react';
import {
  Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { Download } from 'lucide-react';

type Point = { date: string; price: number; equity: number; benchmark: number };
type Metrics = { total_return: number; sharpe_ratio: number; max_drawdown: number; win_rate: number; closed_trades: number };
type Trade = { entry_date: string; exit_date: string; entry_price: number; exit_price: number; pnl: number; exit_reason: string };
type BacktestResponse = { points: Point[]; trades: Trade[]; metrics: Metrics; strategy: string; symbol: string; period: string; source: string; parameters: Record<string, number> };
type ForecastResponse = { symbol: string; source: string; as_of: string; last_close: number; predicted_return: number; predicted_close: number; lower_close: number; upper_close: number; horizon: number; validation_mae_pct: number; baseline_mae_pct: number; directional_accuracy: number; validation_samples: number; beats_baseline: boolean; history: { date: string; close: number }[] };

const strategies = ['SMA Crossover', 'RSI', 'MACD', 'Buy & Hold'];
const presets: Record<string, [string, string, number][]> = {
  'SMA Crossover': [['fast_period', 'Kısa ortalama (gün)', 20], ['slow_period', 'Uzun ortalama (gün)', 50]],
  RSI: [['period', 'RSI dönemi (gün)', 14], ['oversold', 'Alım eşiği', 30], ['overbought', 'Çıkış eşiği', 70]],
  MACD: [['fast_period', 'Hızlı EMA (gün)', 12], ['slow_period', 'Yavaş EMA (gün)', 26], ['signal_period', 'Sinyal dönemi (gün)', 9]],
  'Buy & Hold': [],
};
const descriptions: Record<string, string> = {
  'SMA Crossover': 'Kısa ortalama uzun ortalamanın üzerindeyken pozisyonda kalır.',
  RSI: 'RSI alım eşiğinin altına indiğinde girer, çıkış eşiğinin üzerine çıktığında pozisyonu kapatır.',
  MACD: 'MACD sinyal çizgisinin üzerindeyken pozisyonda kalır.',
  'Buy & Hold': 'Pozisyon açar ve dönem boyunca taşır. Risk kuralları açıksa erken çıkabilir.',
};
const formatTRY = (n: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);
const formatPercent = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`;

function App() {
  const [strategy, setStrategy] = useState(strategies[0]);
  const [mode, setMode] = useState<'backtest' | 'forecast'>('backtest');
  const [horizon, setHorizon] = useState(5);
  const [symbol, setSymbol] = useState('THYAO.IS');
  const [start, setStart] = useState('2023-01-01');
  const [end, setEnd] = useState('');
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [showPrices, setShowPrices] = useState(false);
  const [capital, setCapital] = useState('100000');
  const [commission, setCommission] = useState('0.1');
  const [riskEnabled, setRiskEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BacktestResponse | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);

  const chartData = useMemo(() => result?.points ?? [], [result]);
  const closedTrades = result?.trades ?? [];
  useEffect(() => {
    const checkApi = () => fetch('/api/health').then(r => setApiOnline(r.ok)).catch(() => setApiOnline(false));
    checkApi();
    const timer = window.setInterval(checkApi, 15000);
    return () => window.clearInterval(timer);
  }, []);
  const runBacktest = async () => {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/backtest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: symbol.trim(), strategy, start_date: start, end_date: end || null, parameters: Object.fromEntries(presets[strategy].map(([key, , fallback]) => [key, Number(parameters[key] ?? fallback)])), initial_cash: Number(capital), commission_rate: Number(commission) / 100, risk_enabled: riskEnabled }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(typeof body?.detail === 'string' ? body.detail : 'Simülasyon çalıştırılamadı. Ayarları ve sunucu bağlantısını kontrol edin.');
      }
      setResult(await response.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sunucuya ulaşılamadı. Python API sunucusunu başlatın.');
    } finally { setBusy(false); }
  };

  const runForecast = async () => {
    setBusy(true); setError(''); setForecast(null);
    try {
      const response = await fetch('/api/forecast', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: symbol.trim(), horizon, start_date: start, end_date: end || null }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof body?.detail === 'string' ? body.detail : 'Tahmin üretilemedi. Hisse kodunu ve veri aralığını kontrol edin.');
      setForecast(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tahmin sunucusuna ulaşılamadı.');
    } finally { setBusy(false); }
  };

  const metrics = result?.metrics;
  return <div className="app-shell">
    <header className="topbar">
      <a href="#terminal" className="brand">piyasa.lab</a>
      <span className="connection">Simülasyon motoru · {apiOnline ? 'Bağlı' : 'Çevrimdışı'}</span>
    </header>
    <main id="terminal" className="content">
        <header className="page-heading">
          <h1>BIST strateji testi</h1>
          <p>Hisselerin geçmiş verisini inceleyin, stratejileri test edin ve tahmin modelini ölçün.</p>
        </header>

        <div className="mode-tabs" role="tablist" aria-label="Analiz türü">
          <button type="button" role="tab" aria-selected={mode === 'backtest'} className={mode === 'backtest' ? 'selected' : ''} onClick={() => { setMode('backtest'); setError(''); }}>Geriye dönük test</button>
          <button type="button" role="tab" aria-selected={mode === 'forecast'} className={mode === 'forecast' ? 'selected' : ''} onClick={() => { setMode('forecast'); setError(''); }}>Tahmin araştırması</button>
        </div>

        {mode === 'backtest' && <>

        <form className="run-panel" onSubmit={event => { event.preventDefault(); void runBacktest(); }}>
          <h2>Simülasyon ayarları</h2>
          <div className="form-grid">
            <label className="field"><span>Hisse kodu</span><div className="input-wrap ticker-input"><input list="bist-symbols" required maxLength={20} value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} aria-label="Hisse senedi sembolü" /><datalist id="bist-symbols">{['THYAO', 'ASELS', 'TUPRS', 'GARAN', 'AKBNK', 'BIMAS', 'KCHOL', 'EREGL'].map(code => <option key={code} value={code} />)}</datalist></div></label>
            <label className="field"><span>Strateji</span><div className="select-wrap"><select value={strategy} onChange={e => { setStrategy(e.target.value); setParameters({}); }} aria-label="Strateji seç"><option>SMA Crossover</option><option>RSI</option><option>MACD</option><option>Buy &amp; Hold</option></select></div></label>
            <label className="field"><span>Başlangıç sermayesi</span><div className="input-wrap"><input value={capital} onChange={e => setCapital(e.target.value)} inputMode="numeric" aria-label="Başlangıç sermayesi" /><span className="suffix">₺</span></div></label>
            <label className="field"><span>Komisyon</span><div className="input-wrap"><input value={commission} onChange={e => setCommission(e.target.value)} inputMode="decimal" aria-label="Komisyon oranı" /><span className="suffix">%</span></div></label>
          </div>
          <div className="form-grid">
            <label className="field">Başlangıç tarihi<input type="date" required value={start} onChange={event => setStart(event.target.value)} /></label>
            <label className="field">Bitiş tarihi (isteğe bağlı)<input type="date" min={start} value={end} onChange={event => setEnd(event.target.value)} /></label>
          </div>
          <details className="strategy-settings">
            <summary>Strateji kuralları ve parametreleri</summary>
            <p>{descriptions[strategy]}</p>
            {presets[strategy].length > 0 && <div className="form-grid">
              {presets[strategy].map(([key, label, fallback]) => (
                <label className="field" key={key}>{label}
                  <input type="number" min={key.endsWith('sold') || key === 'overbought' ? 0 : 1} required
                    value={parameters[key] ?? fallback}
                    onChange={event => setParameters({ ...parameters, [key]: event.target.value })} />
                </label>
              ))}
            </div>}
          </details>
          <div className="panel-footer">
            <label className="risk-toggle">
              <input type="checkbox" checked={riskEnabled} onChange={event => setRiskEnabled(event.target.checked)} />
              Zarar durdur ve kâr al kurallarını uygula
            </label>
            <button className="run-button" disabled={busy || !symbol.trim()}>
              {busy ? 'Simülasyon çalışıyor…' : 'Simülasyonu çalıştır'}
            </button>
          </div>
          {error && <div className="error-message" role="alert">{error}</div>}
        </form>

        <div className="results-heading"><div><div className="section-title"><h2>Performans özeti</h2><span className="period-badge">{result?.period}</span></div><p>{result ? `${result.symbol} · ${result.strategy} · ${chartData.length.toLocaleString('tr-TR')} işlem günü` : 'Henüz bir simülasyon çalıştırılmadı.'}</p></div><button className="export-button" disabled={!result} onClick={() => result && downloadCsv(result)}><Download size={15} /> CSV indir</button></div>

        <section className="metric-grid" aria-label="Performans metrikleri">
          <MetricCard label="Toplam getiri" value={metrics ? formatPercent(metrics.total_return) : '—'} detail={metrics ? `${formatTRY(chartData[chartData.length - 1].equity)} portföy değeri` : 'Başlangıçtan bugüne'} trend={metrics ? metrics.total_return >= 0 : null} />
          <MetricCard label="Sharpe oranı" value={metrics ? metrics.sharpe_ratio.toFixed(2) : '—'} detail="Yıllıklandırılmış · 252 gün" />
          <MetricCard label="Azami düşüş" value={metrics ? formatPercent(metrics.max_drawdown) : '—'} detail="Zirveden en düşük noktaya" trend={metrics ? false : null} />
          <MetricCard label="Kazanma oranı" value={metrics ? formatPercent(metrics.win_rate) : '—'} detail={metrics ? `${metrics.closed_trades} kapanan işlem` : 'Kapanan işlemlere göre'} />
        </section>

        <section className="chart-card"><div className="chart-head"><div><h2>Portföy performansı</h2><p>Düzeltilmiş günlük kapanışlar üzerinden</p></div>{result && <button type="button" className="export-button" onClick={() => setShowPrices(!showPrices)}>{showPrices ? 'Portföyü göster' : 'Hisse fiyatını göster'}</button>}<div className="legend" hidden={showPrices}><span><i className="legend-strategy" /> Strateji</span><span><i className="legend-benchmark" /> Al-tut</span></div></div><div className="chart-wrap">{chartData.length ? <ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData} margin={{ top: 16, right: 10, bottom: 0, left: 2 }}><defs><linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#176b56" stopOpacity={0.17} /><stop offset="100%" stopColor="#176b56" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#dedfd7" vertical={false} /><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#56635e', fontSize: 11 }} minTickGap={44} /><YAxis tickLine={false} axisLine={false} tick={{ fill: '#56635e', fontSize: 11 }} tickFormatter={v => new Intl.NumberFormat('tr-TR', { notation: 'compact' }).format(v)} width={44} /><Tooltip contentStyle={{ background: '#fffdf8', border: '1px solid #dedfd7', borderRadius: 8, color: '#202b27' }} formatter={(v: number) => formatTRY(v)} />{showPrices ? <Line dataKey="price" name="Kapanış" stroke="#176b56" dot={false} /> : <Area type="monotone" dataKey="equity" stroke="#176b56" strokeWidth={2} fill="url(#equityFill)" name="Strateji" />}{!showPrices && <Line type="monotone" dataKey="benchmark" stroke="#73808d" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Al-tut" />}</ComposedChart></ResponsiveContainer> : <p className="empty-chart">Simülasyonu çalıştırınca strateji ve al-tut sonuçları burada görünür.</p>}</div><div className="chart-foot"><span><span className="live-dot" /> Günlük kapanış fiyatları</span><span>{result?.source ?? 'Kaynak: Yahoo Finance'}</span></div></section>

        <section className="lower-grid"><div className="data-card"><div className="card-heading"><div><h2>İşlem günlüğü</h2><p>{result ? `${closedTrades.length} kapanmış işlem` : 'Gerçekleşen alım ve satımlar'}</p></div></div><div className="table-scroll" id="trade-table"><table><thead><tr><th>Giriş</th><th>Çıkış</th><th>Kâr / zarar</th><th>Çıkış nedeni</th></tr></thead><tbody>{closedTrades.length ? closedTrades.slice().reverse().map((trade, i) => <tr key={`${trade.entry_date}-${i}`}><td>{trade.entry_date} · {formatTRY(trade.entry_price)}</td><td>{trade.exit_date} · {formatTRY(trade.exit_price)}</td><td className={trade.pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}>{formatTRY(trade.pnl)}</td><td><span className={`trade-pill ${trade.exit_reason === 'signal' ? 'buy' : 'sell'}`}>{trade.exit_reason === 'signal' ? 'Sinyal' : trade.exit_reason === 'stop_loss' ? 'Stop-loss' : 'Take-profit'}</span></td></tr>) : <tr><td colSpan={4} className="empty-row">{result ? 'Bu dönemde kapanmış işlem yok.' : 'Backtest sonrası işlem kayıtları listelenir.'}</td></tr>}</tbody></table></div></div>
        </section>
        </>}
        {mode === 'forecast' && <>
          <section className="run-panel">
            <h2>Geçmiş veriden tahmin</h2>
            <p className="forecast-intro">Geçmiş fiyat, trend, oynaklık ve hacim özellikleriyle ileri dönem getirisini tahmin eder. Model, son dönem verisinde kronolojik olarak doğrulanır.</p>
            <div className="form-grid forecast-controls">
              <label className="field">Hisse kodu<input list="forecast-symbols" required maxLength={20} value={symbol} onChange={event => setSymbol(event.target.value.toUpperCase())} /><datalist id="forecast-symbols">{['THYAO','ASELS','TUPRS','GARAN','AKBNK','BIMAS','KCHOL','EREGL'].map(code => <option key={code} value={code} />)}</datalist></label>
              <label className="field">Veri başlangıcı<input type="date" required value={start} onChange={event => setStart(event.target.value)} /></label>
              <label className="field">Veri bitişi<input type="date" min={start} value={end} onChange={event => setEnd(event.target.value)} /></label>
              <label className="field">Tahmin ufku<select value={horizon} onChange={event => setHorizon(Number(event.target.value))}><option value={1}>1 işlem günü</option><option value={5}>5 işlem günü</option><option value={20}>20 işlem günü</option></select></label>
            </div>
            <button className="run-button" onClick={runForecast} disabled={busy || !symbol.trim()}>{busy ? 'Geçmiş veriler inceleniyor…' : 'Tahmini hesapla'}</button>
            {error && <div className="error-message" role="alert">{error}</div>}
          </section>
          {forecast ? <>
            <div className="results-heading"><div><h2>{forecast.symbol} tahmin özeti</h2><p>{forecast.as_of} kapanışı · {forecast.source} · {forecast.horizon} işlem günlük ufuk</p></div></div>
            <section className="metric-grid forecast-metrics">
              <MetricCard label="MODEL TAHMİNİ" value={formatTRY(forecast.predicted_close)} detail={`${formatPercent(forecast.predicted_return)} beklenen değişim`} />
              <MetricCard label="GEÇMİŞ HATA ARALIĞI" value={`${formatTRY(forecast.lower_close)} – ${formatTRY(forecast.upper_close)}`} detail="Doğrulama hatalarının %90 yüzdeliği" />
              <MetricCard label="YÖN DOĞRULUĞU" value={formatPercent(forecast.directional_accuracy)} detail={`${forecast.validation_samples} ayrılmış doğrulama örneği`} />
              <MetricCard label="TABAN ÇİZGİSİ" value={forecast.beats_baseline ? 'Model daha düşük hata' : 'Basit tahmin daha düşük hata'} detail={`Model MAE ${forecast.validation_mae_pct.toFixed(2)}% · taban ${forecast.baseline_mae_pct.toFixed(2)}%`} />
            </section>
            {!forecast.beats_baseline && <p className="forecast-warning" role="status">Bu dönemde model, değişim yok varsayımından daha düşük hata üretmedi. Tahmini temkinli yorumlayın.</p>}
            <section className="chart-card"><div className="chart-head"><div><h2>Fiyat geçmişi ve model tahmini</h2><p>Doğrulama verisi model eğitiminde kullanılmadı</p></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={[...forecast.history.map(point => ({ date: point.date, close: point.close })), { date: `+${forecast.horizon} işlem günü`, forecast: forecast.predicted_close, lower: forecast.lower_close, upper: forecast.upper_close }]} margin={{ top: 16, right: 10, bottom: 0, left: 2 }}><CartesianGrid stroke="#dedfd7" vertical={false} /><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#56635e', fontSize: 11 }} minTickGap={44} /><YAxis tickLine={false} axisLine={false} tick={{ fill: '#56635e', fontSize: 11 }} tickFormatter={value => formatTRY(value)} width={74} domain={['auto','auto']} /><Tooltip formatter={(value: number) => formatTRY(value)} /><Line dataKey="close" name="Kapanış" stroke="#176b56" dot={false} connectNulls /><Line dataKey="forecast" name="Model tahmini" stroke="#bf713a" strokeWidth={2} strokeDasharray="5 4" /><Line dataKey="lower" name="Alt hata sınırı" stroke="#bf713a" strokeDasharray="2 4" dot={false} /><Line dataKey="upper" name="Üst hata sınırı" stroke="#bf713a" strokeDasharray="2 4" dot={false} /></ComposedChart></ResponsiveContainer></div><div className="chart-foot"><span>{forecast.as_of} son gözlem</span><span>{forecast.horizon} işlem günü ileri tahmin · {forecast.source}</span></div></section>
            <p className="forecast-note">Tahmin geçmiş örüntülerden üretilen istatistiksel bir tahmindir. Hata aralığı geçmiş doğrulama hatalarını özetler, gelecekteki sonucu garanti etmez.</p>
          </> : <p className="forecast-empty">Bir BIST hisse kodu ve tahmin ufku seçip geçmiş veriyi çalıştırın.</p>}
        </>}
        <footer className="app-footer"><span>piyasa.lab · Akademik simülasyon aracı</span><span>Gerçek emir gönderilmez</span></footer>
    </main>
  </div>;
}

function MetricCard({ label, value, detail, trend }: { label: string; value: string; detail: string; trend?: boolean | null }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span></div><div className={`metric-value ${trend === true ? 'positive' : trend === false ? 'caution' : ''}`}>{value}</div><div className="metric-detail">{detail}</div></article>;
}

function downloadCsv(data: BacktestResponse) {
  const content = ['date,price,equity,benchmark', ...data.points.map(p => `${p.date},${p.price},${p.equity},${p.benchmark}`)].join('\n');
  const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([content], { type: 'text/csv' })); link.download = `${data.symbol}-backtest.csv`; link.click(); URL.revokeObjectURL(link.href);
}

export default App;
