"""Abstract interface for trading strategies."""

from abc import ABC, abstractmethod

import pandas as pd


class BaseStrategy(ABC):
    """Base class for strategies that emit long/flat position signals."""

    @abstractmethod
    def generate_signals(self, data: pd.DataFrame) -> pd.Series:
        """Return a 1 (long) or 0 (flat) signal for each input row."""

