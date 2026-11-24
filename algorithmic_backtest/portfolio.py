"""Cash, position, and trade accounting for backtests."""

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class Trade:
    entry_date: object
    exit_date: object
    quantity: float
    entry_price: float
    exit_price: float
    pnl: float


class Portfolio:
    """A single-asset portfolio that invests available cash when entering long."""

    def __init__(self, initial_cash: float, commission_rate: float = 0.0) -> None:
        if initial_cash <= 0:
            raise ValueError("initial_cash must be positive")
        if not 0 <= commission_rate < 1:
            raise ValueError("commission_rate must be in [0, 1)")
        self.initial_cash = float(initial_cash)
        self.cash = float(initial_cash)
        self.commission_rate = float(commission_rate)
        self.quantity = 0.0
        self.entry_price: Optional[float] = None
        self.entry_date = None
        self.entry_cost = 0.0
        self.trades = []

    def buy(self, price: float, date: object) -> None:
        if self.quantity > 0:
            return
        if price <= 0:
            raise ValueError("price must be positive")
        quantity = self.cash / (price * (1 + self.commission_rate))
        self.entry_cost = quantity * price * (1 + self.commission_rate)
        self.cash -= self.entry_cost
        self.quantity = quantity
        self.entry_price = price
        self.entry_date = date

    def sell(self, price: float, date: object) -> None:
        if self.quantity == 0:
            return
        if price <= 0:
            raise ValueError("price must be positive")
        proceeds = self.quantity * price * (1 - self.commission_rate)
        pnl = proceeds - self.entry_cost
        self.cash += proceeds
        self.trades.append(
            Trade(
                entry_date=self.entry_date,
                exit_date=date,
                quantity=self.quantity,
                entry_price=self.entry_price,
                exit_price=price,
                pnl=pnl,
            )
        )
        self.quantity = 0.0
        self.entry_price = None
        self.entry_date = None
        self.entry_cost = 0.0

    def value(self, price: float) -> float:
        return self.cash + self.quantity * price
