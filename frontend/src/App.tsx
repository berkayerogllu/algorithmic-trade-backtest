import { useEffect, useMemo, useState } from 'react';
import {
  Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { Download, Save, Trash2 } from 'lucide-react';
import { StockPicker } from './StockPicker';
import { Market } from './stockSymbols';

type Point = { date: string; price: number; equity: number; benchmark: number; indicators?: Record<string, number | null> };
type Metrics = { total_return: number; sharpe_ratio: number; max_drawdown: number; win_rate: number; closed_trades: number };
type Trade = { entry_date: string; exit_date: string; entry_price: number; exit_price: number; pnl: number; exit_reason: string };
type Interval = '1d' | '1wk' | '1mo';
type IndicatorLine = { key: string; name: string; kind: 'price' | 'oscillator' | 'spread' };
type BacktestResponse = { points: Point[]; trades: Trade[]; metrics: Metrics; strategy: Strategy; symbol: string; market?: Market; period: string; source: string; parameters: Record<string, number>; interval?: Interval; components?: StrategyComponent[]; combination_method?: CombinationMethod | null; risk_enabled?: boolean; stop_loss_pct?: number; take_profit_pct?: number; indicator_lines?: IndicatorLine[] };
type BacktestRun = { id: string; savedAt: string; result: BacktestResponse };
type ForecastResponse = { symbol: string; market?: Market; source: string; as_of: string; last_close: number; predicted_return: number; predicted_close: number; lower_close: number; upper_close: number; horizon: number; validation_mae_pct: number; baseline_mae_pct: number; directional_accuracy: number; validation_samples: number; beats_baseline: boolean; history: { date: string; close: number }[] };

type IndicatorStrategy = 'SMA Crossover' | 'EMA Crossover' | 'RSI' | 'MACD' | 'Bollinger Bands' | 'Stochastic Oscillator' | 'Donchian Channel';
type Strategy = IndicatorStrategy | 'Buy & Hold' | 'Combined';
type CombinationMethod = 'AND' | 'OR' | 'MAJORITY';
type StrategyComponent = { strategy: IndicatorStrategy; parameters: Record<string, number> };
const strategyOptions: { name: Strategy; category: string; summary: string; rule: string }[] = [
  { name: 'SMA Crossover', category: 'Trend', summary: 'Kısa ve uzun dönem fiyat ortalamasını karşılaştırır.', rule: 'Kısa ortalama uzun ortalamanın üstündeyken pozisyonda kalır.' },
  { name: 'EMA Crossover', category: 'Trend', summary: 'Son fiyatlara daha fazla ağırlık veren ortalamaları karşılaştırır.', rule: 'Hızlı üssel ortalama yavaş ortalamanın üstündeyken pozisyonda kalır.' },
  { name: 'RSI', category: 'Momentum', summary: 'Fiyatın son dönemde ne kadar hızlı değiştiğini ölçer.', rule: 'RSI alım eşiğinin altına inince girer, çıkış eşiğinin üstüne çıkınca pozisyonu kapatır.' },
  { name: 'MACD', category: 'Trend + momentum', summary: 'İki üssel ortalama arasındaki yön değişimini izler.', rule: 'MACD çizgisi sinyal çizgisinin üstündeyken pozisyonda kalır.' },
  { name: 'Bollinger Bands', category: 'Oynaklık', summary: 'Fiyatın hareketli ortalamaya göre sıra dışı uzaklaşmasını izler.', rule: 'Fiyat alt bandın altına indiğinde alır, orta ortalamanın üstüne toparlanınca çıkar.' },
  { name: 'Stochastic Oscillator', category: 'Momentum', summary: 'Kapanışı son aralığın yüksek ve düşük değerleriyle karşılaştırır.', rule: 'Aşırı satım bölgesindeki K/D yukarı kesişiminde girer; aşırı alım bölgesindeki aşağı kesişimde çıkar.' },
  { name: 'Donchian Channel', category: 'Kırılım', summary: 'Son dönem en yüksek ve en düşük fiyatlarını kanal olarak izler.', rule: 'Önceki kanalın üstü kırılınca girer, altı kırılınca çıkar.' },
  { name: 'Combined', category: 'Birleşik sinyal', summary: 'Birden fazla gösterge sinyalini tek kuralla bir araya getirir.', rule: 'İki veya daha fazla indikatör seçin; AND, OR ya da çoğunluk oyuyla sinyal üretin.' },
  { name: 'Buy & Hold', category: 'Karşılaştırma', summary: 'İlk işlem gününde alır ve dönem boyunca taşır.', rule: 'İndikatör sinyali üretmez; diğer stratejiler için baz çizgisidir.' },
];
const strategyPresets: Record<IndicatorStrategy, [string, string, number][]> = {
  'SMA Crossover': [['fast_period', 'Kısa ortalama (bar)', 20], ['slow_period', 'Uzun ortalama (bar)', 50]],
  'EMA Crossover': [['fast_period', 'Hızlı EMA (bar)', 12], ['slow_period', 'Yavaş EMA (bar)', 26]],
  RSI: [['period', 'RSI dönemi (bar)', 14], ['oversold', 'Alım eşiği', 30], ['overbought', 'Çıkış eşiği', 70]],
  MACD: [['fast_period', 'Hızlı EMA (bar)', 12], ['slow_period', 'Yavaş EMA (bar)', 26], ['signal_period', 'Sinyal dönemi (bar)', 9]],
  'Bollinger Bands': [['period', 'Ortalama dönemi (bar)', 20], ['deviations', 'Standart sapma', 2]],
  'Stochastic Oscillator': [['k_period', 'K dönemi (bar)', 14], ['d_period', 'D dönemi (bar)', 3], ['oversold', 'Aşırı satım', 20], ['overbought', 'Aşırı alım', 80]],
  'Donchian Channel': [['period', 'Kanal dönemi (bar)', 20]],
};
const backtestDatePeriods = [
  { id: '1m', label: '1 ay', months: 1 },
  { id: '3m', label: '3 ay', months: 3 },
  { id: '6m', label: '6 ay', months: 6 },
  { id: '1y', label: '1 yıl', months: 12 },
  { id: '3y', label: '3 yıl', months: 36 },
  { id: '5y', label: '5 yıl', months: 60 },
  { id: '10y', label: '10 yıl', months: 120 },
  { id: '20y', label: '20 yıl', months: 240 },
];
const forecastDatePeriods = backtestDatePeriods.filter(period => period.months >= 6);
const intervalLabels: Record<Interval, string> = { '1d': 'Günlük', '1wk': 'Haftalık', '1mo': 'Aylık' };
const intervalsPerYear: Record<Interval, number> = { '1d': 252, '1wk': 52, '1mo': 12 };
const combinationDescriptions: Record<CombinationMethod, string> = {
  AND: 'Alım için seçilen tüm stratejiler pozisyonda olmalı. Sinyal koşullarını sıkılaştırır.',
  OR: 'Seçilen stratejilerden biri pozisyona girerse alım yapılır. Daha sık sinyal üretir.',
  MAJORITY: 'Stratejilerin yarısından fazlası aynı yönde olduğunda pozisyona girilir.',
};
const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const todayISO = () => isoDate(new Date());
const monthsAgoISO = (months: number) => {
  const today = new Date();
  const monthIndex = today.getMonth() - months;
  const year = today.getFullYear() + Math.floor(monthIndex / 12);
  const month = (monthIndex % 12 + 12) % 12;
  const day = Math.min(today.getDate(), new Date(year, month + 1, 0).getDate());
  return isoDate(new Date(year, month, day));
};
const isIndicatorStrategy = (strategy: Strategy): strategy is IndicatorStrategy => strategy !== 'Buy & Hold' && strategy !== 'Combined';
const strategyDisplayName = (strategy: Strategy) => strategy === 'Combined' ? 'Birleşik strateji' : strategy;
const strategyParameterSummary = (result: BacktestResponse) => {
  const bars = result.interval ?? '1d';
  if (result.strategy === 'Combined') {
    const names = (result.components ?? []).map(component => component.strategy).join(' + ');
    return `${names} · ${result.combination_method ?? 'AND'} · ${intervalLabels[bars].toLocaleLowerCase('tr-TR')} bar`;
  }
  if (result.strategy === 'SMA Crossover') return `SMA ${result.parameters.fast_period ?? 20}/${result.parameters.slow_period ?? 50} bar`;
  if (result.strategy === 'EMA Crossover') return `EMA ${result.parameters.fast_period ?? 12}/${result.parameters.slow_period ?? 26} bar`;
  if (result.strategy === 'RSI') return `RSI ${result.parameters.period ?? 14} bar · al < ${result.parameters.oversold ?? 30} · çık > ${result.parameters.overbought ?? 70}`;
  if (result.strategy === 'MACD') return `EMA ${result.parameters.fast_period ?? 12}/${result.parameters.slow_period ?? 26} · sinyal ${result.parameters.signal_period ?? 9}`;
  if (result.strategy === 'Bollinger Bands') return `Bollinger ${result.parameters.period ?? 20} bar · ${result.parameters.deviations ?? 2}σ`;
  if (result.strategy === 'Stochastic Oscillator') return `Stochastic ${result.parameters.k_period ?? 14}/${result.parameters.d_period ?? 3}`;
  if (result.strategy === 'Donchian Channel') return `Donchian ${result.parameters.period ?? 20} bar`;
  return 'İlk barda al · dönem boyunca tut';
};
const formatMoney = (n: number, market: Market = 'BIST') => new Intl.NumberFormat(market === 'US' ? 'en-US' : 'tr-TR', { style: 'currency', currency: market === 'US' ? 'USD' : 'TRY', maximumFractionDigits: 0 }).format(n);
const formatPercent = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`;
const formatPercentagePoints = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function App() {
  const [market, setMarket] = useState<Market>('BIST');
  const [history, setHistory] = useState<BacktestRun[]>([]);
  const [historyQuery, setHistoryQuery] = useState('');
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [historyBusy, setHistoryBusy] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [strategy, setStrategy] = useState<Strategy>('SMA Crossover');
  const [selectedComponents, setSelectedComponents] = useState<IndicatorStrategy[]>(['SMA Crossover', 'RSI']);
  const [componentParameters, setComponentParameters] = useState<Record<string, Record<string, string>>>({});
  const [combinationMethod, setCombinationMethod] = useState<CombinationMethod>('AND');
  const [interval, setInterval] = useState<Interval>('1d');
  const [mode, setMode] = useState<'backtest' | 'forecast'>('backtest');
  const [horizon, setHorizon] = useState(5);
  const [symbol, setSymbol] = useState('THYAO.IS');
  const [start, setStart] = useState(() => monthsAgoISO(36));
  const [end, setEnd] = useState(todayISO);
  const [datePeriod, setDatePeriod] = useState('3y');
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [showIndicatorComparison, setShowIndicatorComparison] = useState(false);
  const [capital, setCapital] = useState('100000');
  const [commission, setCommission] = useState('0.1');
  const [riskEnabled, setRiskEnabled] = useState(true);
  const [stopLossPct, setStopLossPct] = useState('5');
  const [takeProfitPct, setTakeProfitPct] = useState('10');
  const [busy, setBusy] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);
  const [databaseOnline, setDatabaseOnline] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BacktestResponse | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);

  const chartData = useMemo(() => result?.points ?? [], [result]);
  const indicatorChartData = useMemo(() => {
    if (!result) return [];
    const firstPrice = result.points.find(point => point.price > 0)?.price ?? 1;
    return result.points.map(point => {
      const indicators = Object.fromEntries((result.indicator_lines ?? []).map(line => {
        const value = point.indicators?.[line.key];
        if (value == null || !Number.isFinite(value)) return [line.key, null];
        if (line.kind === 'price') return [line.key, value / firstPrice * 100];
        if (line.kind === 'oscillator') return [line.key, 50 + value];
        return [line.key, 100 + value / point.price * 100];
      }));
      return { ...point, priceIndex: point.price / firstPrice * 100, ...indicators };
    });
  }, [result]);
  const closedTrades = result?.trades ?? [];
  const benchmarkReturn = chartData.length > 1 ? chartData[chartData.length - 1].benchmark / chartData[0].benchmark - 1 : null;
  const filteredHistory = useMemo(() => {
    const query = historyQuery.trim().toLocaleLowerCase('tr-TR');
    if (!query) return history;
    return history.filter(run => `${run.result.symbol} ${run.result.strategy} ${run.result.period}`.toLocaleLowerCase('tr-TR').includes(query));
  }, [history, historyQuery]);
  useEffect(() => {
    const checkApi = () => fetch('/api/health').then(async response => {
      const health = await response.json().catch(() => null);
      setApiOnline(response.ok);
      setDatabaseOnline(response.ok && health?.database === 'connected');
    }).catch(() => { setApiOnline(false); setDatabaseOnline(false); });
    checkApi();
    const timer = window.setInterval(checkApi, 15000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/history').then(async response => {
      if (!response.ok) throw new Error('Supabase test geçmişine ulaşılamıyor.');
      return await response.json() as BacktestRun[];
    }).then(savedRuns => {
      if (!cancelled) { setHistory(savedRuns); setHistoryError(''); }
    }).catch(e => {
      if (!cancelled) setHistoryError(e instanceof Error ? e.message : 'Test geçmişi yüklenemedi.');
    }).finally(() => { if (!cancelled) setHistoryBusy(false); });
    return () => { cancelled = true; };
  }, []);
  const runBacktest = async () => {
    setBusy(true); setError('');
    try {
      const makeParameters = (name: IndicatorStrategy, values: Record<string, string> = parameters) => Object.fromEntries(
        strategyPresets[name].map(([key, , fallback]) => [key, Number(values[key] ?? fallback)]),
      );
      const components = strategy === 'Combined'
        ? selectedComponents.map(name => ({ strategy: name, parameters: makeParameters(name, componentParameters[name] ?? {}) }))
        : [];
      const response = await fetch('/api/backtest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: symbol.trim(), market, strategy, interval, components, combination_method: combinationMethod, start_date: start, end_date: end || null, parameters: isIndicatorStrategy(strategy) ? makeParameters(strategy) : {}, initial_cash: Number(capital), commission_rate: Number(commission) / 100, risk_enabled: riskEnabled, stop_loss_pct: Number(stopLossPct), take_profit_pct: Number(takeProfitPct) }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(typeof body?.detail === 'string' ? body.detail : 'Simülasyon çalıştırılamadı. Ayarları ve sunucu bağlantısını kontrol edin.');
      }
      const backtestResult = await response.json() as BacktestResponse;
      setResult({ ...backtestResult, interval, risk_enabled: riskEnabled, stop_loss_pct: Number(stopLossPct), take_profit_pct: Number(takeProfitPct) });
      setActiveHistoryId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sunucuya ulaşılamadı. Python API sunucusunu başlatın.');
    } finally { setBusy(false); }
  };

  const chooseDatePeriod = (months: number | null, id: string) => {
    if (months !== null) {
      setStart(monthsAgoISO(months));
      setEnd(todayISO());
    }
    setDatePeriod(id);
  };

  const openBacktestRun = (run: BacktestRun) => {
    setResult(run.result);
    setActiveHistoryId(run.id);
    setMode('backtest');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveCurrentBacktest = async () => {
    if (!result || activeHistoryId || historyBusy) return;
    setHistoryBusy(true); setHistoryError('');
    try {
      const response = await fetch('/api/history', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof body?.detail === 'string' ? body.detail : 'Backtest Supabase’e kaydedilemedi.');
      const run = body as BacktestRun;
      setHistory(current => [run, ...current].slice(0, 10));
      setActiveHistoryId(run.id);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : 'Backtest Supabase’e kaydedilemedi.');
    } finally { setHistoryBusy(false); }
  };

  const removeBacktestRun = async (runId: string) => {
    setHistoryBusy(true); setHistoryError('');
    try {
      const response = await fetch(`/api/history/${runId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Kayıt Supabase’den silinemedi.');
      setHistory(current => current.filter(run => run.id !== runId));
      if (activeHistoryId === runId) setActiveHistoryId(null);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : 'Kayıt silinemedi.');
    } finally { setHistoryBusy(false); }
  };

  const clearBacktestHistory = async () => {
    if (!window.confirm('Supabase’de kaydedilmiş tüm test geçmişi silinsin mi?')) return;
    setHistoryBusy(true); setHistoryError('');
    try {
      const response = await fetch('/api/history', { method: 'DELETE' });
      if (!response.ok) throw new Error('Test geçmişi Supabase’den temizlenemedi.');
      setHistory([]);
      setActiveHistoryId(null);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : 'Test geçmişi temizlenemedi.');
    } finally { setHistoryBusy(false); }
  };

  const runForecast = async () => {
    setBusy(true); setError(''); setForecast(null);
    try {
      const response = await fetch('/api/forecast', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: symbol.trim(), market, horizon, start_date: start, end_date: end || null }),
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
      <span className="connection">Simülasyon · {apiOnline ? 'Bağlı' : 'Çevrimdışı'} · Supabase · {databaseOnline ? 'Bağlı' : 'Bağlantı yok'}</span>
    </header>
    <main id="terminal" className="content">
        <header className="page-heading">
          <h1>BIST &amp; ABD hisse araştırması</h1>
          <p>İki piyasa için geçmiş veriyi inceleyin, stratejileri test edin ve tahmin performansını ölçün.</p>
        </header>

        <div className="mode-tabs" role="tablist" aria-label="Analiz türü">
          <button type="button" role="tab" aria-selected={mode === 'backtest'} className={mode === 'backtest' ? 'selected' : ''} onClick={() => { setMode('backtest'); setError(''); }}>Geriye dönük test</button>
          <button type="button" role="tab" aria-selected={mode === 'forecast'} className={mode === 'forecast' ? 'selected' : ''} onClick={() => { setMode('forecast'); setError(''); }}>Tahmin araştırması</button>
        </div>

        {mode === 'backtest' && <>

        <form className="run-panel" onSubmit={event => { event.preventDefault(); void runBacktest(); }}>
          <h2>Backtest ayarları</h2>
          <p className="panel-intro">Bir hisse ve sinyal yöntemi seçin. Her stratejinin sonucu aynı dönem için al-tut ile karşılaştırılır.</p>
          <div className="form-grid configuration-grid">
            <div className="field stock-field"><span>Hisse</span><StockPicker value={symbol} market={market} onChange={setSymbol} onMarketChange={setMarket} /></div>
            <label className="field"><span>Başlangıç sermayesi</span><div className="input-wrap"><input value={capital} onChange={e => setCapital(e.target.value)} inputMode="numeric" aria-label="Başlangıç sermayesi" /><span className="suffix">{market === 'US' ? '$' : '₺'}</span></div></label>
            <label className="field"><span>Komisyon</span><div className="input-wrap"><input value={commission} onChange={e => setCommission(e.target.value)} inputMode="decimal" aria-label="Komisyon oranı" /><span className="suffix">%</span></div></label>
          </div>

          <section className="strategy-selector" aria-labelledby="strategy-heading">
            <div className="section-heading"><h3 id="strategy-heading">Strateji</h3><p>Farkı ve kullandığı sinyali görerek seçin.</p></div>
            <div className="strategy-options" role="group" aria-label="Backtest stratejisi">
              {strategyOptions.map(option => <button type="button" aria-pressed={strategy === option.name} className={`strategy-option ${strategy === option.name ? 'selected' : ''}`} key={option.name} onClick={() => { setStrategy(option.name); setParameters({}); }}>
                <span className="strategy-option-top"><strong>{option.name}</strong><span>{option.category}</span></span>
                <span className="strategy-option-summary">{option.summary}</span>
              </button>)}
            </div>
            <div className="strategy-detail" aria-live="polite">
              <div className="strategy-rule"><span>Bu strateji ne yapar?</span><p>{strategyOptions.find(option => option.name === strategy)?.rule}{strategy === 'Buy & Hold' && riskEnabled ? ' Risk sınırları açıksa daha erken çıkabilir.' : ''}</p></div>
              {isIndicatorStrategy(strategy) && <div className="strategy-parameters">
                <span className="parameter-heading">İndikatör ayarları</span>
                <div className={`parameter-fields count-${strategyPresets[strategy].length}`}>
                  {strategyPresets[strategy].map(([key, label, fallback]) => (
                    <label className="field" key={key}>{label}
                      <input type="number" min={key.endsWith('sold') || key === 'overbought' ? 0 : 1} max={key === 'oversold' || key === 'overbought' ? 100 : undefined} required aria-label={label}
                        value={parameters[key] ?? fallback}
                        onChange={event => setParameters({ ...parameters, [key]: event.target.value })} />
                    </label>
                  ))}
                </div>
              </div>}
            </div>
            {strategy === 'Combined' && <div className="combined-builder">
              <fieldset className="component-picker">
                <legend>Birleştirilecek indikatörler <span>{selectedComponents.length} seçili</span></legend>
                <p>En az iki farklı indikatör seçin. Buy &amp; Hold karşılaştırma çizgisi olarak ayrıca gösterilir.</p>
                <div className="component-options">
                  {strategyOptions.filter(option => isIndicatorStrategy(option.name)).map(option => {
                    const name = option.name as IndicatorStrategy;
                    const checked = selectedComponents.includes(name);
                    return <label className={`component-option ${checked ? 'selected' : ''}`} key={name}>
                      <input type="checkbox" checked={checked} onChange={event => setSelectedComponents(current => event.target.checked ? [...current, name] : current.filter(item => item !== name))} />
                      <span><strong>{name}</strong><small>{option.category}</small></span>
                    </label>;
                  })}
                </div>
              </fieldset>
              <div className="combination-rule">
                <label className="field">Sinyal birleştirme kuralı
                  <select value={combinationMethod} onChange={event => setCombinationMethod(event.target.value as CombinationMethod)}>
                    <option value="AND">AND · Hepsi onaylasın</option>
                    <option value="OR">OR · En az biri onaylasın</option>
                    <option value="MAJORITY">Çoğunluk oyu</option>
                  </select>
                </label>
                <p>{combinationDescriptions[combinationMethod]}</p>
              </div>
              {selectedComponents.map(name => <section className="component-parameters" key={name} aria-label={`${name} ayarları`}>
                <h4>{name}</h4>
                <div className={`parameter-fields count-${strategyPresets[name].length}`}>
                  {strategyPresets[name].map(([key, label, fallback]) => (
                    <label className="field" key={key}>{label}
                      <input type="number" min={key.endsWith('sold') || key === 'overbought' ? 0 : 1} max={key === 'oversold' || key === 'overbought' ? 100 : undefined} required
                        value={componentParameters[name]?.[key] ?? fallback}
                        onChange={event => setComponentParameters(current => ({ ...current, [name]: { ...current[name], [key]: event.target.value } }))} />
                    </label>
                  ))}
                </div>
              </section>)}
              {selectedComponents.length < 2 && <p className="field-guidance" role="status">Birleşik sinyal için en az iki indikatör seçin.</p>}
            </div>}
          </section>

          <section className="interval-section" aria-labelledby="interval-heading">
            <div className="section-heading"><h3 id="interval-heading">Veri sıklığı</h3><p>İndikatör dönemleri seçilen sıklıktaki bar sayısıdır.</p></div>
            <div className="interval-options" role="group" aria-label="Backtest veri sıklığı">
              {(['1d', '1wk', '1mo'] as Interval[]).map(value => <button type="button" key={value} aria-pressed={interval === value} className={interval === value ? 'selected' : ''} onClick={() => setInterval(value)}>
                <strong>{intervalLabels[value]}</strong><small>{value === '1d' ? 'Her işlem günü' : value === '1wk' ? 'Haftalık kapanış' : 'Ay sonu kapanışı'}</small>
              </button>)}
            </div>
          </section>
          <DateRangePicker periods={backtestDatePeriods} start={start} end={end} datePeriod={datePeriod} onChoosePeriod={chooseDatePeriod} onStartChange={value => { setStart(value); setDatePeriod('custom'); }} onEndChange={value => { setEnd(value); setDatePeriod('custom'); }} />

          <div className="panel-footer">
            <div className="risk-control">
              <label className="risk-toggle"><input type="checkbox" checked={riskEnabled} onChange={event => setRiskEnabled(event.target.checked)} /><span>Risk çıkışlarını uygula</span></label>
              {riskEnabled ? <>
                <div className="risk-thresholds">
                  <label className="field"><span>Zarar durdur</span><div className="input-wrap"><input type="number" min="0.1" max="99.9" step="0.1" required value={stopLossPct} onChange={event => setStopLossPct(event.target.value)} aria-label="Zarar durdur yüzdesi" /><span className="suffix">%</span></div></label>
                  <label className="field"><span>Kâr al</span><div className="input-wrap"><input type="number" min="0.1" max="99.9" step="0.1" required value={takeProfitPct} onChange={event => setTakeProfitPct(event.target.value)} aria-label="Kâr al yüzdesi" /><span className="suffix">%</span></div></label>
                </div>
                <p>Her pozisyonun giriş fiyatına göre kapanışta uygulanır.</p>
              </> : <p>Pozisyonlar yalnızca strateji sinyaliyle kapanır.</p>}
            </div>
            <button className="run-button" disabled={busy || !symbol.trim() || (strategy === 'Combined' && selectedComponents.length < 2)}>
              {busy ? 'Simülasyon çalışıyor…' : 'Simülasyonu çalıştır'}
            </button>
          </div>
          {error && <div className="error-message" role="alert">{error}</div>}
        </form>

        <section className="history-section" aria-labelledby="history-heading">
          <div className="history-heading">
            <div>
              <div className="history-title-line"><h2 id="history-heading">Test geçmişi</h2><span className="history-count">{history.length} / 10 kayıt</span></div>
              <p>Yalnızca “Geçmişe kaydet” dediğiniz sonuçlar Supabase’de saklanır. Geçmişten testi açıp grafik ve işlem günlüğüne dönün.</p>
            </div>
            {history.length > 0 && <div className="history-tools">
              <label className="history-search"><span className="sr-only">Test geçmişinde ara</span><input value={historyQuery} onChange={event => setHistoryQuery(event.target.value)} placeholder="Hisse veya strateji ara" /></label>
              <button type="button" className="history-clear" onClick={clearBacktestHistory}>Geçmişi temizle</button>
            </div>}
          </div>
          {historyError && <div className="error-message" role="alert">{historyError}</div>}
          {filteredHistory.length ? <div className="history-list">
            {filteredHistory.map(run => <div className="history-row" key={run.id}>
              <button type="button" className={`history-item ${run.id === activeHistoryId ? 'active' : ''}`} aria-pressed={run.id === activeHistoryId} onClick={() => openBacktestRun(run)}>
                <span className="history-run-info"><strong>{run.result.symbol}</strong><span>{strategyDisplayName(run.result.strategy)}</span><small>{run.result.period} · {intervalLabels[run.result.interval ?? '1d']} · {new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(run.savedAt))}</small></span>
                <span className={`history-metric ${run.result.metrics.total_return >= 0 ? 'positive' : 'pnl-negative'}`}><small>Toplam getiri</small><strong>{formatPercent(run.result.metrics.total_return)}</strong></span>
                <span className="history-metric"><small>Sharpe</small><strong>{run.result.metrics.sharpe_ratio.toFixed(2)}</strong></span>
                <span className="history-metric"><small>Azami düşüş</small><strong>{formatPercent(run.result.metrics.max_drawdown)}</strong></span>
                <span className="history-trades">{run.result.metrics.closed_trades} işlem <span aria-hidden="true">· Aç</span></span>
              </button>
              <button type="button" className="history-remove" aria-label={`${run.result.symbol} ${run.result.strategy} kaydını sil`} title="Bu kaydı sil" onClick={() => removeBacktestRun(run.id)}><Trash2 size={16} aria-hidden="true" /></button>
            </div>)}
          </div> : <div className="history-empty">{historyBusy ? 'Supabase test geçmişi yükleniyor…' : history.length ? 'Bu aramayla eşleşen test yok.' : 'Henüz kaydedilmiş test yok. Bir backtest çalıştırıp saklamak istediğiniz sonucu “Geçmişe kaydet” ile ekleyin.'}</div>}
        </section>

        <div className="results-heading"><div><div className="section-title"><h2>Performans özeti</h2><span className="period-badge">{result?.period}</span></div><p>{result ? `${result.symbol} · ${strategyDisplayName(result.strategy)} · ${chartData.length.toLocaleString('tr-TR')} ${intervalLabels[result.interval ?? '1d'].toLocaleLowerCase('tr-TR')} bar` : 'Henüz bir simülasyon çalıştırılmadı.'}</p>{result && <p className="result-parameters">{strategyParameterSummary(result)}{result.risk_enabled === undefined ? '' : result.risk_enabled ? ` · Risk çıkışları açık · SL %${result.stop_loss_pct ?? 5} / TP %${result.take_profit_pct ?? 10}` : ' · Risk çıkışları kapalı'}</p>}</div><div className="result-actions">{result && <button className="export-button" disabled={Boolean(activeHistoryId) || historyBusy || !databaseOnline} onClick={saveCurrentBacktest}><Save size={15} />{activeHistoryId ? 'Geçmişte kayıtlı' : historyBusy ? 'Kaydediliyor…' : 'Geçmişe kaydet'}</button>}<button className="export-button" disabled={!result} onClick={() => result && downloadCsv(result)}><Download size={15} /> CSV indir</button></div></div>

        <section className="metric-grid" aria-label="Performans metrikleri">
          <MetricCard label="Toplam getiri" value={metrics ? formatPercent(metrics.total_return) : '—'} detail={metrics ? `${formatMoney(chartData[chartData.length - 1].equity, result?.market)} portföy değeri` : 'Başlangıçtan bugüne'} trend={metrics ? metrics.total_return >= 0 : null} />
          <MetricCard label="Sharpe oranı" value={metrics ? metrics.sharpe_ratio.toFixed(2) : '—'} detail={`Yıllıklandırılmış · ${intervalsPerYear[result?.interval ?? '1d']} bar`} />
          <MetricCard label="Azami düşüş" value={metrics ? formatPercent(metrics.max_drawdown) : '—'} detail="Zirveden en düşük noktaya" trend={metrics ? false : null} />
          <MetricCard label="Kazanma oranı" value={metrics ? formatPercent(metrics.win_rate) : '—'} detail={metrics ? `${metrics.closed_trades} kapanan işlem` : 'Kapanan işlemlere göre'} />
        </section>

        {result && benchmarkReturn !== null && <section className="comparison-strip" aria-label="Al-tut ile dönem karşılaştırması">
          <div className="comparison-intro"><h3>Al-tut ile karşılaştırma</h3><p>Aynı hisse ve tarih aralığı. Baz çizgisi komisyon ve risk çıkışlarını içermez.</p></div>
          <div className="comparison-value"><span>Seçili strateji · {strategyDisplayName(result.strategy)}</span><strong className={metrics && metrics.total_return >= 0 ? 'positive' : 'pnl-negative'}>{formatPercent(metrics?.total_return ?? 0)}</strong><small>{formatMoney(chartData[chartData.length - 1].equity, result.market)} dönem sonu</small></div>
          <div className="comparison-value"><span>Al-tut baz çizgisi</span><strong>{formatPercent(benchmarkReturn)}</strong><small>{formatMoney(chartData[chartData.length - 1].benchmark, result.market)} dönem sonu</small></div>
          <div className="comparison-value comparison-edge"><span>Getiri farkı · yüzde puan</span><strong className={metrics && metrics.total_return >= benchmarkReturn ? 'positive' : 'pnl-negative'}>{formatPercentagePoints((metrics?.total_return ?? 0) - benchmarkReturn)}</strong><small>Strateji eksi al-tut</small></div>
        </section>}

        <section className="chart-card">
          <div className="chart-head">
            <div>
              <h2>{showIndicatorComparison ? 'Fiyat ve indikatör karşılaştırması' : 'Portföy performansı'}</h2>
              <p>{showIndicatorComparison ? 'Tüm çizgiler 100 bazlı karşılaştırma endeksinde.' : `${intervalLabels[result?.interval ?? '1d']} düzeltilmiş kapanışları üzerinden`}</p>
            </div>
            <div className="chart-mode-switch" role="group" aria-label="Grafik görünümü">
              <button type="button" aria-pressed={!showIndicatorComparison} className={!showIndicatorComparison ? 'selected' : ''} onClick={() => setShowIndicatorComparison(false)}>Portföy</button>
              <button type="button" aria-pressed={showIndicatorComparison} className={showIndicatorComparison ? 'selected' : ''} onClick={() => setShowIndicatorComparison(true)}>Fiyat + indikatörler</button>
            </div>
          </div>
          {showIndicatorComparison && <p className="chart-explanation">Kapanış ve fiyat bazlı çizgiler ilk fiyatı 100 kabul eder. RSI/Stochastic için 50, MACD için sıfır, karşılaştırma endeksinde 100’e denk gelir.</p>}
          {showIndicatorComparison && <div className="indicator-legend" aria-label="Grafik çizgileri">
            <span><i style={{ backgroundColor: '#202b27' }} />Hisse fiyatı</span>
            {(result?.indicator_lines ?? []).map((line, index) => <span key={line.key}><i style={{ backgroundColor: ['#176b56', '#bf713a', '#5574a5', '#9b5d83', '#738d3c', '#1596a3', '#835cb5', '#bd5546'][index % 8] }} />{line.name}</span>)}
          </div>}
          <div className="chart-wrap">
            {chartData.length ? <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={showIndicatorComparison ? indicatorChartData : chartData} margin={{ top: 16, right: 10, bottom: 0, left: 2 }}>
                <defs><linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#176b56" stopOpacity={0.17} /><stop offset="100%" stopColor="#176b56" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="#dedfd7" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#56635e', fontSize: 11 }} minTickGap={44} />
                <YAxis domain={showIndicatorComparison ? ['dataMin - 5', 'dataMax + 5'] : [0, 'auto']} tickLine={false} axisLine={false} tick={{ fill: '#56635e', fontSize: 11 }} tickFormatter={value => showIndicatorComparison ? value.toFixed(0) : formatMoney(value, result?.market)} width={64} />
                <Tooltip contentStyle={{ background: '#fffdf8', border: '1px solid #dedfd7', borderRadius: 8, color: '#202b27' }} formatter={(value: number) => showIndicatorComparison ? `${value.toFixed(2)} endeks` : formatMoney(value, result?.market)} />
                {showIndicatorComparison ? <>
                  <Line type="monotone" dataKey="priceIndex" name="Hisse fiyatı · 100 baz" stroke="#202b27" strokeWidth={2.5} dot={false} connectNulls />
                  {(result?.indicator_lines ?? []).map((line, index) => <Line key={line.key} type="monotone" dataKey={line.key} name={line.name} stroke={['#176b56', '#bf713a', '#5574a5', '#9b5d83', '#738d3c', '#1596a3', '#835cb5', '#bd5546'][index % 8]} strokeWidth={1.7} dot={false} connectNulls />)}
                </> : <>
                  <Area type="monotone" dataKey="equity" stroke="#176b56" strokeWidth={2} fill="url(#equityFill)" name="Strateji" />
                  <Line type="monotone" dataKey="benchmark" stroke="#73808d" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Al-tut" />
                </>}
              </ComposedChart>
            </ResponsiveContainer> : <p className="empty-chart">Simülasyonu çalıştırınca strateji ve al-tut sonuçları burada görünür.</p>}
          </div>
          <div className="chart-foot"><span><span className="live-dot" /> {intervalLabels[result?.interval ?? '1d']} kapanış verisi</span><span>{result?.source ?? 'Kaynak: Yahoo Finance'}</span></div>
        </section>

        <section className="lower-grid"><div className="data-card"><div className="card-heading"><div><h2>İşlem günlüğü</h2><p>{result ? `${closedTrades.length} kapanmış işlem` : 'Gerçekleşen alım ve satımlar'}</p></div></div><div className="table-scroll" id="trade-table"><table><thead><tr><th>Giriş</th><th>Çıkış</th><th>Kâr / zarar</th><th>Çıkış nedeni</th></tr></thead><tbody>{closedTrades.length ? closedTrades.slice().reverse().map((trade, i) => <tr key={`${trade.entry_date}-${i}`}><td>{trade.entry_date} · {formatMoney(trade.entry_price, result?.market)}</td><td>{trade.exit_date} · {formatMoney(trade.exit_price, result?.market)}</td><td className={trade.pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}>{formatMoney(trade.pnl, result?.market)}</td><td><span className={`trade-pill ${trade.exit_reason === 'signal' ? 'buy' : 'sell'}`}>{trade.exit_reason === 'signal' ? 'Sinyal' : trade.exit_reason === 'stop_loss' ? 'Stop-loss' : 'Take-profit'}</span></td></tr>) : <tr><td colSpan={4} className="empty-row">{result ? 'Bu dönemde kapanmış işlem yok.' : 'Backtest sonrası işlem kayıtları listelenir.'}</td></tr>}</tbody></table></div></div>
        </section>
        </>}
        {mode === 'forecast' && <>
          <section className="run-panel">
            <h2>Geçmiş veriden tahmin</h2>
            <p className="forecast-intro">Geçmiş fiyat, trend, oynaklık ve hacim özellikleriyle ileri dönem getirisini tahmin eder. Model, son dönem verisinde kronolojik olarak doğrulanır.</p>
            <div className="form-grid forecast-controls">
              <div className="field stock-field"><span>Hisse seçimi</span><StockPicker value={symbol} market={market} onChange={setSymbol} onMarketChange={setMarket} /></div>
              <label className="field">Tahmin ufku<select value={horizon} onChange={event => setHorizon(Number(event.target.value))}><option value={1}>1 işlem günü</option><option value={5}>5 işlem günü</option><option value={20}>20 işlem günü</option></select></label>
            </div>
            <DateRangePicker periods={forecastDatePeriods} start={start} end={end} datePeriod={datePeriod} onChoosePeriod={chooseDatePeriod} onStartChange={value => { setStart(value); setDatePeriod('custom'); }} onEndChange={value => { setEnd(value); setDatePeriod('custom'); }} />
            <button className="run-button" onClick={runForecast} disabled={busy || !symbol.trim()}>{busy ? 'Geçmiş veriler inceleniyor…' : 'Tahmini hesapla'}</button>
            {error && <div className="error-message" role="alert">{error}</div>}
          </section>
          {forecast ? <>
            <div className="results-heading"><div><h2>{forecast.symbol} tahmin özeti</h2><p>{forecast.as_of} kapanışı · {forecast.source} · {forecast.horizon} işlem günlük ufuk</p></div></div>
            <section className="metric-grid forecast-metrics">
              <MetricCard label="MODEL TAHMİNİ" value={formatMoney(forecast.predicted_close, forecast.market)} detail={`${formatPercent(forecast.predicted_return)} beklenen değişim`} />
              <MetricCard label="GEÇMİŞ HATA ARALIĞI" value={`${formatMoney(forecast.lower_close, forecast.market)} – ${formatMoney(forecast.upper_close, forecast.market)}`} detail="Doğrulama hatalarının %90 yüzdeliği" />
              <MetricCard label="YÖN DOĞRULUĞU" value={formatPercent(forecast.directional_accuracy)} detail={`${forecast.validation_samples} ayrılmış doğrulama örneği`} />
              <MetricCard label="TABAN ÇİZGİSİ" value={forecast.beats_baseline ? 'Model daha düşük hata' : 'Basit tahmin daha düşük hata'} detail={`Model MAE ${forecast.validation_mae_pct.toFixed(2)}% · taban ${forecast.baseline_mae_pct.toFixed(2)}%`} />
            </section>
            {!forecast.beats_baseline && <p className="forecast-warning" role="status">Bu dönemde model, değişim yok varsayımından daha düşük hata üretmedi. Tahmini temkinli yorumlayın.</p>}
            <section className="chart-card"><div className="chart-head"><div><h2>Fiyat geçmişi ve model tahmini</h2><p>Doğrulama verisi model eğitiminde kullanılmadı</p></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={[...forecast.history.map(point => ({ date: point.date, close: point.close })), { date: `+${forecast.horizon} işlem günü`, forecast: forecast.predicted_close, lower: forecast.lower_close, upper: forecast.upper_close }]} margin={{ top: 16, right: 10, bottom: 0, left: 2 }}><CartesianGrid stroke="#dedfd7" vertical={false} /><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#56635e', fontSize: 11 }} minTickGap={44} /><YAxis tickLine={false} axisLine={false} tick={{ fill: '#56635e', fontSize: 11 }} tickFormatter={value => formatMoney(value, forecast.market)} width={74} domain={['auto','auto']} /><Tooltip formatter={(value: number) => formatMoney(value, forecast.market)} /><Line dataKey="close" name="Kapanış" stroke="#176b56" dot={false} connectNulls /><Line dataKey="forecast" name="Model tahmini" stroke="#bf713a" strokeWidth={2} strokeDasharray="5 4" /><Line dataKey="lower" name="Alt hata sınırı" stroke="#bf713a" strokeDasharray="2 4" dot={false} /><Line dataKey="upper" name="Üst hata sınırı" stroke="#bf713a" strokeDasharray="2 4" dot={false} /></ComposedChart></ResponsiveContainer></div><div className="chart-foot"><span>{forecast.as_of} son gözlem</span><span>{forecast.horizon} işlem günü ileri tahmin · {forecast.source}</span></div></section>
            <p className="forecast-note">Tahmin geçmiş örüntülerden üretilen istatistiksel bir tahmindir. Hata aralığı geçmiş doğrulama hatalarını özetler, gelecekteki sonucu garanti etmez.</p>
          </> : <p className="forecast-empty">Bir BIST hisse kodu ve tahmin ufku seçip geçmiş veriyi çalıştırın.</p>}
        </>}
        <footer className="app-footer"><span>piyasa.lab · Akademik simülasyon aracı</span><span>Gerçek emir gönderilmez</span></footer>
    </main>
  </div>;
}

