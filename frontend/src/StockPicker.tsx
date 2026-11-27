import { useEffect, useRef, useState } from 'react';
import { Check, LoaderCircle, Search } from 'lucide-react';
import { Market, StockSymbol, suggestedSymbols } from './stockSymbols';

type Props = {
  value: string;
  market: Market;
  onChange: (symbol: string, market: Market) => void;
};
type SearchResponse = { symbols: { symbol: string; name: string; exchange: string; market: Market }[] };

const normalize = (value: string) => value.trim().toUpperCase();
const marketForCustomSymbol = (code: string): Market => code.endsWith('.IS') ? 'BIST' : 'US';
const stockSearchCache = new Map<string, StockSymbol[]>();
const stockSearchInFlight = new Map<string, Promise<StockSymbol[]>>();

const searchKey = (query: string) => query.trim().toLocaleUpperCase('tr-TR');
const filterSuggestedSymbols = (query: string) => {
  const needle = query.trim().toLocaleLowerCase('tr-TR');
  return needle
    ? suggestedSymbols.filter(stock => `${stock.code} ${stock.name} ${stock.exchange}`.toLocaleLowerCase('tr-TR').includes(needle))
    : suggestedSymbols;
};

const loadStockSymbols = (query: string): Promise<StockSymbol[]> => {
  const key = searchKey(query);
  const cached = stockSearchCache.get(key);
  if (cached) return Promise.resolve(cached);
  const pending = stockSearchInFlight.get(key);
  if (pending) return pending;

  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  const request = fetch(`/api/symbols?${params.toString()}`)
    .then(async response => {
      if (!response.ok) throw new Error('Hisse kataloğuna erişilemiyor.');
      const body = await response.json() as SearchResponse;
      const symbols = body.symbols.map(item => ({
        code: item.market === 'BIST' ? item.symbol.replace(/\.IS$/, '') : item.symbol,
        symbol: item.symbol,
        name: item.name,
        exchange: item.exchange,
        market: item.market,
      }));
      stockSearchCache.set(key, symbols);
      return symbols;
    })
    .finally(() => stockSearchInFlight.delete(key));
  stockSearchInFlight.set(key, request);
  return request;
};

export function StockPicker({ value, market, onChange }: Props) {
  const searchRegion = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [query, setQuery] = useState(value ? normalize(value).replace(/\.IS$/, '') : '');
  const [results, setResults] = useState<StockSymbol[]>(suggestedSymbols);
  const [pickedStock, setPickedStock] = useState<StockSymbol | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const customCode = normalize(query);
  const customMarket = marketForCustomSymbol(customCode);
  const customSymbol = customMarket === 'BIST' ? customCode : customCode.replace(/\.IS$/, '');
  const canUseCustom = customMarket === 'BIST'
    ? /^[A-Z0-9]{1,12}\.IS$/.test(customCode)
    : /^[A-Z][A-Z0-9.-]{0,14}$/.test(customCode);
  const selected = pickedStock?.symbol === value ? pickedStock : null;

  useEffect(() => {
    void loadStockSymbols('').catch(() => undefined);
  }, []);

  useEffect(() => setActiveIndex(0), [market, query]);
  useEffect(() => {
    if (!open) {
      setSearching(false);
      return;
    }
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (searchRegion.current && !searchRegion.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const searchQuery = query.trim();
    const cached = stockSearchCache.get(searchKey(searchQuery));
    setResults(cached ?? filterSuggestedSymbols(searchQuery));
    setSearchError('');
    if (searchQuery && searchQuery.length < 2) {
      setSearching(false);
      return;
    }
    if (cached) {
      setSearching(false);
      return;
    }
    let current = true;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void loadStockSymbols(searchQuery)
        .then(symbols => {
          if (current) setResults(symbols);
        })
        .catch(() => {
          if (current) setSearchError('Hisse kataloğuna şu anda erişilemiyor. Sembol kodunu elle kullanabilirsiniz.');
        })
        .finally(() => {
          if (current) setSearching(false);
        });
    }, searchQuery ? 40 : 0);
    return () => {
      window.clearTimeout(timer);
      current = false;
    };
  }, [market, open, query]);

  const choose = (stock: StockSymbol) => {
    setPickedStock(stock);
    onChange(stock.symbol, stock.market);
    setQuery(stock.code);
    setOpen(false);
  };

  const chooseCustom = () => {
    const symbol = customMarket === 'BIST' ? customCode : customSymbol;
    setPickedStock({ code: customSymbol.replace(/\.IS$/, ''), symbol, name: customSymbol.replace(/\.IS$/, ''), exchange: customMarket === 'BIST' ? 'Borsa İstanbul' : 'ABD borsası', market: customMarket });
    onChange(symbol, customMarket);
    setQuery(customSymbol.replace(/\.IS$/, ''));
    setOpen(false);
  };

  return <div className="stock-picker">
    <div className="stock-picker-search" ref={searchRegion}>
    <div className="stock-picker-control">
      <Search size={17} aria-hidden="true" />
      <input
        role="combobox"
        aria-label="Türkiye ve ABD hisselerinde ara"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="stock-picker-options"
        aria-activedescendant={open && results[activeIndex] ? `stock-option-${results[activeIndex].symbol.replace(/[^a-zA-Z0-9_-]/g, '-')}` : undefined}
        autoComplete="off"
        maxLength={60}
        placeholder="Şirket adı veya sembol ara"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={event => {
          const next = event.target.value;
          setQuery(next);
          setResults(filterSuggestedSymbols(next));
          setOpen(true);
          const exact = results.find(stock => stock.code === normalize(next));
          if (exact) {
            setPickedStock(exact);
            onChange(exact.symbol, exact.market);
          } else {
            setPickedStock(null);
            onChange('', market);
          }
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
      {searching && <LoaderCircle className="picker-spinner" size={16} aria-label="Aranıyor" />}
    </div>
    {open && <div className="stock-picker-menu">
      <div className="picker-caption">{query.trim() ? 'Arama sonuçları' : 'Öne çıkan hisseler'}</div>
      <div id="stock-picker-options" className="stock-picker-options" role="listbox" aria-label="Türkiye ve ABD hisse arama sonuçları">
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
        {!results.length && !searching && (!canUseCustom || !query.trim()) && <p className="picker-empty">{query.trim() ? query.trim().length < 2 ? 'Aramak için en az iki karakter yazın.' : 'Eşleşme bulunamadı. Şirket adını veya sembolü kontrol edin.' : 'Öne çıkan hisse bulunamadı.'}</p>}
      </div>
      {searchError && <p className="picker-search-error" role="status">{searchError}</p>}
      {!results.length && !searching && canUseCustom && query.trim() && <button type="button" className="custom-symbol" onMouseDown={event => event.preventDefault()} onClick={chooseCustom}>
        <span><strong>{customSymbol.replace(/\.IS$/, '')}</strong> sembolünü kullan</span><span className="custom-symbol-hint">{customMarket === 'BIST' ? 'Borsa İstanbul · .IS' : 'ABD borsası'}</span>
      </button>}
      <p className="picker-footnote">Türkiye ve ABD hisseleri aynı listede aranır. Özel BIST sembollerinde .IS uzantısını kullanın.</p>
    </div>}
    </div>
    {selected && <span className="picker-selected"><span className="market-chip">{selected.market === 'BIST' ? 'BIST' : selected.exchange}</span><strong>{selected.code} · {selected.name}</strong></span>}
  </div>;
}
