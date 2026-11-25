export type Market = 'BIST' | 'US';
export type StockSymbol = { code: string; symbol: string; name: string; exchange: string; market: Market };

export const defaultSymbols: Record<Market, StockSymbol> = {
  BIST: { code: 'THYAO', symbol: 'THYAO.IS', name: 'Türk Hava Yolları', exchange: 'Borsa İstanbul', market: 'BIST' },
  US: { code: 'AAPL', symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', market: 'US' },
};
