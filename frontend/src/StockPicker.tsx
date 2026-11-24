import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { stockSymbols } from './stockSymbols';

type Props = { value: string; onChange: (symbol: string) => void };

const normalize = (value: string) => value.trim().toUpperCase().replace(/\.IS$/, '');
const fold = (value: string) => value.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function StockPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(normalize(value));
  const selected = stockSymbols.find(stock => stock.code === normalize(value));
  const results = useMemo(() => {
    const needle = fold(query.trim());
    if (!needle) return stockSymbols.slice(0, 10);
    return stockSymbols.filter(stock => fold(`${stock.code} ${stock.name}`).includes(needle)).slice(0, 12);
  }, [query]);
  const customCode = normalize(query);
  const canUseCustom = /^[A-Z0-9]{1,12}$/.test(customCode)
    && !stockSymbols.some(stock => stock.code === customCode);

  useEffect(() => setQuery(normalize(value)), [value]);

  const choose = (code: string) => {
    onChange(`${code}.IS`);
    setQuery(code);
    setOpen(false);
  };

  return <div className="stock-picker">
    <div className="stock-picker-control">
      <Search size={17} aria-hidden="true" />
      <input
        role="combobox"
        aria-label="Hisse kodu veya şirket adı ara"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="stock-picker-options"
        autoComplete="off"
        maxLength={30}
        placeholder="Kod veya şirket adı ara"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={event => {
          const next = event.target.value;
          setQuery(next);
          setOpen(true);
          const code = normalize(next);
          if (stockSymbols.some(stock => stock.code === code)) onChange(`${code}.IS`);
        }}
        onKeyDown={event => {
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'Enter' && open) {
            event.preventDefault();
            if (results[0]) choose(results[0].code);
            else if (canUseCustom) choose(customCode);
          }
        }}
      />
      <button type="button" className="picker-toggle" aria-label={open ? 'Hisse listesini kapat' : 'Hisse listesini aç'} onClick={() => setOpen(!open)}>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
    </div>
    {open && <div className="stock-picker-menu">
      <div className="picker-caption">{query.trim() ? 'Arama sonuçları' : 'Sık kullanılan hisseler'}</div>
      <div id="stock-picker-options" className="stock-picker-options" role="listbox" aria-label="BIST hisse önerileri">
        {results.map(stock => <button
          type="button"
          role="option"
          aria-selected={normalize(value) === stock.code}
          className="stock-option"
          key={stock.code}
          onMouseDown={event => event.preventDefault()}
          onClick={() => choose(stock.code)}
        >
          <span className="stock-option-code">{stock.code}</span>
          <span className="stock-option-name">{stock.name}</span>
          {normalize(value) === stock.code && <Check size={16} aria-hidden="true" />}
        </button>)}
        {!results.length && !canUseCustom && <p className="picker-empty">Eşleşme bulunamadı. Hisse kodunu yazabilirsiniz.</p>}
      </div>
      {!results.length && canUseCustom && <button type="button" className="custom-symbol" onMouseDown={event => event.preventDefault()} onClick={() => choose(customCode)}>
        <span><strong>{customCode}</strong> kodunu kullan</span><span className="custom-symbol-hint">Yahoo Finance · .IS</span>
      </button>}
      <p className="picker-footnote">Listede olmayan hisseler için kodu yazıp kullanın.</p>
    </div>}
    <span className="picker-selected">Seçili: <strong>{selected ? `${selected.code} · ${selected.name}` : value || 'Hisse seçin'}</strong></span>
  </div>;
}
