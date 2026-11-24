"""Performance metrics for backtest results."""

from __future__ import annotations

import math

import pandas as pd

from .exceptions import BacktestError


class PerformanceAnalyzer:
    """Calculate portfolio return, risk, drawdown, and trade statistics."""

    def __init__(self, risk_free_rate: float = 0.0, periods_per_year: int = 252) -> None:
        if periods_per_year < 1:
            raise ValueError("periods_per_year must be positive")
        if risk_free_rate < 0:
            raise ValueError("risk_free_rate must not be negative")
        self.risk_free_rate = risk_free_rate
        self.periods_per_year = periods_per_year

    def analyze(self, results: pd.DataFrame) -> dict[str, float]:
        """Return standard metrics from BacktestEngine output.

        ``max_drawdown`` is expressed as a negative fraction (e.g. -0.2 = -20%).
        ``win_rate`` is between 0 and 1 and uses closed trades only.
        """
        if results.empty or "Equity" not in results.columns:
            raise BacktestError("Backtest results must contain non-empty Equity data")

        equity = pd.to_numeric(results["Equity"], errors="coerce")
        if equity.isna().any() or (equity <= 0).any():
            raise BacktestError("Equity values must be finite positive numbers")
        if not all(math.isfinite(value) for value in equity):
            raise BacktestError("Equity values must be finite positive numbers")

        returns = equity.pct_change().dropna()
        daily_risk_free = (1 + self.risk_free_rate) ** (1 / self.periods_per_year) - 1
        volatility = returns.std(ddof=1)
        sharpe = (
            math.sqrt(self.periods_per_year) * (returns.mean() - daily_risk_free) / volatility
            if len(returns) > 1 and volatility > 0
            else 0.0
        )
        drawdown = equity / equity.cummax() - 1
        trades = results.attrs.get("trades", [])
        win_rate = sum(trade.pnl > 0 for trade in trades) / len(trades) if trades else 0.0

        return {
            "total_return": float(equity.iloc[-1] / equity.iloc[0] - 1),
            "sharpe_ratio": float(sharpe),
            "max_drawdown": float(drawdown.min()),
            "win_rate": float(win_rate),
            "closed_trades": float(len(trades)),
        }
