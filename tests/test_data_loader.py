import pandas as pd
import pytest

from algorithmic_backtest.data_loader import DataLoader
from algorithmic_backtest.exceptions import BacktestError


def sample_data(rows=10):
    return pd.DataFrame(
        {
            "Date": pd.date_range("2024-01-01", periods=rows),
            "Open": range(rows),
            "High": range(1, rows + 1),
            "Low": range(rows),
            "Close": range(1, rows + 1),
            "Volume": [100] * rows,
        }
    )


def test_load_csv_sorts_dates_and_sets_index(tmp_path):
    path = tmp_path / "prices.csv"
    sample_data().iloc[::-1].to_csv(path, index=False)

    result = DataLoader().load_csv(path)

    assert isinstance(result.index, pd.DatetimeIndex)
    assert result.index.is_monotonic_increasing
    assert list(result.columns) == ["Open", "High", "Low", "Close", "Volume"]


def test_split_is_chronological_and_keeps_all_rows():
    data = sample_data().set_index("Date")

    optimization, validation, test = DataLoader().split(data)

    assert [len(part) for part in (optimization, validation, test)] == [6, 2, 2]
    assert optimization.index[-1] < validation.index[0] < test.index[0]


def test_load_csv_rejects_missing_columns(tmp_path):
    path = tmp_path / "invalid.csv"
    sample_data().drop(columns="Close").to_csv(path, index=False)

    with pytest.raises(BacktestError, match="Close"):
        DataLoader().load_csv(path)

