from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional


def default_history_path() -> Path:
    return Path.home() / ".langchain_widget" / "history.sqlite"


def _ensure_parent_dir(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


@dataclass(frozen=True)
class HistoryItem:
    id: str
    title: str
    created_at: str
    updated_at: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


class HistoryStore:
    def __init__(self, path: Optional[Path] = None) -> None:
        self.path = Path(path) if path is not None else default_history_path()
        _ensure_parent_dir(self.path)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.path))
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    messages_json TEXT NOT NULL
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_updated_at ON conversations(updated_at)"
            )

    def list(self, *, limit: int = 50) -> List[HistoryItem]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT id, title, created_at, updated_at
                FROM conversations
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                (int(limit),),
            ).fetchall()
        return [HistoryItem(**dict(r)) for r in rows]

    def upsert(
        self,
        *,
        id: str,
        title: str,
        created_at: str,
        updated_at: str,
        messages: List[Dict[str, Any]],
    ):
        payload = json.dumps(messages, ensure_ascii=False, separators=(",", ":"))
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO conversations (id, title, created_at, updated_at, messages_json)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title=excluded.title,
                    updated_at=excluded.updated_at,
                    messages_json=excluded.messages_json
                """,
                (id, title, created_at, updated_at, payload),
            )

    def load_messages(self, *, id: str) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT messages_json FROM conversations WHERE id = ?",
                (id,),
            ).fetchone()
        if row is None:
            raise KeyError(f"Conversation not found: {id}")
        data = json.loads(row["messages_json"])
        if not isinstance(data, list):
            raise ValueError("Invalid messages payload in history store.")
        return data

    def delete(self, *, id: str) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM conversations WHERE id = ?", (id,))

    def clear(self) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM conversations")
