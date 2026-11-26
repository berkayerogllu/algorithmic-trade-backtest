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

    def plot_series(self, data: pd.DataFrame) -> dict[str, tuple[str, pd.Series]]:
        close = _close_prices(data)
        return {
            f"SMA {self.fast_period}": ("price", close.rolling(self.fast_period, min_periods=self.fast_period).mean()),
            f"SMA {self.slow_period}": ("price", close.rolling(self.slow_period, min_periods=self.slow_period).mean()),
        }


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

    def plot_series(self, data: pd.DataFrame) -> dict[str, tuple[str, pd.Series]]:
        return {"RSI": ("oscillator", self.rsi(data))}

    def generate_signals(self, data: pd.DataFrame) -> pd.Series:
        rsi = self.rsi(data)
        entries = rsi < self.oversold
        exits = rsi > self.overbought
        return entries.where(entries | exits).ffill().eq(True).astype("int8").rename("signal")


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

    def plot_series(self, data: pd.DataFrame) -> dict[str, tuple[str, pd.Series]]:
        close = _close_prices(data)
        fast = close.ewm(span=self.fast_period, adjust=False, min_periods=self.fast_period).mean()
        slow = close.ewm(span=self.slow_period, adjust=False, min_periods=self.slow_period).mean()
        macd = fast - slow
        signal_line = macd.ewm(span=self.signal_period, adjust=False, min_periods=self.signal_period).mean()
        return {"MACD": ("spread", macd), "MACD sinyal": ("spread", signal_line)}


class EMACrossoverStrategy(BaseStrategy):
    """Go long when the fast exponential moving average is above the slow EMA."""

    def __init__(self, fast_period: int = 12, slow_period: int = 26) -> None:
        if fast_period < 1 or slow_period < 1:
            raise ValueError("EMA periods must be positive")
        if fast_period >= slow_period:
            raise ValueError("fast_period must be smaller than slow_period")
        self.fast_period = fast_period
        self.slow_period = slow_period

    def generate_signals(self, data: pd.DataFrame) -> pd.Series:
        close = _close_prices(data)
        fast = close.ewm(span=self.fast_period, adjust=False, min_periods=self.fast_period).mean()
        slow = close.ewm(span=self.slow_period, adjust=False, min_periods=self.slow_period).mean()
        return (fast > slow).fillna(False).astype("int8").rename("signal")

    def plot_series(self, data: pd.DataFrame) -> dict[str, tuple[str, pd.Series]]:
        close = _close_prices(data)
        return {
            f"EMA {self.fast_period}": ("price", close.ewm(span=self.fast_period, adjust=False, min_periods=self.fast_period).mean()),
            f"EMA {self.slow_period}": ("price", close.ewm(span=self.slow_period, adjust=False, min_periods=self.slow_period).mean()),
        }


class BollingerBandsStrategy(BaseStrategy):
    """Enter below the lower band and exit after price recovers above the mean."""

    def __init__(self, period: int = 20, deviations: int = 2) -> None:
        if period < 2 or deviations < 1:
            raise ValueError("Bollinger period must be at least 2 and deviations positive")
        self.period = period
        self.deviations = deviations

    def generate_signals(self, data: pd.DataFrame) -> pd.Series:
        close = _close_prices(data)
        middle = close.rolling(self.period, min_periods=self.period).mean()
        deviation = close.rolling(self.period, min_periods=self.period).std(ddof=0)
        lower = middle - self.deviations * deviation
        entries = close < lower
        exits = close > middle
        state = entries.astype("boolean").where(entries | exits).ffill().fillna(False)
        return state.astype("int8").rename("signal")

    def plot_series(self, data: pd.DataFrame) -> dict[str, tuple[str, pd.Series]]:
        close = _close_prices(data)
        middle = close.rolling(self.period, min_periods=self.period).mean()
        deviation = close.rolling(self.period, min_periods=self.period).std(ddof=0)
        return {
            "Bollinger üst": ("price", middle + self.deviations * deviation),
            "Bollinger orta": ("price", middle),
            "Bollinger alt": ("price", middle - self.deviations * deviation),
        }


