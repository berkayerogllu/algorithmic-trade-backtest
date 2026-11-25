import { useEffect, useState } from 'react';
import { Check, ChevronDown, LoaderCircle, Search } from 'lucide-react';
import { defaultSymbols, Market, StockSymbol } from './stockSymbols';

type Props = {
  value: string;
  market: Market;
  onChange: (symbol: string) => void;
  onMarketChange: (market: Market) => void;
};
type SearchResponse = { symbols: { symbol: string; name: string; exchange: string; market: Market }[] };

const normalize = (value: string) => value.trim().toUpperCase().replace(/\.IS$/, '');
const symbolForCode = (code: string, market: Market) => market === 'BIST' ? `${code}.IS` : code;

export function StockPicker({ value, market, onChange, onMarketChange }: Props) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [query, setQuery] = useState(normalize(value));
  const [results, setResults] = useState<StockSymbol[]>([]);
  const [pickedStock, setPickedStock] = useState<StockSymbol | null>(() => Object.values(defaultSymbols).find(stock => stock.symbol === value) ?? null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const customCode = normalize(query);
  const canUseCustom = market === 'BIST'
    ? /^[A-Z0-9]{1,12}$/.test(customCode)
    : /^[A-Z][A-Z0-9.-]{0,14}$/.test(customCode);
  const selected = pickedStock?.symbol === value ? pickedStock : null;

  useEffect(() => setActiveIndex(0), [market, query]);
  useEffect(() => setQuery(normalize(value)), [value]);

  useEffect(() => {
    if (!open) {
      setResults([]);
      setSearching(false);
      setSearchError('');
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        const params = new URLSearchParams({ market });
        if (query.trim()) params.set('q', query.trim());
        const response = await fetch(`/api/symbols?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Hisse kataloğuna erişilemiyor.');
        const body = await response.json() as SearchResponse;
        setResults(body.symbols.map(item => ({
          code: market === 'BIST' ? item.symbol.replace(/\.IS$/, '') : item.symbol,
          symbol: item.symbol,
          name: item.name,
          exchange: item.exchange,
          market: item.market,
        })));
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setSearchError('Hisse kataloğuna şu anda erişilemiyor. Sembol kodunu elle kullanabilirsiniz.');
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 180);
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
    const defaultStock = defaultSymbols[nextMarket];
    setPickedStock(defaultStock);
    onMarketChange(nextMarket);
    onChange(defaultStock.symbol);
    setQuery(defaultStock.code);
    setResults([]);
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
          const exact = results.find(stock => stock.market === market && stock.code === normalize(next));
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
      <div className="picker-caption">{query.trim() ? 'Katalog arama sonuçları' : market === 'BIST' ? 'BIST hisseleri' : 'ABD hisseleri'}</div>
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
        {!results.length && !searching && (!canUseCustom || !query.trim()) && <p className="picker-empty">Sonuç yok. Sembolü kontrol edip tekrar arayın.</p>}
      </div>
      {searchError && <p className="picker-search-error" role="status">{searchError}</p>}
      {!results.length && !searching && canUseCustom && query.trim() && <button type="button" className="custom-symbol" onMouseDown={event => event.preventDefault()} onClick={chooseCustom}>
        <span><strong>{customCode}</strong> sembolünü kullan</span><span className="custom-symbol-hint">{market === 'BIST' ? 'Borsa İstanbul · .IS' : 'ABD · Yahoo Finance'}</span>
      </button>}
      <p className="picker-footnote">Hisse listesi Supabase kataloğundan gelir. Yeni bulunan eşleşmeler kataloğa eklenir.</p>
    </div>}
    <span className="picker-selected">Seçili: <strong>{selected ? `${selected.code} · ${selected.name}` : value || 'Hisse seçin'}</strong></span>
  </div>;
}
