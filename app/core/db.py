"""
SQLite sederhana (modul bawaan Python, tanpa dependensi tambahan).

Menyimpan: akun pengguna, riwayat analisis ragam, dan respons kuesioner.
Dataset mentah yang diunggah TIDAK disimpan di sini (tetap sementara di memori).
"""

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from app.core.config import DATA_DIR

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


@contextmanager
def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
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
