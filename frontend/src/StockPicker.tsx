import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, LoaderCircle, Search } from 'lucide-react';
import { Market, StockSymbol, stockSymbols } from './stockSymbols';

type Props = {
  value: string;
  market: Market;
  onChange: (symbol: string) => void;
  onMarketChange: (market: Market) => void;
};
type SearchResponse = { symbols: { symbol: string; name: string; exchange: string; market: Market }[] };

const normalize = (value: string) => value.trim().toUpperCase().replace(/\.IS$/, '');
const fold = (value: string) => value.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const symbolForCode = (code: string, market: Market) => market === 'BIST' ? `${code}.IS` : code;

export function StockPicker({ value, market, onChange, onMarketChange }: Props) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [query, setQuery] = useState(normalize(value));
  const [remoteResults, setRemoteResults] = useState<StockSymbol[]>([]);
  const [pickedStock, setPickedStock] = useState<StockSymbol | null>(() => stockSymbols.find(stock => stock.symbol === value) ?? null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const localResults = useMemo(() => {
    const available = stockSymbols.filter(stock => stock.market === market);
    const needle = fold(query.trim());
    if (!needle) return available.slice(0, 10);
    return available.filter(stock => fold(`${stock.code} ${stock.name} ${stock.exchange}`).includes(needle)).slice(0, 12);
  }, [market, query]);
  const results = useMemo(() => {
    const combined = [...remoteResults, ...localResults];
    return combined.filter((stock, index) => combined.findIndex(item => item.symbol === stock.symbol) === index).slice(0, 12);
  }, [localResults, remoteResults]);
  const customCode = normalize(query);
  const canUseCustom = market === 'BIST'
    ? /^[A-Z0-9]{1,12}$/.test(customCode) && !stockSymbols.some(stock => stock.symbol === `${customCode}.IS`)
    : /^[A-Z][A-Z0-9.-]{0,14}$/.test(customCode) && !stockSymbols.some(stock => stock.symbol === customCode);
  const selected = pickedStock?.symbol === value ? pickedStock : [...remoteResults, ...stockSymbols].find(stock => stock.symbol === value);
  useEffect(() => setActiveIndex(0), [market, query]);

  useEffect(() => {
    setQuery(normalize(value));
  }, [value]);

  useEffect(() => {
    const term = query.trim();
    if (!open || term.length < 2) {
      setRemoteResults([]);
      setSearching(false);
      setSearchError('');
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        const params = new URLSearchParams({ q: term, market });
        const response = await fetch(`/api/symbols?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Sembol sağlayıcısına erişilemiyor.');
        const body = await response.json() as SearchResponse;
        const mapped = body.symbols.map(item => ({
          code: market === 'BIST' ? item.symbol.replace(/\.IS$/, '') : item.symbol,
          symbol: item.symbol,
          name: item.name,
          exchange: item.exchange,
          market: item.market,
        }));
        setRemoteResults(mapped);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setSearchError('Canlı arama şu anda yanıt vermiyor. Önerilen hisseleri veya sembol kodunu kullanabilirsiniz.');
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 280);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [market, open, query]);

  const choose = (stock: StockSymbol) => {
    setPickedStock(stock);
    onChange(stock.symbol);
    setQuery(stock.code);
    setOpen(false);
  };

  const chooseCustom = () => {
    const symbol = symbolForCode(customCode, market);
    setPickedStock({ code: customCode, symbol, name: customCode, exchange: market === 'BIST' ? 'Borsa İstanbul' : 'ABD borsası', market });
    onChange(symbol);
    setQuery(customCode);
    setOpen(false);
  };

  const changeMarket = (nextMarket: Market) => {
    if (nextMarket === market) return;
    const defaultStock = stockSymbols.find(stock => stock.symbol === (nextMarket === 'BIST' ? 'THYAO.IS' : 'AAPL'))!;
    setPickedStock(defaultStock);
    onMarketChange(nextMarket);
    onChange(nextMarket === 'BIST' ? 'THYAO.IS' : 'AAPL');
    setQuery(nextMarket === 'BIST' ? 'THYAO' : 'AAPL');
    setRemoteResults([]);
    setOpen(false);
  };

  return <div className="stock-picker">
    <div className="market-switch" role="group" aria-label="Hisse piyasası">
      <button type="button" className={market === 'BIST' ? 'selected' : ''} aria-pressed={market === 'BIST'} onClick={() => changeMarket('BIST')}>
        <span>Türkiye</span><small>BIST</small>
      </button>
      <button type="button" className={market === 'US' ? 'selected' : ''} aria-pressed={market === 'US'} onClick={() => changeMarket('US')}>
        <span>Amerika</span><small>NYSE · Nasdaq</small>
      </button>
    </div>
    <div className="stock-picker-control">
      <Search size={17} aria-hidden="true" />
      <input
        role="combobox"
        aria-label={`${market === 'BIST' ? 'BIST' : 'ABD'} hisse kodu veya şirket adı ara`}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="stock-picker-options"
        aria-activedescendant={open && results[activeIndex] ? `stock-option-${results[activeIndex].symbol.replace(/[^a-zA-Z0-9_-]/g, '-')}` : undefined}
        autoComplete="off"
        maxLength={60}
        placeholder={market === 'BIST' ? 'Sembol veya şirket adı' : 'ABD sembolü veya şirket adı'}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={event => {
          const next = event.target.value;
          setQuery(next);
          setOpen(true);
          const exact = stockSymbols.find(stock => stock.market === market && stock.code === normalize(next));
          if (exact) onChange(exact.symbol);
        }}
        onKeyDown={event => {
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'ArrowDown' && open && results.length) {
            event.preventDefault();
            setActiveIndex(index => (index + 1) % results.length);
          }
          if (event.key === 'ArrowUp' && open && results.length) {
            event.preventDefault();
            setActiveIndex(index => (index - 1 + results.length) % results.length);
          }
          if (event.key === 'Enter' && open) {
            event.preventDefault();
            if (results[activeIndex]) choose(results[activeIndex]);
            else if (canUseCustom) chooseCustom();
          }
        }}
      />
      {searching ? <LoaderCircle className="picker-spinner" size={16} aria-label="Aranıyor" /> : <button type="button" className="picker-toggle" aria-label={open ? 'Hisse listesini kapat' : 'Hisse listesini aç'} onClick={() => setOpen(!open)}>
        <ChevronDown size={16} aria-hidden="true" />
      </button>}
    </div>
    {open && <div className="stock-picker-menu">
      <div className="picker-caption">{query.trim() ? 'Arama sonuçları' : market === 'BIST' ? 'Sık kullanılan BIST hisseleri' : 'Sık kullanılan ABD hisseleri'}</div>
      <div id="stock-picker-options" className="stock-picker-options" role="listbox" aria-label={`${market === 'BIST' ? 'BIST' : 'ABD'} hisse arama sonuçları`}>
        {results.map((stock, index) => <button
          type="button"
          role="option"
          id={`stock-option-${stock.symbol.replace(/[^a-zA-Z0-9_-]/g, '-')}`}
          aria-selected={value === stock.symbol}
          className={`stock-option ${activeIndex === index ? 'active' : ''}`}
          key={stock.symbol}
          onMouseEnter={() => setActiveIndex(index)}
          onMouseDown={event => event.preventDefault()}
          onClick={() => choose(stock)}
        >
          <span className="stock-option-code">{stock.code}</span>
          <span className="stock-option-name">{stock.name}</span>
          <span className="stock-exchange-tag">{stock.exchange}</span>
          {value === stock.symbol && <Check size={16} aria-hidden="true" />}
        </button>)}
        {!results.length && !searching && !canUseCustom && <p className="picker-empty">Sonuç yok. Sembolü kontrol edip tekrar arayın.</p>}
      </div>
      {searchError && <p className="picker-search-error" role="status">{searchError}</p>}
      {!results.length && !searching && canUseCustom && <button type="button" className="custom-symbol" onMouseDown={event => event.preventDefault()} onClick={chooseCustom}>
        <span><strong>{customCode}</strong> sembolünü kullan</span><span className="custom-symbol-hint">{market === 'BIST' ? 'Borsa İstanbul · .IS' : 'ABD · Yahoo Finance'}</span>
      </button>}
      <p className="picker-footnote">Piyasa verisi ve şirket adları Yahoo Finance aramasından gelir.</p>
    </div>}
    <span className="picker-selected">Seçili: <strong>{selected ? `${selected.code} · ${selected.name}` : value || 'Hisse seçin'}</strong></span>
  </div>;
}
