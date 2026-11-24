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

    def download_yfinance(
        self,
        ticker: str,
        start: str,
        end: str | None = None,
    ) -> pd.DataFrame:
        """Download daily market data from Yahoo Finance (e.g. THYAO.IS)."""
        try:
            import yfinance as yf
        except ImportError as exc:
            raise BacktestError(
                "Yahoo Finance downloads require the optional 'yfinance' package"
            ) from exc

        try:
            frame = yf.download(
                ticker,
                start=start,
                end=end,
                interval="1d",
                auto_adjust=True,
                progress=False,
            )
        except Exception as exc:
            raise BacktestError(f"Could not download market data for {ticker}") from exc

        if frame.empty:
            raise BacktestError(f"No market data returned for {ticker}")
        if isinstance(frame.columns, pd.MultiIndex):
            frame.columns = frame.columns.get_level_values(0)
        frame.index.name = "Date"
        frame.columns.name = None
        missing = [column for column in self.REQUIRED_COLUMNS if column not in frame]
        if missing:
            raise BacktestError(f"Downloaded data is missing: {', '.join(missing)}")
        return frame.sort_index()

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

