"""Small server-only persistence layer for explicitly saved backtests."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any
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


def list_saved_backtests(limit: int = 10) -> list[dict[str, Any]]:
    with _connect() as connection:
        rows = connection.execute(
            """select id, saved_at, result
               from app_data.backtest_history
               order by saved_at desc, id desc
               limit %s""",
            (limit,),
        ).fetchall()
    return [
        {"id": str(row["id"]), "savedAt": row["saved_at"].isoformat(), "result": row["result"]}
        for row in rows
    ]


def save_backtest(result: dict[str, Any]) -> dict[str, Any]:
    run_id = uuid4()
    with _connect() as connection:
        row = connection.execute(
            """insert into app_data.backtest_history (id, symbol, market, strategy, result)
               values (%s, %s, %s, %s, %s)
               returning id, saved_at, result""",
            (run_id, result["symbol"], result["market"], result["strategy"], Jsonb(result)),
        ).fetchone()
        connection.execute(
            """delete from app_data.backtest_history
               where id not in (
                   select id from app_data.backtest_history
                   order by saved_at desc, id desc
                   limit 10
               )"""
        )
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
