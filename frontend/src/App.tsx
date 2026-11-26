import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer,
  ReferenceLine, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ArrowDown, Download, Save, Trash2 } from 'lucide-react';
import { StockPicker } from './StockPicker';
import { Market } from './stockSymbols';

type Point = { date: string; price: number; equity: number; benchmark: number; indicators?: Record<string, number | null> };
type Metrics = { total_return: number; sharpe_ratio: number; max_drawdown: number; win_rate: number; closed_trades: number };
type RiskSnapshot = Metrics & { final_value: number };
type RiskEffect = { risk_on: RiskSnapshot; risk_off: RiskSnapshot; return_delta: number; drawdown_delta: number; trade_delta: number };
type IndicatorEffect = { strategy: Strategy; metrics: Metrics; final_value: number; combined: boolean };
type Trade = { entry_date: string; exit_date: string; entry_price: number; exit_price: number; pnl: number; exit_reason: string };
type Interval = '1d' | '1wk' | '1mo';
type IndicatorLine = { key: string; name: string; kind: 'price' | 'oscillator' | 'spread' };
type BacktestResponse = { points: Point[]; trades: Trade[]; metrics: Metrics; strategy: Strategy; symbol: string; market?: Market; period: string; source: string; parameters: Record<string, number>; interval?: Interval; components?: StrategyComponent[]; combination_method?: CombinationMethod | null; risk_enabled?: boolean; stop_loss_pct?: number; take_profit_pct?: number; indicator_lines?: IndicatorLine[]; risk_effect?: RiskEffect; indicator_effects?: IndicatorEffect[] };
type BacktestRun = { id: string; savedAt: string; result: BacktestResponse };
type BacktestHistorySummary = { id: string; savedAt: string; symbol: string; market: Market; strategy: Strategy; period: string; interval?: Interval; metrics: Metrics };
type ForecastResponse = { symbol: string; market?: Market; source: string; as_of: string; last_close: number; predicted_return: number; predicted_close: number; lower_close: number; upper_close: number; horizon: number; validation_mae_pct: number; baseline_mae_pct: number; directional_accuracy: number; validation_samples: number; beats_baseline: boolean; history: { date: string; close: number }[] };
type ResearchMetrics = Metrics & { final_value: number };
type ResearchSplit = 'optimization' | 'validation' | 'test';
type ResearchCandidate = { rank: number; label: string; components: StrategyComponent[]; combination_method: CombinationMethod; metrics: Record<ResearchSplit, ResearchMetrics> };
type RandomResearchResponse = { symbol: string; market: Market; interval: Interval; period: string; source: string; seed: number | null; requested_iterations: number; evaluated_iterations: number; split_bars: Record<ResearchSplit, number>; risk_enabled: boolean; stop_loss_pct: number; take_profit_pct: number; baseline: Record<ResearchSplit, ResearchMetrics>; candidates: ResearchCandidate[]; selection_rule: string };
type ResearchHistoryItem = { id: string; savedAt: string; result: RandomResearchResponse };

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
const indicatorPalette = ['#00a6fb', '#e600ff', '#ff2e88', '#00b874', '#ff4d00', '#00bcd4', '#8b5cf6', '#ffb000'];
const chartDateLabel = (value: string) => value.startsWith('+')
  ? value
  : new Date(`${value}T12:00:00`).toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' });
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
const indicatorParameterSummary = (component: StrategyComponent) => strategyPresets[component.strategy]
  .map(([key, label, fallback]) => `${label}: ${component.parameters[key] ?? fallback}`)
  .join(' · ');
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
const RESEARCH_HISTORY_KEY = 'piyasaLabRandomResearchHistoryV1';
const loadResearchHistory = (): ResearchHistoryItem[] => {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(RESEARCH_HISTORY_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is ResearchHistoryItem => Boolean(item && typeof item.id === 'string' && typeof item.savedAt === 'string' && item.result?.symbol && Array.isArray(item.result.candidates))).slice(0, 15) : [];
  } catch { return []; }
};

