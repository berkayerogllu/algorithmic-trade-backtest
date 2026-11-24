"""Technical indicator based long/flat strategies."""

import pandas as pd

from .base import BaseStrategy


def _close_prices(data: pd.DataFrame) -> pd.Series:
    if "Close" not in data.columns:
        raise ValueError("Input data must contain a 'Close' column")
    return pd.to_numeric(data["Close"], errors="raise")


class SMACrossoverStrategy(BaseStrategy):
    """Go long when the fast simple moving average is above the slow average."""

    def __init__(self, fast_period: int = 20, slow_period: int = 50) -> None:
        if fast_period < 1 or slow_period < 1:
            raise ValueError("Moving average periods must be positive")
        if fast_period >= slow_period:
            raise ValueError("fast_period must be smaller than slow_period")
        self.fast_period = fast_period
        self.slow_period = slow_period

    def generate_signals(self, data: pd.DataFrame) -> pd.Series:
        close = _close_prices(data)
        fast = close.rolling(self.fast_period, min_periods=self.fast_period).mean()
        slow = close.rolling(self.slow_period, min_periods=self.slow_period).mean()
        return (fast > slow).fillna(False).astype("int8").rename("signal")


class RSIStrategy(BaseStrategy):
    """Buy below the oversold threshold and exit above the overbought threshold."""

    def __init__(
        self,
        period: int = 14,
        oversold: float = 30,
        overbought: float = 70,
    ) -> None:
        if period < 1:
            raise ValueError("period must be positive")
        if not 0 <= oversold < overbought <= 100:
            raise ValueError("Thresholds must satisfy 0 <= oversold < overbought <= 100")
        self.period = period
        self.oversold = oversold
        self.overbought = overbought

    def rsi(self, data: pd.DataFrame) -> pd.Series:
        close = _close_prices(data)
        change = close.diff()
        average_gain = change.clip(lower=0).rolling(self.period, min_periods=self.period).mean()
        average_loss = -change.clip(upper=0).rolling(self.period, min_periods=self.period).mean()
        relative_strength = average_gain / average_loss
        values = 100 - (100 / (1 + relative_strength))
        values = values.mask((average_loss == 0) & (average_gain > 0), 100)
        values = values.mask((average_loss == 0) & (average_gain == 0), 50)
        return values.rename("rsi")

    def generate_signals(self, data: pd.DataFrame) -> pd.Series:
        rsi = self.rsi(data)
        signals = pd.Series(0, index=data.index, dtype="int8")
        signals.loc[rsi < self.oversold] = 1
        return signals.rename("signal")


class MACDStrategy(BaseStrategy):
    """Go long when MACD is above its signal line."""

    def __init__(self, fast_period: int = 12, slow_period: int = 26, signal_period: int = 9) -> None:
        if min(fast_period, slow_period, signal_period) < 1:
            raise ValueError("MACD periods must be positive")
        if fast_period >= slow_period:
            raise ValueError("fast_period must be smaller than slow_period")
        self.fast_period = fast_period
        self.slow_period = slow_period
        self.signal_period = signal_period

    def generate_signals(self, data: pd.DataFrame) -> pd.Series:
        close = _close_prices(data)
        fast = close.ewm(span=self.fast_period, adjust=False, min_periods=self.fast_period).mean()
        slow = close.ewm(span=self.slow_period, adjust=False, min_periods=self.slow_period).mean()
        macd = fast - slow
        signal_line = macd.ewm(span=self.signal_period, adjust=False, min_periods=self.signal_period).mean()
        return (macd > signal_line).fillna(False).astype("int8").rename("signal")
