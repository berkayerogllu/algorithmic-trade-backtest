"""Historical market data loading and chronological splitting."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from .exceptions import BacktestError


class DataLoader:
    """Load OHLCV data and prepare chronological data partitions."""

    REQUIRED_COLUMNS = ("Open", "High", "Low", "Close", "Volume")

    def load_csv(self, path: str | Path) -> pd.DataFrame:
        """Load a CSV file, normalize its index, and validate OHLCV columns."""
        csv_path = Path(path)
        if not csv_path.exists():
            raise BacktestError(f"Data file does not exist: {csv_path}")

        try:
            frame = pd.read_csv(csv_path, parse_dates=["Date"])
        except (ValueError, pd.errors.ParserError) as exc:
            raise BacktestError("CSV must contain a valid Date column") from exc

        missing = [column for column in self.REQUIRED_COLUMNS if column not in frame]
        if missing:
            raise BacktestError(f"Missing required columns: {', '.join(missing)}")

        frame = frame.set_index("Date").sort_index()
        if frame.index.has_duplicates:
            raise BacktestError("Date index must not contain duplicate values")
        if frame.empty:
            raise BacktestError("Market data cannot be empty")
        return frame

    def split(
        self,
        data: pd.DataFrame,
        optimization_ratio: float = 0.6,
        validation_ratio: float = 0.2,
    ) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """Split data chronologically into optimization, validation, and test sets."""
        if not 0 < optimization_ratio < 1:
            raise ValueError("optimization_ratio must be between 0 and 1")
        if not 0 <= validation_ratio < 1:
            raise ValueError("validation_ratio must be between 0 and 1")
        if optimization_ratio + validation_ratio >= 1:
            raise ValueError("optimization and validation ratios must leave test data")
        if data.empty:
            raise BacktestError("Cannot split empty market data")

        optimization_end = int(len(data) * optimization_ratio)
        validation_end = optimization_end + int(len(data) * validation_ratio)
        if optimization_end == 0 or validation_end == optimization_end:
            raise BacktestError("Data set is too small for the requested split")

        return (
            data.iloc[:optimization_end].copy(),
            data.iloc[optimization_end:validation_end].copy(),
            data.iloc[validation_end:].copy(),
        )

