"""Chronological, feature based return forecasts with a held-out error range."""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

from .exceptions import BacktestError


class HistoricalReturnForecaster:
    """Ridge regression over price momentum, trend, volatility and volume features."""

    def forecast(self, data: pd.DataFrame, horizon: int = 5) -> dict[str, float | int | bool]:
        if horizon not in (1, 5, 20):
            raise ValueError("Tahmin ufku 1, 5 veya 20 işlem günü olmalı.")
        if "Close" not in data or len(data) < 180:
            raise BacktestError("Tahmin için en az 180 günlük kapanış verisi gerekli.")

        close = pd.to_numeric(data["Close"], errors="coerce")
        log_return = np.log(close / close.shift(1))
        features = pd.DataFrame(index=data.index)
        features["return_1"] = log_return
        features["return_5"] = np.log(close / close.shift(5))
        features["return_20"] = np.log(close / close.shift(20))
        features["sma_20_gap"] = close / close.rolling(20).mean() - 1
        features["sma_50_gap"] = close / close.rolling(50).mean() - 1
        features["volatility_20"] = log_return.rolling(20).std()
        delta = close.diff()
        gain = delta.clip(lower=0).rolling(14).mean()
        loss = -delta.clip(upper=0).rolling(14).mean()
        relative_strength = gain / loss
        features["rsi_14"] = (100 - 100 / (1 + relative_strength)) / 100
        volume = data["Volume"] if "Volume" in data else pd.Series(0.0, index=data.index)
        features["volume_change"] = pd.to_numeric(volume, errors="coerce").pct_change()
        features = features.replace([np.inf, -np.inf], np.nan)
        target = np.log(close.shift(-horizon) / close)
        training = features.join(target.rename("target")).dropna()

        if len(training) < 120:
            raise BacktestError("Bu hisse ve dönem için tahmin modeli kurulacak yeterli veri yok.")

        values = training.drop(columns="target").to_numpy(dtype=float)
        targets = training["target"].to_numpy(dtype=float)
        split = int(len(training) * 0.8)
        training_end = split - horizon
        if training_end < 80 or len(training) - split < 20:
            raise BacktestError("Modeli kronolojik olarak doğrulamak için daha uzun tarih aralığı seçin.")

        mean = values[:training_end].mean(axis=0)
        scale = values[:training_end].std(axis=0)
        scale[scale < 1e-10] = 1
        standardized = (values - mean) / scale
        weights = self._fit(standardized[:training_end], targets[:training_end])
        validation_prediction = self._predict(standardized[split:], weights)
        residuals = targets[split:] - validation_prediction
        validation_mae = float(np.mean(np.abs(residuals)))
        baseline_mae = float(np.mean(np.abs(targets[split:])))
        directional_accuracy = float(np.mean(np.sign(validation_prediction) == np.sign(targets[split:])))
        error_90 = float(np.quantile(np.abs(residuals), 0.9))

        full_mean = values.mean(axis=0)
        full_scale = values.std(axis=0)
        full_scale[full_scale < 1e-10] = 1
        full_values = (values - full_mean) / full_scale
        full_weights = self._fit(full_values, targets)
        latest = (features.iloc[[-1]].to_numpy(dtype=float) - full_mean) / full_scale
        predicted_log_return = float(self._predict(latest, full_weights)[0])
        if not math.isfinite(predicted_log_return):
            raise BacktestError("Model geçerli bir tahmin üretemedi.")

        last_close = float(close.iloc[-1])
        return {
            "as_of": pd.Timestamp(data.index[-1]).strftime("%Y-%m-%d"),
            "last_close": last_close,
            "predicted_return": float(np.expm1(predicted_log_return)),
            "predicted_close": last_close * math.exp(predicted_log_return),
            "lower_close": last_close * math.exp(predicted_log_return - error_90),
            "upper_close": last_close * math.exp(predicted_log_return + error_90),
            "horizon": horizon,
            "validation_mae_pct": validation_mae * 100,
            "baseline_mae_pct": baseline_mae * 100,
            "directional_accuracy": directional_accuracy,
            "validation_samples": len(residuals),
            "beats_baseline": validation_mae < baseline_mae,
        }

    @staticmethod
    def _fit(features: np.ndarray, targets: np.ndarray) -> np.ndarray:
        design = np.column_stack((np.ones(len(features)), features))
        penalty = np.eye(design.shape[1])
        penalty[0, 0] = 0
        return np.linalg.solve(design.T @ design + penalty, design.T @ targets)

    @staticmethod
    def _predict(features: np.ndarray, weights: np.ndarray) -> np.ndarray:
        return np.column_stack((np.ones(len(features)), features)) @ weights
