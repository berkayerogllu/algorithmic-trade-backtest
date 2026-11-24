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

## Strategy parameter search

Split data chronologically before optimization and pass only the optimization
partition to the optimizer. Keep validation for model selection checks and
test data untouched until the final evaluation.

```python
from algorithmic_backtest.data_loader import DataLoader
from algorithmic_backtest.optimizer import StrategyOptimizer
from algorithmic_backtest.strategies import SMACrossoverStrategy

prices = DataLoader().load_csv("data/THYAO.IS.csv")
optimization, validation, test = DataLoader().split(prices)
ranked = StrategyOptimizer().optimize(
    optimization,
    SMACrossoverStrategy,
    {"fast_period": [5, 10, 20], "slow_period": [30, 50, 100]},
    n_jobs=2,
)
```

Parallel search uses Python worker processes. Define strategy classes at the
top level of an importable module when using `n_jobs` greater than one.

## TypeScript research interface

The interface is a React and TypeScript application backed by the Python
simulation engine. Start the API and frontend in separate terminals:

```bash
python -m pip install -e .
python -m uvicorn algorithmic_backtest.api:app --reload
cd frontend && npm install && npm run dev
```

Open `http://127.0.0.1:5173`. THYAO data is included; other BIST symbols are
loaded from Yahoo Finance when the backtest runs.

