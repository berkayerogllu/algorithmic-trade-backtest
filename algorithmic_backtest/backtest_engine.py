"""Chronological strategy simulation engine."""

from __future__ import annotations

import math

import pandas as pd

from .exceptions import BacktestError
from .portfolio import Portfolio
from .risk_manager import RiskManager
from .strategies.base import BaseStrategy


class BacktestEngine:
    """Run a long/flat strategy with next-bar signal execution."""

    def __init__(
        self,
        initial_cash: float = 100_000.0,
        commission_rate: float = 0.001,
        risk_manager: RiskManager | None = None,
    ) -> None:
        self.initial_cash = initial_cash
        self.commission_rate = commission_rate
        self.risk_manager = risk_manager

    def run(self, data: pd.DataFrame, strategy: BaseStrategy) -> pd.DataFrame:
        if data.empty:
            raise BacktestError("Cannot backtest empty market data")
        if "Close" not in data.columns:
            raise BacktestError("Market data must contain a 'Close' column")

        close = pd.to_numeric(data["Close"], errors="coerce")
        if close.isna().any() or not all(math.isfinite(value) and value > 0 for value in close):
            raise BacktestError("Close prices must be finite positive numbers")

        signals = strategy.generate_signals(data)
        if not signals.index.equals(data.index):
            raise BacktestError("Strategy signals must align with the input data index")
        if signals.isna().any() or not signals.isin([0, 1]).all():
            raise BacktestError("Strategy signals must contain only 0 and 1")

        portfolio = Portfolio(self.initial_cash, self.commission_rate)
        rows = []
        for index, (date, price) in enumerate(close.items()):
            # A close-derived signal can only be acted on at the following bar.
            if index > 0:
                desired_position = int(signals.iloc[index - 1])
                if desired_position == 1 and portfolio.quantity == 0:
                    allocation = (
                        self.risk_manager.allocation_fraction()
                        if self.risk_manager is not None
                        else 1.0
                    )
                    portfolio.buy(float(price), date, allocation)
                elif desired_position == 0 and portfolio.quantity > 0:
                    portfolio.sell(float(price), date)

                if portfolio.quantity > 0 and self.risk_manager is not None:
                    reason = self.risk_manager.exit_reason(portfolio.entry_price, float(price))
                    if reason is not None:
                        portfolio.sell(float(price), date, reason)

            rows.append(
                {
                    "Close": float(price),
                    "Signal": int(signals.iloc[index]),
                    "Position": int(portfolio.quantity > 0),
                    "Cash": portfolio.cash,
                    "Quantity": portfolio.quantity,
                    "Equity": portfolio.value(float(price)),
                    "ExitReason": portfolio.trades[-1].exit_reason
                    if portfolio.trades and portfolio.trades[-1].exit_date == date
                    else None,
                }
            )

        result = pd.DataFrame(rows, index=data.index)
        result.attrs["trades"] = portfolio.trades
        return result
