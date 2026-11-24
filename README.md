# Algorithmic Trading and Backtesting Simulator

Educational Python project for testing and comparing algorithmic trading
strategies on historical market data.

## Development

```bash
python -m pytest
```

The project is developed incrementally with one feature branch per milestone.

## BIST historical data

For the educational prototype, daily adjusted OHLCV data can be downloaded
from Yahoo Finance with Borsa Istanbul tickers such as `THYAO.IS`:

```python
from algorithmic_backtest.data_loader import DataLoader

prices = DataLoader().download_yfinance("THYAO.IS", start="2019-01-01")
prices.to_csv("data/THYAO.IS.csv", index_label="Date")
```

Yahoo Finance is a convenient delayed-data source and is not the official
exchange feed. Borsa İstanbul provides official historical data through its
DataStore, which may require registration or purchase. Check data rights and
adjustment conventions before redistributing or using downloaded data.

