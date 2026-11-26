"""Small server-only persistence layer for explicitly saved backtests."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Optional
from uuid import UUID, uuid4

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env", override=False)


def _connect() -> psycopg.Connection:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured.")
    return psycopg.connect(
        database_url,
        connect_timeout=8,
        application_name="piyasa-lab",
        row_factory=dict_row,
    )


def check_connection() -> bool:
    with _connect() as connection:
        connection.execute("select 1")
    return True


def search_stock_universe(market: str, query: str = "", limit: int = 12) -> list[dict[str, str]]:
    """Search the unified, server-side BIST and US exchange catalog."""
    needle = query.strip()
    pattern = f"%{needle}%"
    with _connect() as connection:
        rows = connection.execute(
            """select symbol, company_name, exchange, market
               from app_data.stock_universe
               where market = %s
                 and (%s = '' or symbol ilike %s
                      or translate(lower(company_name), 'çğıöşü', 'cgiosu') ilike translate(lower(%s), 'çğıöşü', 'cgiosu')
                      or exchange ilike %s)
               order by
                 case when upper(symbol) = upper(%s) then 0
                      when upper(symbol) like upper(%s) then 1
                      when translate(lower(company_name), 'çğıöşü', 'cgiosu') like translate(lower(%s), 'çğıöşü', 'cgiosu') then 2
                      else 3 end,
                 sort_order asc,
                 company_name asc
               limit %s""",
            (market, needle, pattern, pattern, pattern, needle, f"{needle}%", f"{needle}%", limit),
        ).fetchall()
    return [
        {"symbol": row["symbol"], "name": row["company_name"], "exchange": row["exchange"], "market": row["market"]}
        for row in rows
    ]


def upsert_stock_universe(symbols: list[dict[str, str]]) -> None:
    """Cache valid provider discoveries in the same catalog used by search."""
    if not symbols:
        return
    with _connect() as connection:
        connection.cursor().executemany(
            """insert into app_data.stock_universe (market, symbol, company_name, exchange, source)
               values (%(market)s, %(symbol)s, %(name)s, %(exchange)s, 'yahoo_finance')
               on conflict (market, symbol) do update
               set company_name = excluded.company_name,
                   exchange = excluded.exchange,
                   source = excluded.source,
                   updated_at = now()""",
            symbols,
        )


def list_saved_backtests() -> list[dict[str, Any]]:
    with _connect() as connection:
        rows = connection.execute(
            """select id, saved_at, symbol, market, strategy,
                      result->>'period' as period,
                      result->>'interval' as interval,
                      result->'metrics' as metrics
               from app_data.backtest_history
               order by saved_at desc, id desc""",
        ).fetchall()
    return [
        {
            "id": str(row["id"]),
            "savedAt": row["saved_at"].isoformat(),
            "symbol": row["symbol"],
            "market": row["market"],
            "strategy": row["strategy"],
            "period": row["period"],
            "interval": row["interval"],
            "metrics": row["metrics"],
        }
        for row in rows
    ]


def get_saved_backtest(run_id: UUID) -> Optional[dict[str, Any]]:
    with _connect() as connection:
        row = connection.execute(
            """select id, saved_at, result
               from app_data.backtest_history
               where id = %s""",
            (run_id,),
        ).fetchone()
    if row is None:
        return None
    return {"id": str(row["id"]), "savedAt": row["saved_at"].isoformat(), "result": row["result"]}


def save_backtest(result: dict[str, Any]) -> dict[str, Any]:
    run_id = uuid4()
    with _connect() as connection:
        row = connection.execute(
            """insert into app_data.backtest_history (id, symbol, market, strategy, result)
               values (%s, %s, %s, %s, %s)
               returning id, saved_at, result""",
            (run_id, result["symbol"], result["market"], result["strategy"], Jsonb(result)),
        ).fetchone()
    return {"id": str(row["id"]), "savedAt": row["saved_at"].isoformat(), "result": row["result"]}


def delete_saved_backtest(run_id: UUID) -> bool:
    with _connect() as connection:
        cursor = connection.execute(
            "delete from app_data.backtest_history where id = %s",
            (run_id,),
        )
    return cursor.rowcount > 0


def clear_saved_backtests() -> None:
    with _connect() as connection:
        connection.execute("delete from app_data.backtest_history")
