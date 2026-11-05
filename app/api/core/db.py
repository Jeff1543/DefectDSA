"""
SQLite sederhana (modul bawaan Python, tanpa dependensi tambahan).

Mode penyimpanan:
- Lokal (default)      : file SQLite di APP_DB_PATH.
- Cloud (Turso/libSQL) : aktif bila TURSO_DATABASE_URL dan TURSO_AUTH_TOKEN diset.
                         Dipakai di hosting dengan disk sementara (mis. Render Free).

Menyimpan: akun pengguna, riwayat analisis ragam, dan respons kuesioner.
Dataset mentah yang diunggah TIDAK disimpan di sini (tetap sementara di memori).
"""

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from app.api.core.config import DATA_DIR

DB_PATH = Path(os.environ.get("APP_DB_PATH", DATA_DIR / "app.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('admin', 'peneliti')),
    created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analyses (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER REFERENCES users(id) ON DELETE SET NULL,
    method              TEXT NOT NULL,
    filename            TEXT,
    n_rows              INTEGER,
    dependent_vars      TEXT NOT NULL,
    independent_vars    TEXT NOT NULL,
    covariates          TEXT NOT NULL,
    assumptions_met     INTEGER,
    significant_effects INTEGER NOT NULL DEFAULT 0,
    result_json         TEXT NOT NULL,
    created_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questionnaires (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
    respondent     TEXT NOT NULL,
    answers        TEXT NOT NULL,
    scores         TEXT NOT NULL,
    kecamatan      TEXT,
    jenis_kelamin  TEXT,
    overall_mean   REAL NOT NULL,
    overall_label  TEXT NOT NULL,
    edit_key_hash  TEXT,
    created_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analyses_created ON analyses(created_at);
CREATE INDEX IF NOT EXISTS idx_analyses_user ON analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_quest_created ON questionnaires(created_at);
"""


TURSO_URL = os.environ.get("TURSO_DATABASE_URL", "").strip()
TURSO_TOKEN = os.environ.get("TURSO_AUTH_TOKEN", "").strip()
USE_TURSO = bool(TURSO_URL and TURSO_TOKEN)


class Row:
    """Baris hasil query yang bisa diakses lewat nama kolom maupun indeks
    (meniru sqlite3.Row, karena libsql tidak punya row_factory)."""

    __slots__ = ("_cols", "_vals")

    def __init__(self, cols, vals):
        self._cols = cols
        self._vals = tuple(vals)

    def __getitem__(self, key):
        if isinstance(key, str):
            try:
                return self._vals[self._cols.index(key)]
            except ValueError:
                raise IndexError(f"No item with that key: {key}") from None
        return self._vals[key]

    def keys(self):
        return list(self._cols)

    def __iter__(self):
        return iter(self._vals)

    def __len__(self):
        return len(self._vals)


class _Cursor:
    def __init__(self, cur):
        self._cur = cur

    def _cols(self):
        return [d[0] for d in (self._cur.description or [])]

    def fetchone(self):
        r = self._cur.fetchone()
        return None if r is None else Row(self._cols(), r)

    def fetchall(self):
        cols = self._cols()
        return [Row(cols, r) for r in self._cur.fetchall()]

    def __iter__(self):
        return iter(self.fetchall())

    @property
    def lastrowid(self):
        return self._cur.lastrowid

    @property
    def rowcount(self):
        return self._cur.rowcount


class _TursoConnection:
    def __init__(self, conn):
        self._conn = conn

    def execute(self, sql, params=()):
        return _Cursor(self._conn.execute(sql, tuple(params)))

    def executescript(self, script):
        self._conn.executescript(script)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        close = getattr(self._conn, "close", None)
        if close:
            close()


def _open():
    if USE_TURSO:
        import libsql

        conn = _TursoConnection(
            libsql.connect(database=TURSO_URL, auth_token=TURSO_TOKEN)
        )
        try:
            conn.execute("PRAGMA foreign_keys = ON")
        except Exception:
            pass
        return conn

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def connect():
    conn = _open()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with connect() as conn:
        conn.executescript(SCHEMA)