function DateRangePicker({
  periods,
  start,
  end,
  datePeriod,
  onChoosePeriod,
  onStartChange,
  onEndChange,
}: {
  periods: { id: string; label: string; months: number }[];
  start: string;
  end: string;
  datePeriod: string;
  onChoosePeriod: (months: number | null, id: string) => void;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  return <section className="date-range" aria-labelledby="date-range-heading">
    <div className="section-heading"><h3 id="date-range-heading">Tarih aralığı</h3><p>Hazır dönem seçin ya da başlangıç ve bitiş tarihini girin.</p></div>
    <div className="date-periods" role="group" aria-label="Hazır tarih aralığı">
      {periods.map(period => <button type="button" className={datePeriod === period.id ? 'selected' : ''} aria-pressed={datePeriod === period.id} key={period.id} onClick={() => onChoosePeriod(period.months, period.id)}>{period.label}</button>)}
      <button type="button" className={datePeriod === 'custom' ? 'selected' : ''} aria-pressed={datePeriod === 'custom'} onClick={() => onChoosePeriod(null, 'custom')}>Özel</button>
    </div>
    <div className="date-fields">
      <label className="field">Başlangıç<input type="date" required max={todayISO()} value={start} onChange={event => onStartChange(event.target.value)} /></label>
      <span className="date-range-separator" aria-hidden="true">—</span>
      <label className="field">Bitiş<input type="date" required min={start} max={todayISO()} value={end} onChange={event => onEndChange(event.target.value)} /></label>
    </div>
  </section>;
}

function MetricCard({ label, value, detail, trend }: { label: string; value: string; detail: string; trend?: boolean | null }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span></div><div className={`metric-value ${trend === true ? 'positive' : trend === false ? 'caution' : ''}`}>{value}</div><div className="metric-detail">{detail}</div></article>;
}

function downloadCsv(data: BacktestResponse) {
  const content = ['date,price,equity,benchmark', ...data.points.map(p => `${p.date},${p.price},${p.equity},${p.benchmark}`)].join('\n');
  const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([content], { type: 'text/csv' })); link.download = `${data.symbol}-backtest.csv`; link.click(); URL.revokeObjectURL(link.href);
}

export default App;