function App() {
  const initialPage = new URLSearchParams(window.location.search).get('page');
  const [page, setPage] = useState<'dashboard' | 'simulations' | 'history'>(() => initialPage === 'simulations' ? 'simulations' : initialPage === 'history' ? 'history' : 'dashboard');
  const [market, setMarket] = useState<Market>('BIST');
  const [history, setHistory] = useState<BacktestHistorySummary[]>([]);
  const [historyQuery, setHistoryQuery] = useState('');
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [strategy, setStrategy] = useState<Strategy>('SMA Crossover');
  const [selectedComponents, setSelectedComponents] = useState<IndicatorStrategy[]>(['SMA Crossover', 'RSI']);
  const [componentParameters, setComponentParameters] = useState<Record<string, Record<string, string>>>({});
  const [combinationMethod, setCombinationMethod] = useState<CombinationMethod>('AND');
  const [interval, setInterval] = useState<Interval>('1d');
  const [mode, setMode] = useState<'backtest' | 'forecast' | 'random'>(() => initialPage === 'simulations' ? 'random' : initialPage === 'forecast' ? 'forecast' : 'backtest');
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
  const [researchHistory, setResearchHistory] = useState<ResearchHistoryItem[]>(loadResearchHistory);
  const [randomResearch, setRandomResearch] = useState<RandomResearchResponse | null>(() => loadResearchHistory()[0]?.result ?? null);
  const [activeResearchId, setActiveResearchId] = useState<string | null>(() => loadResearchHistory()[0]?.id ?? null);
  const [researchIndicators, setResearchIndicators] = useState<IndicatorStrategy[]>([...Object.keys(strategyPresets) as IndicatorStrategy[]]);
  const [researchIterations, setResearchIterations] = useState(30);
  const [researchSeed, setResearchSeed] = useState('4015');
  const researchResultsRef = useRef<HTMLDivElement>(null);

  const scrollToResearchResults = () => {
    window.requestAnimationFrame(() => researchResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

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
    return history.filter(run => `${run.symbol} ${run.strategy} ${run.period}`.toLocaleLowerCase('tr-TR').includes(query));
  }, [history, historyQuery]);
  const analyzedIndicators: StrategyComponent[] = result
    ? result.strategy === 'Combined'
      ? result.components ?? []
      : isIndicatorStrategy(result.strategy)
        ? [{ strategy: result.strategy, parameters: result.parameters }]
        : []
    : [];
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
    const handleNavigation = () => {
      const route = new URLSearchParams(window.location.search).get('page');
      setPage(route === 'simulations' ? 'simulations' : route === 'history' ? 'history' : 'dashboard');
      setMode(route === 'simulations' ? 'random' : route === 'forecast' ? 'forecast' : 'backtest');
      setError('');
    };
    window.addEventListener('popstate', handleNavigation);
    return () => window.removeEventListener('popstate', handleNavigation);
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem(RESEARCH_HISTORY_KEY, JSON.stringify(researchHistory.slice(0, 15))); } catch { /* Local history remains usable when browser storage is unavailable. */ }
  }, [researchHistory]);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/history').then(async response => {
      if (!response.ok) throw new Error('Supabase test geçmişine ulaşılamıyor.');
      return await response.json() as BacktestHistorySummary[];
    }).then(savedRuns => {
      if (!cancelled) { setHistory(savedRuns); setHistoryError(''); }
    }).catch(e => {
      if (!cancelled) setHistoryError(e instanceof Error ? e.message : 'Test geçmişi yüklenemedi.');
    }).finally(() => { if (!cancelled) setHistoryLoading(false); });
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

  const openBacktestRun = async (run: BacktestHistorySummary) => {
    setHistoryBusy(true); setHistoryError('');
    try {
      const response = await fetch(`/api/history/${run.id}`);
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof body?.detail === 'string' ? body.detail : 'Kayıtlı backtest açılamadı.');
      const savedRun = body as BacktestRun;
      setResult(savedRun.result);
      setActiveHistoryId(savedRun.id);
      navigatePage('backtest');
      setError('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : 'Kayıtlı backtest açılamadı.');
    } finally { setHistoryBusy(false); }
  };

  const saveCurrentBacktest = async () => {
    if (!result || activeHistoryId || historyBusy || historyLoading) return;
    setHistoryBusy(true); setHistoryError('');
    try {
      const response = await fetch('/api/history', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof body?.detail === 'string' ? body.detail : 'Backtest Supabase’e kaydedilemedi.');
      const run = body as BacktestRun;
      setHistory(current => [{
        id: run.id,
        savedAt: run.savedAt,
        symbol: run.result.symbol,
        market: run.result.market ?? market,
        strategy: run.result.strategy,
        period: run.result.period,
        interval: run.result.interval,
        metrics: run.result.metrics,
      }, ...current]);
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

  const runRandomResearch = async () => {
    setBusy(true); setError(''); setRandomResearch(null); setActiveResearchId(null);
    try {
      const response = await fetch('/api/random-strategy-research', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: symbol.trim(), market, interval, indicators: researchIndicators, iterations: researchIterations, seed: researchSeed.trim() ? Number(researchSeed) : null, start_date: start, end_date: end || null, initial_cash: Number(capital), commission_rate: Number(commission) / 100, risk_enabled: riskEnabled, stop_loss_pct: Number(stopLossPct), take_profit_pct: Number(takeProfitPct) }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof body?.detail === 'string' ? body.detail : 'Rastgele strateji araştırması çalıştırılamadı.');
      const report = body as RandomResearchResponse;
      const savedReport: ResearchHistoryItem = { id: `${Date.now()}-${report.seed ?? 'random'}`, savedAt: new Date().toISOString(), result: report };
      setRandomResearch(report);
      setActiveResearchId(savedReport.id);
      setResearchHistory(current => [savedReport, ...current.filter(item => item.id !== savedReport.id)].slice(0, 15));
      scrollToResearchResults();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Araştırma sunucusuna ulaşılamadı.');
    } finally { setBusy(false); }
  };

  const exportRandomResearch = () => {
    if (!randomResearch) return;
    const columns = ['Sıra', 'Strateji', 'Optimizasyon getirisi', 'Optimizasyon Sharpe', 'Optimizasyon max düşüş', 'Doğrulama getirisi', 'Doğrulama max düşüş', 'Test getirisi', 'Test max düşüş', 'Test kazanma oranı', 'Test kapanan işlem', 'Test dönem sonu portföy'];
    const rows = randomResearch.candidates.map(candidate => {
      const o = candidate.metrics.optimization, v = candidate.metrics.validation, t = candidate.metrics.test;
      return [candidate.rank, candidate.label, o.total_return, o.sharpe_ratio, o.max_drawdown, v.total_return, v.max_drawdown, t.total_return, t.max_drawdown, t.win_rate, t.closed_trades, t.final_value];
    });
    const csv = [columns, ...rows].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `strateji-arastirmasi-${randomResearch.symbol}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  const toggleResearchIndicator = (name: IndicatorStrategy) => setResearchIndicators(current => {
    if (current.includes(name)) return current.length > 2 ? current.filter(item => item !== name) : current;
    return [...current, name];
  });

  const navigatePage = (route: 'backtest' | 'forecast' | 'simulations' | 'history') => {
    const nextPage = route === 'simulations' ? 'simulations' : route === 'history' ? 'history' : 'dashboard';
    const nextMode = route === 'simulations' ? 'random' : route === 'forecast' ? 'forecast' : 'backtest';
    const nextUrl = route === 'backtest' ? window.location.pathname : `${window.location.pathname}?page=${route}`;
    window.history.pushState({ page: route }, '', nextUrl);
    setPage(nextPage);
    setMode(nextMode);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openResearchReport = (item: ResearchHistoryItem) => {
    setRandomResearch(item.result);
    setActiveResearchId(item.id);
    scrollToResearchResults();
  };

  const metrics = result?.metrics;
  const riskEffect = result?.risk_effect;
  const leadingResearchCandidate = randomResearch?.candidates[0];
  const leadingTestDelta = leadingResearchCandidate
    ? leadingResearchCandidate.metrics.test.total_return - randomResearch!.baseline.test.total_return
    : 0;
  return <div className="app-shell">
    <header className="topbar">
      <a href="#terminal" className="brand">piyasa.lab</a>
      <nav className="primary-nav" aria-label="Araştırma araçları">
        <button type="button" className={`page-nav-button nav-backtest ${page === 'dashboard' && mode === 'backtest' ? 'active' : ''}`} aria-current={page === 'dashboard' && mode === 'backtest' ? 'page' : undefined} onClick={() => navigatePage('backtest')}>Strateji testi</button>
        <button type="button" className={`page-nav-button nav-forecast ${page === 'dashboard' && mode === 'forecast' ? 'active' : ''}`} aria-current={page === 'dashboard' && mode === 'forecast' ? 'page' : undefined} onClick={() => navigatePage('forecast')}>Fiyat tahmini</button>
        <button type="button" className={`page-nav-button nav-random ${page === 'simulations' ? 'active' : ''}`} aria-current={page === 'simulations' ? 'page' : undefined} onClick={() => navigatePage('simulations')}>Rastgele araştırma</button>
        <button type="button" className={`page-nav-button nav-history ${page === 'history' ? 'active' : ''}`} aria-current={page === 'history' ? 'page' : undefined} onClick={() => navigatePage('history')}>Kayıtlı testler <span className="nav-count">{historyLoading ? '…' : history.length}</span></button>
      </nav>
      <span className={`connection ${apiOnline ? 'is-online' : 'is-offline'}`}><i aria-hidden="true" />API {apiOnline ? 'bağlı' : 'çevrimdışı'} · DB {databaseOnline ? 'bağlı' : 'kapalı'}</span>
    </header>
    <main id="terminal" className="content">
        {page === 'dashboard' && <header className="page-heading">
          <h1>{mode === 'forecast' ? 'Fiyat tahmini' : 'Strateji backtesti'}</h1>
          <p>{mode === 'forecast' ? 'Geçmiş veriyi kronolojik olarak doğrulayın; tahmin ile basit baz çizgisini karşılaştırın.' : 'Hisse ve strateji seçin, risk kurallarını ayarlayın ve aynı dönem al-tut karşılaştırmasıyla sonucu inceleyin.'}</p>
        </header>}


        {page === 'dashboard' && mode === 'backtest' && <>

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

        <div className="results-heading"><div><div className="section-title"><h2>Performans özeti</h2><span className="period-badge">{result?.period}</span></div><p>{result ? `${result.symbol} · ${strategyDisplayName(result.strategy)} · ${chartData.length.toLocaleString('tr-TR')} ${intervalLabels[result.interval ?? '1d'].toLocaleLowerCase('tr-TR')} bar` : 'Henüz bir simülasyon çalıştırılmadı.'}</p>{result && <p className="result-parameters">{strategyParameterSummary(result)}{result.risk_enabled === undefined ? '' : result.risk_enabled ? ` · Risk çıkışları açık · SL %${result.stop_loss_pct ?? 5} / TP %${result.take_profit_pct ?? 10}` : ' · Risk çıkışları kapalı'}</p>}</div><div className="result-actions">{result && <button className="export-button" disabled={Boolean(activeHistoryId) || historyBusy || historyLoading || !databaseOnline} onClick={saveCurrentBacktest}><Save size={15} />{activeHistoryId ? 'Geçmişte kayıtlı' : historyBusy ? 'İşleniyor…' : historyLoading ? 'Kayıtlar yükleniyor…' : 'Geçmişe kaydet'}</button>}<button className="export-button" disabled={!result} onClick={() => result && downloadCsv(result)}><Download size={15} /> CSV indir</button></div></div>
        {historyError && <div className="error-message" role="alert">Kayıt geçmişi: {historyError}</div>}

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

        {result && <section className="impact-grid" aria-label="Strateji ve risk etkisi">
          {riskEffect && <article className="impact-card">
            <div className="card-heading">
              <div><h2>Risk yönetiminin etkisi</h2><p>Aynı hisse, dönem, sinyaller ve komisyonla iki ayrı simülasyon.</p></div>
            </div>
            <p className="impact-note">Risk açık senaryoda stop-loss / take-profit ve pozisyon büyüklüğü sınırı uygulanır. Değerler, risk kapalı senaryoya göre farkı gösterir.</p>
            <div className="risk-impact-table" role="table" aria-label="Risk açık ve kapalı performans karşılaştırması">
              <div className="risk-impact-row risk-impact-header" role="row"><span role="columnheader">Ölçüm</span><span role="columnheader">Risk kapalı</span><span role="columnheader">Risk açık</span><span role="columnheader">Fark</span></div>
              {([
                { label: 'Toplam getiri', key: 'total_return', format: (value: number) => formatPercent(value), delta: riskEffect.return_delta, higherIsBetter: true },
                { label: 'Azami düşüş', key: 'max_drawdown', format: (value: number) => formatPercent(value), delta: riskEffect.drawdown_delta, higherIsBetter: true },
                { label: 'Kazanma oranı', key: 'win_rate', format: (value: number) => formatPercent(value), delta: riskEffect.risk_on.win_rate - riskEffect.risk_off.win_rate, higherIsBetter: true },
                { label: 'Kapanan işlem', key: 'closed_trades', format: (value: number) => value.toLocaleString('tr-TR'), delta: riskEffect.trade_delta, higherIsBetter: null },
                { label: 'Dönem sonu portföy', key: 'final_value', format: (value: number) => formatMoney(value, result.market), delta: riskEffect.risk_on.final_value - riskEffect.risk_off.final_value, higherIsBetter: true },
              ] as const).map(row => {
                const offValue = riskEffect.risk_off[row.key];
                const onValue = riskEffect.risk_on[row.key];
                const deltaLabel = row.key === 'closed_trades'
                  ? `${row.delta > 0 ? '+' : ''}${row.delta.toLocaleString('tr-TR')}`
                  : row.key === 'final_value'
                    ? `${row.delta > 0 ? '+' : ''}${formatMoney(row.delta, result.market)}`
                    : formatPercentagePoints(row.delta);
                const favorable = row.higherIsBetter === null ? null : row.delta >= 0;
                return <div className="risk-impact-row" role="row" key={row.key}>
                  <span role="rowheader">{row.label}</span><span role="cell">{row.format(offValue)}</span><span role="cell">{row.format(onValue)}</span>
                  <strong role="cell" className={favorable === null ? '' : favorable ? 'positive' : 'pnl-negative'}>{deltaLabel}</strong>
                </div>;
              })}
            </div>
            <p className="impact-footnote">Fark = risk açık − risk kapalı. Getiri, düşüş ve kazanma oranı farkları yüzde puandır; işlem farkı adet, portföy farkı para değeridir. Geçmiş dönem sonuçları sonraki dönemler için garanti vermez.</p>
          </article>}

          <article className="impact-card indicator-impact">
            <div className="card-heading">
              <div><h2>Seçilen indikatörler</h2><p>Bu backtestte kullanılan ayarlar, sinyaller ve son gözlem.</p></div>
            </div>
            {analyzedIndicators.length ? <div className="indicator-details">
              {analyzedIndicators.map(component => {
                const option = strategyOptions.find(item => item.name === component.strategy);
                const lines = (result.indicator_lines ?? []).filter(line => result.strategy === 'Combined' ? line.name.startsWith(`${component.strategy} · `) : true);
                return <section className="indicator-detail" key={component.strategy}>
                  <div className="indicator-detail-heading"><h3>{component.strategy}</h3><span>{option?.category}</span></div>
                  <p>{option?.summary}</p>
                  <p className="indicator-rule"><strong>Sinyal kuralı:</strong> {option?.rule}</p>
                  <p className="indicator-parameters">{indicatorParameterSummary(component)}</p>
                  {lines.length > 0 && <div className="indicator-readings">
                    {lines.map((line, index) => {
                      const lastValue = chartData[chartData.length - 1]?.indicators?.[line.key];
                      return <span key={line.key}><i style={{ backgroundColor: ['#176b56', '#bf713a', '#5574a5', '#9b5d83', '#738d3c', '#1596a3', '#835cb5', '#bd5546'][index % 8] }} />{line.name.slice(line.name.lastIndexOf(' · ') + 3)} <strong>{lastValue == null ? '—' : line.kind === 'price' ? formatMoney(lastValue, result.market) : lastValue.toFixed(2)}</strong></span>;
                    })}
                  </div>}
                </section>;
              })}
            </div> : <p>Buy &amp; Hold indikatör sinyali üretmez; bu sonuç karşılaştırma çizgisi olarak kullanılır.</p>}
          </article>

          {(result.indicator_effects?.length ?? 0) > 0 && <article className="impact-card indicator-effect-card">
            <div className="card-heading">
              <div><h2>İndikatör seçiminin backtest etkisi</h2><p>Her indikatör tek başına ve birleşik strateji aynı ayarlarla çalıştırıldı.</p></div>
            </div>
            <div className="risk-impact-table indicator-effect-table" role="table" aria-label="Tekil indikatörler ve birleşik strateji karşılaştırması">
              <div className="indicator-effect-row indicator-effect-header" role="row"><span role="columnheader">Yöntem</span><span role="columnheader">Getiri</span><span role="columnheader">Azami düşüş</span><span role="columnheader">Kapanan işlem</span><span role="columnheader">Dönem sonu</span></div>
              {result.indicator_effects?.map(effect => <div className={`indicator-effect-row ${effect.combined ? 'combined-effect-row' : ''}`} role="row" key={effect.combined ? 'combined' : effect.strategy}>
                <strong role="rowheader">{effect.combined ? `Birleşik · ${result.combination_method ?? 'AND'}` : effect.strategy}</strong>
                <span role="cell" className={effect.metrics.total_return >= 0 ? 'positive' : 'pnl-negative'}>{formatPercent(effect.metrics.total_return)}</span>
                <span role="cell" className="pnl-negative">{formatPercent(effect.metrics.max_drawdown)}</span>
                <span role="cell">{effect.metrics.closed_trades.toLocaleString('tr-TR')}</span>
                <span role="cell">{formatMoney(effect.final_value, result.market)}</span>
              </div>)}
            </div>
            <p className="impact-footnote">Tekil indikatör satırları ayrı backtestlerdir. Birleşik sonuçla farkları gözlem verir; tek başına nedensel katkıyı kanıtlamaz.</p>
          </article>}
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
          {showIndicatorComparison ? <div className="indicator-legend" aria-label="Grafik çizgileri">
            <span><i style={{ borderTopColor: '#f3eee0' }} />Hisse fiyatı</span>
            {(result?.indicator_lines ?? []).map((line, index) => <span key={line.key}><i style={{ borderTopColor: indicatorPalette[index % indicatorPalette.length] }} />{line.name}</span>)}
          </div> : <div className="indicator-legend" aria-label="Portföy grafiği çizgileri">
            <span><i style={{ borderTopColor: '#00c853' }} />Strateji portföyü</span>
            <span><i className="legend-dashed" style={{ borderTopColor: '#ffab00' }} />Al-tut karşılaştırması</span>
          </div>}
          {!showIndicatorComparison && chartData.length > 0 && <p className="chart-explanation">Dikey eksen, portföy hareketlerini daha rahat görmeniz için dönem içindeki değer aralığına göre ölçeklenir.</p>}
          <div className="chart-wrap">
            {chartData.length ? <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={showIndicatorComparison ? indicatorChartData : chartData} margin={{ top: 18, right: 18, bottom: 0, left: 8 }}>
                <defs><linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00c853" stopOpacity={0.2} /><stop offset="100%" stopColor="#00c853" stopOpacity={0.015} /></linearGradient></defs>
                <CartesianGrid stroke="#e4eaf2" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#53627a', fontSize: 11 }} tickFormatter={chartDateLabel} minTickGap={44} />
                <YAxis domain={showIndicatorComparison ? ['dataMin - 5', 'dataMax + 5'] : [(value: number) => Math.max(0, Math.floor(value * 0.96)), (value: number) => Math.ceil(value * 1.04)]} tickLine={false} axisLine={false} tick={{ fill: '#53627a', fontSize: 11 }} tickFormatter={value => showIndicatorComparison ? value.toFixed(0) : formatMoney(value, result?.market)} width={74} />
                <Tooltip labelFormatter={label => chartDateLabel(String(label))} contentStyle={{ background: '#fff', border: '1px solid #d7dfeb', borderRadius: 8, color: '#142744', boxShadow: '0 12px 32px rgb(20 39 68 / 12%)' }} itemStyle={{ color: '#142744' }} labelStyle={{ color: '#53627a', marginBottom: 6 }} formatter={(value: number) => showIndicatorComparison ? `${value.toFixed(2)} endeks` : formatMoney(value, result?.market)} />
                {showIndicatorComparison ? <>
                  <ReferenceLine y={100} stroke="#92a0b5" strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="priceIndex" name="Hisse fiyatı · 100 baz" stroke="#175cff" strokeWidth={2.5} dot={false} connectNulls />
                  {(result?.indicator_lines ?? []).map((line, index) => <Line key={line.key} type="monotone" dataKey={line.key} name={line.name} stroke={indicatorPalette[index % indicatorPalette.length]} strokeWidth={2} dot={false} connectNulls />)}
                </> : <>
                  <Area type="monotone" dataKey="equity" stroke="#00c853" strokeWidth={2.5} fill="url(#equityFill)" name="Strateji portföyü" dot={false} activeDot={{ r: 4, fill: '#00c853', stroke: '#fff', strokeWidth: 2 }} />
                  <Line type="monotone" dataKey="benchmark" stroke="#ffab00" strokeWidth={2} strokeDasharray="6 5" dot={false} activeDot={{ r: 4, fill: '#ffab00', stroke: '#fff', strokeWidth: 2 }} name="Al-tut karşılaştırması" />
                </>}
              </ComposedChart>
            </ResponsiveContainer> : <p className="empty-chart">Simülasyonu çalıştırınca strateji ve al-tut sonuçları burada görünür.</p>}
          </div>
          <div className="chart-foot"><span><span className="live-dot" /> {intervalLabels[result?.interval ?? '1d']} kapanış verisi</span><span>{result?.source ?? 'Kaynak: Yahoo Finance'}</span></div>
        </section>

        <section className="lower-grid"><div className="data-card"><div className="card-heading"><div><h2>İşlem günlüğü</h2><p>{result ? `${closedTrades.length} kapanmış işlem` : 'Gerçekleşen alım ve satımlar'}</p></div></div><div className="table-scroll" id="trade-table"><table><thead><tr><th>Giriş</th><th>Çıkış</th><th>Kâr / zarar</th><th>Çıkış nedeni</th></tr></thead><tbody>{closedTrades.length ? closedTrades.slice().reverse().map((trade, i) => <tr key={`${trade.entry_date}-${i}`}><td>{trade.entry_date} · {formatMoney(trade.entry_price, result?.market)}</td><td>{trade.exit_date} · {formatMoney(trade.exit_price, result?.market)}</td><td className={trade.pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}>{formatMoney(trade.pnl, result?.market)}</td><td><span className={`trade-pill ${trade.exit_reason === 'signal' ? 'buy' : 'sell'}`}>{trade.exit_reason === 'signal' ? 'Sinyal' : trade.exit_reason === 'stop_loss' ? 'Stop-loss' : 'Take-profit'}</span></td></tr>) : <tr><td colSpan={4} className="empty-row">{result ? 'Bu dönemde kapanmış işlem yok.' : 'Backtest sonrası işlem kayıtları listelenir.'}</td></tr>}</tbody></table></div></div>
        </section>
        </>}
        {page === 'history' && <>
          <header className="page-heading history-page-heading">
            <h1>Kayıtlı testler</h1>
            <p>Yalnızca sizin kaydettiğiniz backtestler burada listelenir. Bir kaydı açıp performans grafiğine ve işlem günlüğüne dönebilirsiniz.</p>
          </header>
          <section className="history-section history-page-section" aria-labelledby="history-heading">
            <div className="history-heading">
              <div>
                <div className="history-title-line"><h2 id="history-heading">Backtest arşivi</h2><span className="history-count">{history.length} kayıt</span></div>
                <p>Rastgele araştırma raporları bu arşive eklenmez; onlar kendi sayfasında yerel olarak tutulur.</p>
              </div>
              {history.length > 0 && <div className="history-tools">
                <label className="history-search"><span className="sr-only">Test geçmişinde ara</span><input value={historyQuery} onChange={event => setHistoryQuery(event.target.value)} placeholder="Hisse veya strateji ara" /></label>
                <button type="button" className="history-clear" disabled={historyBusy} onClick={clearBacktestHistory}>Geçmişi temizle</button>
              </div>}
            </div>
            {historyError && <div className="error-message" role="alert">{historyError}</div>}
            {filteredHistory.length ? <div className="history-list">
              {filteredHistory.map(run => <div className="history-row" key={run.id}>
                <button type="button" className={`history-item ${run.id === activeHistoryId ? 'active' : ''}`} aria-pressed={run.id === activeHistoryId} disabled={historyBusy} onClick={() => openBacktestRun(run)}>
                  <span className="history-run-info"><strong>{run.symbol}</strong><span>{strategyDisplayName(run.strategy)}</span><small>{run.period} · {intervalLabels[run.interval ?? '1d']} · {new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(run.savedAt))}</small></span>
                  <span className={`history-metric ${run.metrics.total_return >= 0 ? 'positive' : 'pnl-negative'}`}><small>Toplam getiri</small><strong>{formatPercent(run.metrics.total_return)}</strong></span>
                  <span className="history-metric"><small>Sharpe</small><strong>{run.metrics.sharpe_ratio.toFixed(2)}</strong></span>
                  <span className="history-metric"><small>Azami düşüş</small><strong>{formatPercent(run.metrics.max_drawdown)}</strong></span>
                  <span className="history-trades">{run.metrics.closed_trades} işlem <span aria-hidden="true">· Aç</span></span>
                </button>
                <button type="button" className="history-remove" disabled={historyBusy} aria-label={`${run.symbol} ${run.strategy} kaydını sil`} title="Bu kaydı sil" onClick={() => removeBacktestRun(run.id)}><Trash2 size={16} aria-hidden="true" /></button>
              </div>)}
            </div> : <div className="history-empty">{historyLoading ? 'Supabase test geçmişi yükleniyor…' : historyError ? 'Test geçmişi yüklenemedi. Bağlantıyı kontrol edip sayfayı yenileyin.' : history.length ? 'Bu aramayla eşleşen test yok.' : 'Henüz kaydedilmiş test yok. Bir backtest çalıştırıp “Geçmişe kaydet” düğmesine basın; kayıt burada görünür.'}</div>}
          </section>
        </>}
        {page === 'simulations' && <>
          <header className="page-heading simulation-page-heading">
            <div><h1>Simülasyon geçmişleri</h1>
              <p>Hisse bazında rastgele indikatör birleşimleri üretin, sonuçları karşılaştırın ve önceki araştırma raporlarını yeniden açın.</p>
            </div>
            {randomResearch && <button type="button" className="report-jump" onClick={scrollToResearchResults}>Son raporu görüntüle <ArrowDown size={16} aria-hidden="true" /></button>}
          </header>
          <form className="run-panel" onSubmit={event => { event.preventDefault(); void runRandomResearch(); }}>
            <h2>Rastgele indikatör karşılaştırması</h2>
            <p className="panel-intro">Seçtiğiniz indikatör havuzundan rastgele 2–4’lü birleşimler oluşturur. Sıralama yalnızca keşif dönemine göre yapılır; doğrulama ve test bölümleri seçimden ayrı tutulur.</p>
            <div className="form-grid research-controls">
              <div className="field stock-field"><span>Hisse</span><StockPicker value={symbol} market={market} onChange={setSymbol} onMarketChange={setMarket} /></div>
              <label className="field">Veri aralığı<select value={interval} onChange={event => setInterval(event.target.value as Interval)}><option value="1d">Günlük</option><option value="1wk">Haftalık</option><option value="1mo">Aylık</option></select></label>
              <label className="field">Deneme sayısı<select value={researchIterations} onChange={event => setResearchIterations(Number(event.target.value))}><option value={10}>10 birleşim</option><option value={20}>20 birleşim</option><option value={30}>30 birleşim</option><option value={50}>50 birleşim</option><option value={100}>100 birleşim</option></select></label>
              <label className="field">Rastgelelik tohumu<input type="number" min="0" max="4294967295" value={researchSeed} onChange={event => setResearchSeed(event.target.value)} placeholder="Boş: her seferinde farklı" /><small>Aynı sayı, aynı kombinasyonları üretir.</small></label>
            </div>
            <DateRangePicker periods={backtestDatePeriods} start={start} end={end} datePeriod={datePeriod} onChoosePeriod={chooseDatePeriod} onStartChange={value => { setStart(value); setDatePeriod('custom'); }} onEndChange={value => { setEnd(value); setDatePeriod('custom'); }} />
            <div className="research-pool">
              <div className="section-heading"><h3>İndikatör havuzu</h3><p>En az iki indikatör seçin; her aday farklı parametreler ve oy kuralı alır.</p></div>
              <div className="research-indicators">{(Object.keys(strategyPresets) as IndicatorStrategy[]).map(name => <label key={name} className="research-indicator"><input type="checkbox" checked={researchIndicators.includes(name)} onChange={() => toggleResearchIndicator(name)} /><span>{name}</span></label>)}</div>
              <small>Seçili: {researchIndicators.length}/7 · her strateji AND, OR veya çoğunluk oyuyla birleştirilebilir.</small>
            </div>
            <div className="research-capital form-grid">
              <label className="field">Başlangıç sermayesi<div className="input-wrap"><input value={capital} onChange={event => setCapital(event.target.value)} inputMode="numeric" /><span className="suffix">{market === 'US' ? '$' : '₺'}</span></div></label>
              <label className="field">Komisyon<div className="input-wrap"><input value={commission} onChange={event => setCommission(event.target.value)} inputMode="decimal" /><span className="suffix">%</span></div></label>
              <div className="risk-control">
                <label className="risk-toggle"><input type="checkbox" checked={riskEnabled} onChange={event => setRiskEnabled(event.target.checked)} /><span>Risk çıkışlarını uygula</span></label>
                <p>Stop-loss ve take-profit tüm adaylarda aynı uygulanır.</p>
                {riskEnabled && <div className="risk-thresholds"><label className="field"><span>Zarar sınırı</span><input type="number" min="0.1" max="99" step="0.1" value={stopLossPct} onChange={event => setStopLossPct(event.target.value)} /></label><label className="field"><span>Kâr hedefi</span><input type="number" min="0.1" max="99" step="0.1" value={takeProfitPct} onChange={event => setTakeProfitPct(event.target.value)} /></label></div>}
              </div>
            </div>
            <p className="research-caveat">Güvenilir kronolojik karşılaştırma için en az 200 veri barı gerekir. Aylık aralıkta uzun tarih dönemi seçin. Test dönemi raporlanır ancak en iyi stratejiyi seçmek için kullanılmaz.</p>
            <button className="run-button" type="submit" disabled={busy || !symbol.trim() || researchIndicators.length < 2}>{busy ? 'Kombinasyonlar test ediliyor…' : `${researchIterations} rastgele birleşimi karşılaştır`}</button>
            {error && <div className="error-message" role="alert">{error}</div>}
          </form>
          <section className="simulation-history-section" aria-labelledby="simulation-history-heading">
            <div className="card-heading"><div><h2 id="simulation-history-heading">Önceki araştırmalar</h2><p>Son 15 rapor bu tarayıcıda saklanır; Supabase test geçmişine eklenmez.</p></div><span className="history-count">{researchHistory.length} / 15</span></div>
            {researchHistory.length ? <div className="simulation-history-list">{researchHistory.map(item => <button key={item.id} type="button" className={`simulation-history-item ${activeResearchId === item.id ? 'active' : ''}`} onClick={() => openResearchReport(item)}>
              <span className="simulation-history-main"><strong>{item.result.symbol} · {item.result.evaluated_iterations} aday</strong><small>{new Date(item.savedAt).toLocaleString('tr-TR')} · {item.result.interval === '1d' ? 'Günlük' : item.result.interval === '1wk' ? 'Haftalık' : 'Aylık'} · {item.result.period}</small></span>
              <span className="simulation-history-metric"><small>Keşifte ilk sıra</small><strong className={item.result.candidates[0]?.metrics.optimization.total_return >= 0 ? 'positive' : 'pnl-negative'}>{formatPercent(item.result.candidates[0]?.metrics.optimization.total_return ?? 0)}</strong></span>
              <span className="simulation-history-metric"><small>İlk sıranın test getirisi</small><strong className={item.result.candidates[0]?.metrics.test.total_return >= 0 ? 'positive' : 'pnl-negative'}>{formatPercent(item.result.candidates[0]?.metrics.test.total_return ?? 0)}</strong></span>
              <span className="simulation-history-open">Raporu aç</span>
            </button>)}</div> : <p className="simulation-history-empty">Henüz araştırma yok. Hisseyi ve tarih aralığını seçip rastgele kombinasyonları çalıştırdığınızda rapor burada saklanır.</p>}
          </section>
          {randomResearch ? <>
            <div className="results-heading research-results-heading" id="research-results" ref={researchResultsRef} tabIndex={-1}><div><h2>{randomResearch.symbol} · strateji araştırma raporu</h2><p>{randomResearch.period} · {intervalLabels[randomResearch.interval]} · {randomResearch.source} · tohum {randomResearch.seed ?? 'rastgele'}</p></div><button type="button" className="export-button" onClick={exportRandomResearch}><Download size={16} /> CSV raporunu indir</button></div>
            <section className="metric-grid research-metrics">
              <MetricCard label="ADAY SAYISI" value={String(randomResearch.evaluated_iterations)} detail={`${randomResearch.requested_iterations} istendi · ${randomResearch.candidates.length} farklı kombinasyon`} />
              <MetricCard label="KEŞİFTE LİDER GETİRİ" value={formatPercent(randomResearch.candidates[0].metrics.optimization.total_return)} detail="Aday sıralamasında kullanılan sonuç" trend={randomResearch.candidates[0].metrics.optimization.total_return >= 0} />
              <MetricCard label="LİDER ADAY · TEST" value={formatPercent(randomResearch.candidates[0].metrics.test.total_return)} detail="Daha önce seçime katılmayan son dönem" trend={randomResearch.candidates[0].metrics.test.total_return >= 0} />
              <MetricCard label="AL-TUT · TEST" value={formatPercent(randomResearch.baseline.test.total_return)} detail="Aynı hisse ve test dönemi · stratejisiz" trend={randomResearch.baseline.test.total_return >= 0} />
            </section>
            <section className="research-guide" aria-labelledby="research-guide-heading">
              <div className="research-guide-heading"><h2 id="research-guide-heading">Bu raporu nasıl okuyun?</h2><p>“Test”, yazılım testi değil; stratejinin en yeni ve seçim dışında tutulan tarihsel veri bölümüdür.</p></div>
              <dl className="research-guide-splits">
                <div><dt>Keşif · ilk %60</dt><dd>En eski dönemdir. Adaylar bu bölümdeki getiriye göre sıralanır; eşitlikte Sharpe oranı kullanılır.</dd></div>
                <div><dt>Doğrulama · sonraki %20</dt><dd>Keşifte öne çıkan yöntemin sonraki dönemde nasıl davrandığını gösterir. Sıralamayı değiştirmez.</dd></div>
                <div><dt>Test · son %20</dt><dd>En yeni dönemdir. Aday seçerken kullanılmaz; daha önce seçilmemiş verideki sonucu gösterir.</dd></div>
              </dl>
              <p className="research-guide-note">Getiri, o bölümün başındaki sermayeye göre dönem sonundaki değişimdir. Her bölüm başlangıç sermayesiyle ayrı simüle edilir; komisyon ve seçtiğiniz risk kuralları uygulanır.</p>
            </section>
            {leadingResearchCandidate && <section className="research-indicator-explainer" aria-labelledby="research-indicator-heading">
              <div className="research-guide-heading"><h2 id="research-indicator-heading">Keşifte ilk sıradaki adayın indikatörleri</h2><p>{leadingResearchCandidate.label} · sıralama keşif getirisine dayanıyor.</p></div>
              <ul className="research-indicator-list">{leadingResearchCandidate.components.map(component => <li key={component.strategy}>
                <div><strong>{component.strategy}</strong><p>{strategyOptions.find(option => option.name === component.strategy)?.summary}</p></div>
                <small>{indicatorParameterSummary(component)}</small>
              </li>)}</ul>
              <p className="research-guide-note"><strong>Birleşim kuralı: {leadingResearchCandidate.combination_method}.</strong> {combinationDescriptions[leadingResearchCandidate.combination_method]}</p>
            </section>}
            <div className="research-vs" aria-label="Lider strateji ve al-tut test karşılaştırması">
              <div><span>Lider aday · test getirisi</span><strong className={randomResearch.candidates[0].metrics.test.total_return >= 0 ? 'positive' : 'pnl-negative'}>{formatPercent(randomResearch.candidates[0].metrics.test.total_return)}</strong></div>
              <span className="research-vs-mark" aria-hidden="true">karşı</span>
              <div><span>Al-tut · aynı test dönemi</span><strong className={randomResearch.baseline.test.total_return >= 0 ? 'positive' : 'pnl-negative'}>{formatPercent(randomResearch.baseline.test.total_return)}</strong></div>
              <div className="research-vs-difference"><span>Getiri farkı</span><strong className={leadingTestDelta >= 0 ? 'positive' : 'pnl-negative'}>{formatPercentagePoints(leadingTestDelta)} puan</strong><small>{leadingTestDelta >= 0 ? 'Lider aday bu dönemde al-tutun üzerinde.' : 'Lider aday bu dönemde al-tutun altında.'}</small></div>
            </div>
            <section className="impact-card research-report">
              <div className="card-heading"><div><h2>Tüm adayların sonuçları</h2><p>Keşif getirisi ilk sıralamayı belirler. Doğrulama ve test sonuçları bu sırayı değiştirmez.</p></div></div>
              <div className="research-splits"><span>Keşif <strong>{randomResearch.split_bars.optimization} bar · %60</strong></span><span>Doğrulama <strong>{randomResearch.split_bars.validation} bar · %20</strong></span><span>Test <strong>{randomResearch.split_bars.test} bar · %20</strong></span><span>Risk <strong>{randomResearch.risk_enabled ? `Açık · SL ${randomResearch.stop_loss_pct}% / TP ${randomResearch.take_profit_pct}%` : 'Kapalı'}</strong></span></div>
              <div className="table-scroll research-table-wrap"><table className="research-table"><thead><tr><th>Sıra · rastgele kombinasyon</th><th><span>Keşif · %60</span><small>Aday seçimi</small></th><th><span>Doğrulama · %20</span><small>Sonraki dönem</small></th><th><span>Test · %20</span><small>Seçim dışı dönem</small></th><th><span>Testte azami düşüş</span><small>Zirveden en sert gerileme</small></th><th><span>Kârlı işlem oranı</span><small>Test dönemindeki işlemler</small></th><th>İşlem sayısı</th><th>Test son portföy</th></tr></thead><tbody>{randomResearch.candidates.map(candidate => <tr key={candidate.rank}><td><strong>#{candidate.rank} · {candidate.label}</strong><small>{candidate.components.map(item => `${item.strategy}: ${indicatorParameterSummary(item)}`).join(' / ')}</small></td><td className={candidate.metrics.optimization.total_return >= 0 ? 'pnl-positive' : 'pnl-negative'}>{formatPercent(candidate.metrics.optimization.total_return)}</td><td className={candidate.metrics.validation.total_return >= 0 ? 'pnl-positive' : 'pnl-negative'}>{formatPercent(candidate.metrics.validation.total_return)}</td><td className={candidate.metrics.test.total_return >= 0 ? 'pnl-positive' : 'pnl-negative'}>{formatPercent(candidate.metrics.test.total_return)}</td><td className="pnl-negative">{formatPercent(candidate.metrics.test.max_drawdown)}</td><td>{formatPercent(candidate.metrics.test.win_rate)}</td><td>{candidate.metrics.test.closed_trades}</td><td>{formatMoney(candidate.metrics.test.final_value, randomResearch.market)}</td></tr>)}</tbody></table></div>
              <p className="impact-footnote">Getiri farkı, lider adayın test getirisi eksi al-tut test getirisidir; yüzde puan olarak gösterilir. Sonuçlar geçmiş döneme aittir ve geleceği garanti etmez.</p>
            </section>
          </> : <p className="forecast-empty">Bir hisse, tarih aralığı ve indikatör havuzu seçip araştırmayı başlatın. Sonuçlar bu ekranda raporlanır; otomatik olarak kayıt geçmişine eklenmez.</p>}
        </>}
        {page === 'dashboard' && mode === 'forecast' && <>
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
            <section className="chart-card"><div className="chart-head"><div><h2>Fiyat geçmişi ve model tahmini</h2><p>Doğrulama verisi model eğitiminde kullanılmadı</p></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={[...forecast.history.map(point => ({ date: point.date, close: point.close })), { date: `+${forecast.horizon} işlem günü`, forecast: forecast.predicted_close, lower: forecast.lower_close, upper: forecast.upper_close }]} margin={{ top: 16, right: 10, bottom: 0, left: 2 }}><CartesianGrid stroke="#e4eaf2" vertical={false} /><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#53627a', fontSize: 11 }} minTickGap={44} /><YAxis tickLine={false} axisLine={false} tick={{ fill: '#53627a', fontSize: 11 }} tickFormatter={value => formatMoney(value, forecast.market)} width={74} domain={['auto','auto']} /><Tooltip formatter={(value: number) => formatMoney(value, forecast.market)} contentStyle={{ background: '#fff', border: '1px solid #d7dfeb', borderRadius: 8, color: '#142744', boxShadow: '0 12px 32px rgb(20 39 68 / 12%)' }} itemStyle={{ color: '#142744' }} labelStyle={{ color: '#53627a' }} /><Line dataKey="close" name="Kapanış" stroke="#00a6fb" strokeWidth={2.5} dot={false} connectNulls /><Line dataKey="forecast" name="Model tahmini" stroke="#e600ff" strokeWidth={2.5} strokeDasharray="5 4" /><Line dataKey="lower" name="Alt hata sınırı" stroke="#e600ff" strokeDasharray="2 4" dot={false} /><Line dataKey="upper" name="Üst hata sınırı" stroke="#e600ff" strokeDasharray="2 4" dot={false} /></ComposedChart></ResponsiveContainer></div><div className="chart-foot"><span>{forecast.as_of} son gözlem</span><span>{forecast.horizon} işlem günü ileri tahmin · {forecast.source}</span></div></section>
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
