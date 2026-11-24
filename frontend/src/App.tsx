import { useEffect, useMemo, useState } from 'react';
import {
  Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { Download } from 'lucide-react';

type Point = { date: string; price: number; equity: number; benchmark: number };
type Metrics = { total_return: number; sharpe_ratio: number; max_drawdown: number; win_rate: number; closed_trades: number };
type Trade = { entry_date: string; exit_date: string; entry_price: number; exit_price: number; pnl: number; exit_reason: string };
type BacktestResponse = { points: Point[]; trades: Trade[]; metrics: Metrics; strategy: string; symbol: string; period: string };

const strategies = ['SMA Crossover', 'RSI', 'MACD', 'Buy & Hold'];
const formatTRY = (n: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);
const formatPercent = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`;

function App() {
  const [strategy, setStrategy] = useState(strategies[0]);
  const [symbol, setSymbol] = useState('THYAO.IS');
  const [capital, setCapital] = useState('100000');
  const [commission, setCommission] = useState('0.1');
  const [riskEnabled, setRiskEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BacktestResponse | null>(null);

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
        body: JSON.stringify({ symbol, strategy, initial_cash: Number(capital), commission_rate: Number(commission) / 100, risk_enabled: riskEnabled }),
      });
      if (!response.ok) throw new Error((await response.json()).detail ?? 'Backtest çalıştırılamadı.');
      setResult(await response.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sunucuya ulaşılamadı. Python API sunucusunu başlatın.');
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
          <p>Bir hisse ve strateji seçerek geçmiş fiyatlar üzerinden portföyü simüle edin.</p>
        </header>

        <form className="run-panel" onSubmit={event => { event.preventDefault(); void runBacktest(); }}>
          <h2>Simülasyon ayarları</h2>
          <div className="form-grid">
            <label className="field"><span>Hisse kodu</span><div className="input-wrap ticker-input"><input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} aria-label="Hisse senedi sembolü" /></div></label>
            <label className="field"><span>Strateji</span><div className="select-wrap"><select value={strategy} onChange={e => setStrategy(e.target.value)} aria-label="Strateji seç"><option>SMA Crossover</option><option>RSI</option><option>MACD</option><option>Buy &amp; Hold</option></select></div></label>
            <label className="field"><span>Başlangıç sermayesi</span><div className="input-wrap"><input value={capital} onChange={e => setCapital(e.target.value)} inputMode="numeric" aria-label="Başlangıç sermayesi" /><span className="suffix">₺</span></div></label>
            <label className="field"><span>Komisyon</span><div className="input-wrap"><input value={commission} onChange={e => setCommission(e.target.value)} inputMode="decimal" aria-label="Komisyon oranı" /><span className="suffix">%</span></div></label>
          </div>
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

        <section className="chart-card"><div className="chart-head"><div><h2>Portföy performansı</h2><p>Strateji portföyü ve al-tut karşılaştırması</p></div><div className="legend"><span><i className="legend-strategy" /> Strateji</span><span><i className="legend-benchmark" /> Al-tut</span></div></div><div className="chart-wrap">{chartData.length ? <ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData} margin={{ top: 16, right: 10, bottom: 0, left: 2 }}><defs><linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#176b56" stopOpacity={0.17} /><stop offset="100%" stopColor="#176b56" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#dedfd7" vertical={false} /><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#56635e', fontSize: 11 }} minTickGap={44} /><YAxis tickLine={false} axisLine={false} tick={{ fill: '#56635e', fontSize: 11 }} tickFormatter={v => `${Math.round(v / 1000)}k`} width={44} /><Tooltip contentStyle={{ background: '#fffdf8', border: '1px solid #dedfd7', borderRadius: 8, color: '#202b27' }} formatter={(v: number) => formatTRY(v)} /><Area type="monotone" dataKey="equity" stroke="#176b56" strokeWidth={2} fill="url(#equityFill)" name="Strateji" /><Line type="monotone" dataKey="benchmark" stroke="#73808d" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Al-tut" /></ComposedChart></ResponsiveContainer> : <p className="empty-chart">Simülasyonu çalıştırınca strateji ve al-tut sonuçları burada görünür.</p>}</div><div className="chart-foot"><span><span className="live-dot" /> Günlük kapanış fiyatları</span><span>Kaynak: Yahoo Finance · Gecikmeli piyasa verisi</span></div></section>

        <section className="lower-grid"><div className="data-card"><div className="card-heading"><div><h2>İşlem günlüğü</h2><p>{result ? `${closedTrades.length} kapanmış işlem` : 'Gerçekleşen alım ve satımlar'}</p></div></div><div className="table-scroll" id="trade-table"><table><thead><tr><th>Giriş</th><th>Çıkış</th><th>Kâr / zarar</th><th>Çıkış nedeni</th></tr></thead><tbody>{closedTrades.length ? closedTrades.slice().reverse().map((trade, i) => <tr key={`${trade.entry_date}-${i}`}><td>{trade.entry_date} · {formatTRY(trade.entry_price)}</td><td>{trade.exit_date} · {formatTRY(trade.exit_price)}</td><td className={trade.pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}>{formatTRY(trade.pnl)}</td><td><span className={`trade-pill ${trade.exit_reason === 'signal' ? 'buy' : 'sell'}`}>{trade.exit_reason === 'signal' ? 'Sinyal' : trade.exit_reason === 'stop_loss' ? 'Stop-loss' : 'Take-profit'}</span></td></tr>) : <tr><td colSpan={4} className="empty-row">{result ? 'Bu dönemde kapanmış işlem yok.' : 'Backtest sonrası işlem kayıtları listelenir.'}</td></tr>}</tbody></table></div></div>
        </section>
        <footer className="app-footer"><span>piyasa.lab <span>·</span> Akademik simülasyon aracı</span><span>Gerçek emir gönderilmez</span></footer>
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
