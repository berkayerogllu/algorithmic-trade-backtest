export type Market = 'BIST' | 'US';
export type StockSymbol = { code: string; symbol: string; name: string; exchange: string; market: Market };

export const suggestedSymbols: StockSymbol[] = [
  { code: 'AAPL', symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', market: 'US' },
  { code: 'THYAO', symbol: 'THYAO.IS', name: 'Türk Hava Yolları A.O.', exchange: 'Borsa İstanbul', market: 'BIST' },
  { code: 'ASELS', symbol: 'ASELS.IS', name: 'Aselsan Elektronik Sanayi ve Ticaret A.Ş.', exchange: 'Borsa İstanbul', market: 'BIST' },
  { code: 'MSFT', symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', market: 'US' },
  { code: 'NVDA', symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ', market: 'US' },
  { code: 'TUPRS', symbol: 'TUPRS.IS', name: 'Tüpraş-Türkiye Petrol Rafinerileri A.Ş.', exchange: 'Borsa İstanbul', market: 'BIST' },
  { code: 'AMZN', symbol: 'AMZN', name: 'Amazon.com, Inc.', exchange: 'NASDAQ', market: 'US' },
  { code: 'GARAN', symbol: 'GARAN.IS', name: 'Türkiye Garanti Bankası A.Ş.', exchange: 'Borsa İstanbul', market: 'BIST' },
  { code: 'AKBNK', symbol: 'AKBNK.IS', name: 'Akbank T.A.Ş.', exchange: 'Borsa İstanbul', market: 'BIST' },
  { code: 'GOOGL', symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ', market: 'US' },
  { code: 'BIMAS', symbol: 'BIMAS.IS', name: 'BİM Birleşik Mağazalar A.Ş.', exchange: 'Borsa İstanbul', market: 'BIST' },
  { code: 'META', symbol: 'META', name: 'Meta Platforms, Inc.', exchange: 'NASDAQ', market: 'US' },
];
