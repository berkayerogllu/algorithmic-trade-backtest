import pandas as pd
import pytest

from algorithmic_backtest.strategies import MACDStrategy, RSIStrategy, SMACrossoverStrategy


def prices(values):
    return pd.DataFrame({"Close": values}, index=pd.date_range("2024-01-01", periods=len(values)))


def test_sma_crossover_waits_until_slow_window_is_available():
    data = prices([10, 9, 8, 9, 10, 11, 12])

    signals = SMACrossoverStrategy(fast_period=2, slow_period=3).generate_signals(data)

    assert signals.iloc[:2].tolist() == [0, 0]
    assert signals.iloc[-1] == 1
    assert signals.index.equals(data.index)


def test_rsi_identifies_oversold_and_overbought_values():
    strategy = RSIStrategy(period=2, oversold=30, overbought=70)
    falling = prices([10, 9, 8, 7, 6])
    rising = prices([6, 7, 8, 9, 10])

    assert strategy.generate_signals(falling).iloc[-1] == 1
    assert strategy.rsi(rising).iloc[-1] == 100
    assert strategy.generate_signals(rising).iloc[-1] == 0


def test_macd_returns_binary_signals_aligned_to_input():
    data = prices(list(range(1, 61)))

    signals = MACDStrategy(fast_period=3, slow_period=6, signal_period=3).generate_signals(data)

    assert signals.index.equals(data.index)
    assert set(signals.unique()).issubset({0, 1})
    assert signals.iloc[-1] == 1


@pytest.mark.parametrize("strategy", [lambda: SMACrossoverStrategy(5, 5), lambda: MACDStrategy(26, 12)])
def test_moving_average_strategies_reject_invalid_period_order(strategy):
    with pytest.raises(ValueError):
        strategy()
