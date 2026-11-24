import pandas as pd
import pytest

from algorithmic_backtest.exceptions import BacktestError
from algorithmic_backtest.performance import PerformanceAnalyzer
from algorithmic_backtest.portfolio import Trade


def result(equity, trades=None):
    frame = pd.DataFrame({"Equity": equity})
    frame.attrs["trades"] = trades or []
    return frame


def test_analyzer_calculates_return_drawdown_and_trade_win_rate():
    trades = [
        Trade("d1", "d2", 1, 10, 12, 2),
        Trade("d3", "d4", 1, 12, 10, -2),
    ]

    metrics = PerformanceAnalyzer().analyze(result([100, 120, 90, 110], trades))

    assert metrics["total_return"] == pytest.approx(0.1)
    assert metrics["max_drawdown"] == pytest.approx(-0.25)
    assert metrics["win_rate"] == pytest.approx(0.5)
    assert metrics["closed_trades"] == 2


def test_sharpe_is_zero_for_constant_equity():
    metrics = PerformanceAnalyzer().analyze(result([100, 100, 100]))

    assert metrics["sharpe_ratio"] == 0


def test_analyzer_rejects_missing_equity():
    with pytest.raises(BacktestError, match="Equity"):
        PerformanceAnalyzer().analyze(pd.DataFrame({"Close": [10, 11]}))


def test_analyzer_rejects_invalid_equity():
    with pytest.raises(BacktestError, match="positive"):
        PerformanceAnalyzer().analyze(result([100, 0]))
