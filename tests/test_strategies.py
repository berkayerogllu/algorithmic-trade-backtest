import pandas as pd

from algorithmic_backtest.strategies import BaseStrategy, BuyAndHoldStrategy


def test_buy_and_hold_is_invested_for_all_rows():
    data = pd.DataFrame({"Close": [10, 11, 9]}, index=pd.date_range("2024-01-01", periods=3))

    signals = BuyAndHoldStrategy().generate_signals(data)

    assert signals.tolist() == [1, 1, 1]
    assert signals.index.equals(data.index)


def test_buy_and_hold_handles_empty_data():
    data = pd.DataFrame(columns=["Close"], index=pd.DatetimeIndex([]))

    signals = BuyAndHoldStrategy().generate_signals(data)

    assert signals.empty
    assert signals.name == "signal"


def test_strategy_base_is_abstract():
    try:
        BaseStrategy()
    except TypeError:
        pass
    else:
        raise AssertionError("BaseStrategy should not be instantiated directly")