class StochasticOscillatorStrategy(BaseStrategy):
    """Trade oversold/overbought stochastic K/D crossovers."""

    def __init__(
        self,
        k_period: int = 14,
        d_period: int = 3,
        oversold: int = 20,
        overbought: int = 80,
    ) -> None:
        if min(k_period, d_period) < 1:
            raise ValueError("Stochastic periods must be positive")
        if not 0 <= oversold < overbought <= 100:
            raise ValueError("Thresholds must satisfy 0 <= oversold < overbought <= 100")
        self.k_period = k_period
        self.d_period = d_period
        self.oversold = oversold
        self.overbought = overbought

    def generate_signals(self, data: pd.DataFrame) -> pd.Series:
        required = {"High", "Low", "Close"}
        if not required.issubset(data.columns):
            raise ValueError("Stochastic Oscillator requires High, Low, and Close prices")
        close = pd.to_numeric(data["Close"], errors="raise")
        lowest = pd.to_numeric(data["Low"], errors="raise").rolling(self.k_period, min_periods=self.k_period).min()
        highest = pd.to_numeric(data["High"], errors="raise").rolling(self.k_period, min_periods=self.k_period).max()
        k_line = 100 * (close - lowest) / (highest - lowest).replace(0, float("nan"))
        d_line = k_line.rolling(self.d_period, min_periods=self.d_period).mean()
        entry = (k_line.shift(1) <= d_line.shift(1)) & (k_line > d_line) & (k_line < self.oversold)
        exit_signal = (k_line.shift(1) >= d_line.shift(1)) & (k_line < d_line) & (k_line > self.overbought)
        state = entry.astype("boolean").where(entry | exit_signal).ffill().fillna(False)
        return state.astype("int8").rename("signal")

    def plot_series(self, data: pd.DataFrame) -> dict[str, tuple[str, pd.Series]]:
        close = _close_prices(data)
        lowest = pd.to_numeric(data["Low"], errors="raise").rolling(self.k_period, min_periods=self.k_period).min()
        highest = pd.to_numeric(data["High"], errors="raise").rolling(self.k_period, min_periods=self.k_period).max()
        k_line = 100 * (close - lowest) / (highest - lowest).replace(0, float("nan"))
        d_line = k_line.rolling(self.d_period, min_periods=self.d_period).mean()
        return {"Stochastic %K": ("oscillator", k_line), "Stochastic %D": ("oscillator", d_line)}


class DonchianChannelStrategy(BaseStrategy):
    """Enter breakouts above the prior channel and exit below its lower edge."""

    def __init__(self, period: int = 20) -> None:
        if period < 2:
            raise ValueError("Donchian period must be at least 2")
        self.period = period

    def generate_signals(self, data: pd.DataFrame) -> pd.Series:
        if "High" not in data.columns or "Low" not in data.columns:
            raise ValueError("Donchian Channel requires High and Low prices")
        close = _close_prices(data)
        upper = pd.to_numeric(data["High"], errors="raise").rolling(self.period, min_periods=self.period).max().shift(1)
        lower = pd.to_numeric(data["Low"], errors="raise").rolling(self.period, min_periods=self.period).min().shift(1)
        entries = close > upper
        exits = close < lower
        state = entries.astype("boolean").where(entries | exits).ffill().fillna(False)
        return state.astype("int8").rename("signal")

    def plot_series(self, data: pd.DataFrame) -> dict[str, tuple[str, pd.Series]]:
        upper = pd.to_numeric(data["High"], errors="raise").rolling(self.period, min_periods=self.period).max().shift(1)
        lower = pd.to_numeric(data["Low"], errors="raise").rolling(self.period, min_periods=self.period).min().shift(1)
        return {"Donchian üst": ("price", upper), "Donchian alt": ("price", lower)}
