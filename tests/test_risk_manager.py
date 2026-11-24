import pandas as pd
import pytest

from algorithmic_backtest.backtest_engine import BacktestEngine
from algorithmic_backtest.risk_manager import RiskManager
from algorithmic_backtest.strategies.base import BaseStrategy


class AlwaysLong(BaseStrategy):
    def generate_signals(self, data):
        return pd.Series(1, index=data.index)


def market(prices):
    return pd.DataFrame({"Close": prices}, index=pd.date_range("2024-01-01", periods=len(prices)))


def test_risk_manager_limits_allocation_by_loss_budget():
    risk = RiskManager(stop_loss_pct=0.05, risk_per_trade=0.01, max_position_fraction=0.8)

    assert risk.allocation_fraction() == pytest.approx(0.2)


def test_stop_loss_closes_position_and_records_reason():
    risk = RiskManager(stop_loss_pct=0.1, take_profit_pct=None, risk_per_trade=0.5)
    result = BacktestEngine(1000, 0, risk).run(market([100, 100, 85, 90]), AlwaysLong())

    assert result["Position"].tolist() == [0, 1, 0, 1]
    assert result.iloc[2]["ExitReason"] == "stop_loss"
    assert result.attrs["trades"][0].exit_reason == "stop_loss"


def test_take_profit_closes_position():
    risk = RiskManager(stop_loss_pct=None, take_profit_pct=0.1)
    result = BacktestEngine(1000, 0, risk).run(market([100, 100, 115]), AlwaysLong())

    assert result.iloc[2]["Position"] == 0
    assert result.iloc[2]["ExitReason"] == "take_profit"


@pytest.mark.parametrize("kwargs", [{"stop_loss_pct": 1.2}, {"max_position_fraction": 0}, {"risk_per_trade": 1}])
def test_risk_manager_rejects_invalid_parameters(kwargs):
    with pytest.raises(ValueError):
        RiskManager(**kwargs)
