import { useEffect, useMemo, useState } from 'react';
import {
  Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, Bell, ChevronDown,
  CircleHelp, Clock3, Download, LayoutDashboard, Play, Search, Settings2,
  ShieldCheck, SlidersHorizontal, Sparkles, Wallet,
} from 'lucide-react';

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
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Activity size={19} strokeWidth={2.4} /></div><span>piyasa<span className="brand-dot">.</span>lab</span></div>
      <div className="workspace-label">ARAŞTIRMA MASASI</div>
      <nav className="side-nav" aria-label="Ana menü">
        <a className="nav-item active" href="#terminal"><LayoutDashboard size={17} /> Terminal</a>
        <a className="nav-item" href="#strategies"><BarChart3 size={17} /> Stratejiler <span className="nav-count">4</span></a>
        <a className="nav-item" href="#risk"><ShieldCheck size={17} /> Risk analizi</a>
      </nav>
      <div className="side-divider" />
      <div className="workspace-label">VERİ KÜMESİ</div>
      <div className="dataset-item"><span className="history-dot green" /><span><b>THYAO.IS</b><small>Günlük · 2023—2026</small></span><span className="dataset-check">●</span></div>
      <div className="sidebar-bottom"><div className="connection"><span className={`live-dot ${apiOnline ? '' : 'offline'}`} /> Python motoru <span className={`connected ${apiOnline ? '' : 'offline-text'}`}>{apiOnline ? 'Bağlı' : 'Çevrimdışı'}</span></div><button className="nav-item help"><CircleHelp size={17} /> Yardım ve dokümantasyon</button><div className="user-row"><div className="avatar">BA</div><div><b>Backtest ekibi</b><small>Akademik çalışma alanı</small></div><Settings2 size={16} className="user-settings" /></div></div>
    </aside>

    <main className="main" id="terminal">
      <header className="topbar"><div className="breadcrumbs">Araştırma <span>/</span> <b>Backtest terminali</b></div><div className="top-actions"><div className="market-status"><span className="live-dot" /> BIST verisi <span className="status-divider" /> Gecikmeli</div><button className="icon-button" aria-label="Bildirimler"><Bell size={18} /><i /></button><div className="avatar small">BA</div></div></header>
      <div className="content">
        <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> BIST · STRATEJİ ARAŞTIRMASI</div><h1>Backtest terminali</h1><p>Stratejini geçmiş piyasa verilerinde çalıştır. Sonuçları ölç, riski gör.</p></div><button className="quiet-button" onClick={() => setResult(null)}><Clock3 size={15} /> Yeni çalışma</button></section>

        <section className="run-panel" aria-label="Backtest ayarları">
          <div className="panel-heading"><div className="panel-icon"><SlidersHorizontal size={17} /></div><div><h2>Simülasyon ayarları</h2><p>Parametreleri belirle ve geçmiş veride çalıştır.</p></div><span className="panel-step">01 <span>/</span> 03</span></div>
          <div className="form-grid">
            <label className="field"><span>HİSSE SENEDİ</span><div className="input-wrap ticker-input"><Search size={15} /><input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} aria-label="Hisse senedi sembolü" /><span className="exchange-tag">BIST</span></div></label>
            <label className="field"><span>STRATEJİ</span><div className="select-wrap"><select value={strategy} onChange={e => setStrategy(e.target.value)} aria-label="Strateji seç"><option>SMA Crossover</option><option>RSI</option><option>MACD</option><option>Buy &amp; Hold</option></select><ChevronDown size={15} /></div></label>
            <label className="field"><span>BAŞLANGIÇ SERMAYESİ</span><div className="input-wrap"><Wallet size={15} /><input value={capital} onChange={e => setCapital(e.target.value)} inputMode="numeric" aria-label="Başlangıç sermayesi" /><span className="suffix">₺</span></div></label>
            <label className="field"><span>KOMİSYON</span><div className="input-wrap"><input value={commission} onChange={e => setCommission(e.target.value)} inputMode="decimal" aria-label="Komisyon oranı" /><span className="suffix">%</span></div></label>
          </div>
          <div className="panel-footer"><button className={`risk-toggle ${riskEnabled ? 'enabled' : ''}`} onClick={() => setRiskEnabled(!riskEnabled)} aria-pressed={riskEnabled}><span className="toggle-track"><span /></span><ShieldCheck size={15} /><span>Risk yönetimi</span><span className="risk-hint">Stop-loss · Take-profit</span></button><div className="run-controls"><span className="date-range"><Clock3 size={14} /> 2023 — 2026 <ChevronDown size={13} /></span><button className="run-button" onClick={runBacktest} disabled={busy || !symbol}><Play size={15} fill="currentColor" />{busy ? 'Çalışıyor…' : 'Backtest çalıştır'}</button></div></div>
          {error && <div className="error-message" role="alert">{error}</div>}
        </section>

        <div className="results-heading"><div><div className="section-title"><h2>Performans özeti</h2><span className="period-badge">{result?.period ?? 'SONUÇ BEKLENİYOR'}</span></div><p>{result ? `${result.symbol} · ${result.strategy} · ${chartData.length.toLocaleString('tr-TR')} işlem günü` : 'Çalıştırdığında performans metrikleri burada görünecek.'}</p></div><button className="export-button" disabled={!result} onClick={() => result && downloadCsv(result)}><Download size={15} /> Dışa aktar</button></div>

        <section className="metric-grid" aria-label="Performans metrikleri">
          <MetricCard label="TOPLAM GETİRİ" value={metrics ? formatPercent(metrics.total_return) : '—'} detail={metrics ? `${formatTRY(Number(capital) * (1 + metrics.total_return))} portföy değeri` : 'Başlangıçtan bugüne'} trend={metrics ? metrics.total_return >= 0 : null} icon={<ArrowUpRight size={16} />} />
          <MetricCard label="SHARPE ORANI" value={metrics ? metrics.sharpe_ratio.toFixed(2) : '—'} detail="Yıllıklandırılmış · 252 gün" icon={<Activity size={16} />} />
          <MetricCard label="MAKS. DÜŞÜŞ" value={metrics ? formatPercent(metrics.max_drawdown) : '—'} detail="Zirveden en düşük noktaya" trend={metrics ? false : null} icon={<ArrowDownRight size={16} />} />
          <MetricCard label="KAZANMA ORANI" value={metrics ? formatPercent(metrics.win_rate) : '—'} detail={metrics ? `${metrics.closed_trades} kapanan işlem` : 'Kapanan işlemlere göre'} icon={<BarChart3 size={16} />} />
        </section>

        <section className="chart-card"><div className="chart-head"><div><h2>Portföy performansı</h2><p>Strateji portföyü ve al-tut karşılaştırması</p></div><div className="legend"><span><i className="legend-strategy" /> Strateji</span><span><i className="legend-benchmark" /> Al-tut</span></div></div><div className="chart-wrap">{chartData.length ? <ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData} margin={{ top: 16, right: 10, bottom: 0, left: 2 }}><defs><linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c5f36b" stopOpacity={0.17} /><stop offset="100%" stopColor="#c5f36b" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#242a31" vertical={false} /><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#737d88', fontSize: 11 }} minTickGap={44} /><YAxis tickLine={false} axisLine={false} tick={{ fill: '#737d88', fontSize: 11 }} tickFormatter={v => `${Math.round(v / 1000)}k`} width={44} /><Tooltip contentStyle={{ background: '#171c22', border: '1px solid #303741', borderRadius: 8, color: '#e9edf0' }} formatter={(v: number) => formatTRY(v)} /><Area type="monotone" dataKey="equity" stroke="#c5f36b" strokeWidth={2} fill="url(#equityFill)" name="Strateji" /><Line type="monotone" dataKey="benchmark" stroke="#73808d" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Al-tut" /></ComposedChart></ResponsiveContainer> : <EmptyChart onRun={runBacktest} />}</div><div className="chart-foot"><span><span className="live-dot" /> Günlük kapanış fiyatları</span><span>Kaynak: Yahoo Finance · Gecikmeli piyasa verisi</span></div></section>

        <section className="lower-grid"><div className="data-card"><div className="card-heading"><div><h2>İşlem günlüğü</h2><p>{result ? `${closedTrades.length} kapanmış işlem` : 'Gerçekleşen alım ve satımlar'}</p></div><button className="text-button" onClick={() => document.getElementById('trade-table')?.scrollIntoView({ behavior: 'smooth' })}>Günlüğe git <ArrowUpRight size={14} /></button></div><div className="table-scroll" id="trade-table"><table><thead><tr><th>GİRİŞ</th><th>ÇIKIŞ</th><th>GETİRİ</th><th>ÇIKIŞ KURALI</th></tr></thead><tbody>{closedTrades.length ? closedTrades.slice(-5).reverse().map((trade, i) => <tr key={`${trade.entry_date}-${i}`}><td>{trade.entry_date} · {formatTRY(trade.entry_price)}</td><td>{trade.exit_date} · {formatTRY(trade.exit_price)}</td><td className={trade.pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}>{formatTRY(trade.pnl)}</td><td><span className={`trade-pill ${trade.exit_reason === 'signal' ? 'buy' : 'sell'}`}>{trade.exit_reason === 'signal' ? 'Sinyal' : trade.exit_reason === 'stop_loss' ? 'Stop-loss' : 'Take-profit'}</span></td></tr>) : <tr><td colSpan={4} className="empty-row">{result ? 'Bu dönemde kapanmış işlem yok.' : 'Backtest sonrası işlem kayıtları listelenir.'}</td></tr>}</tbody></table></div></div>
          <div className="insight-card"><div className="insight-top"><div className="insight-icon"><Sparkles size={17} /></div><span>ARAŞTIRMA NOTU</span></div><h3>Sonucu test döneminde doğrula</h3><p>Optimizasyon dönemindeki yüksek getiri tek başına yeterli değildir. Parametreleri seçerken test verisini dışarıda tut.</p><button className="insight-link" onClick={() => window.open('https://scholarworks.wmich.edu/math_pubs/42/', '_blank', 'noopener,noreferrer')}>Backtest overfitting makalesi <ArrowUpRight size={14} /></button></div></section>
        <footer className="app-footer"><span>piyasa.lab <span>·</span> Akademik simülasyon aracı</span><span>Gerçek emir gönderilmez</span></footer>
      </div>
    </main>
  </div>;
}

function MetricCard({ label, value, detail, trend, icon }: { label: string; value: string; detail: string; trend?: boolean | null; icon: React.ReactNode }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><div className={`metric-value ${trend === true ? 'positive' : trend === false ? 'caution' : ''}`}>{value}</div><div className="metric-detail">{detail}</div></article>;
}

function EmptyChart({ onRun }: { onRun: () => void }) {
  return <div className="empty-chart"><div className="empty-chart-icon"><Activity size={22} /></div><strong>Performans grafiği hazır</strong><span>Seçili hissede simülasyonu başlat.</span><button onClick={onRun}><Play size={13} fill="currentColor" /> Backtest çalıştır</button></div>;
}

function downloadCsv(data: BacktestResponse) {
  const content = ['date,price,equity,benchmark', ...data.points.map(p => `${p.date},${p.price},${p.equity},${p.benchmark}`)].join('\n');
  const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([content], { type: 'text/csv' })); link.download = `${data.symbol}-backtest.csv`; link.click(); URL.revokeObjectURL(link.href);
}

export default App;
