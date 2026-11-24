"""Buy-and-hold benchmark strategy."""

import pandas as pd

from .base import BaseStrategy


class BuyAndHoldStrategy(BaseStrategy):
    """Buy at the first available bar and remain invested."""

    def generate_signals(self, data: pd.DataFrame) -> pd.Series:
        if data.empty:
            return pd.Series(index=data.index, dtype="int8", name="signal")
        return pd.Series(1, index=data.index, dtype="int8", name="signal")

