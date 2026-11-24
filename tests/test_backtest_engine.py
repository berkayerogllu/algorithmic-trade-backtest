import pandas as pd
import pytest

from algorithmic_backtest.backtest_engine import BacktestEngine
from algorithmic_backtest.exceptions import BacktestError
from algorithmic_backtest.strategies.base import BaseStrategy


class FixedSignals(BaseStrategy):
    def __init__(self, values):
        self.values = values

    def generate_signals(self, data):
        return pd.Series(self.values, index=data.index, dtype="int8")


def market(prices):
    return pd.DataFrame({"Close": prices}, index=pd.date_range("2024-01-01", periods=len(prices)))


def test_signal_executes_on_next_bar_and_portfolio_marks_to_market():
    result = BacktestEngine(initial_cash=1000, commission_rate=0).run(
        market([10, 20, 30]), FixedSignals([1, 1, 1])
    )

    assert result["Position"].tolist() == [0, 1, 1]
    assert result["Equity"].tolist() == [1000, 1000, 1500]


def test_buy_and_sell_account_for_commission_and_record_closed_trade():
    result = BacktestEngine(initial_cash=1000, commission_rate=0.01).run(
        market([10, 10, 20, 20]), FixedSignals([1, 1, 0, 0])
    )

    trades = result.attrs["trades"]
    assert len(trades) == 1
    assert trades[0].pnl < 1000
    assert result["Position"].tolist() == [0, 1, 1, 0]
    assert result["Equity"].iloc[-1] < 2000


def test_engine_rejects_invalid_price_data():
    with pytest.raises(BacktestError, match="positive"):
        BacktestEngine().run(market([10, 0]), FixedSignals([0, 0]))


def test_engine_rejects_misaligned_strategy_signals():
    class Misaligned(BaseStrategy):
        def generate_signals(self, data):
            return pd.Series([0], index=[pd.Timestamp("2023-01-01")])

    with pytest.raises(BacktestError, match="align"):
        BacktestEngine().run(market([10, 11]), Misaligned())
