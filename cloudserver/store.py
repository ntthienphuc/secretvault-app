"""Local transactional database with immutable snapshots on a private HF bucket.

SQLite WAL is deliberately kept on a local disk, never on the object-store mount.
Only ciphertext and checksum-verified metadata snapshots reach persistent storage.
Sessions and ephemeral live-transfer secrets/payloads do not survive a restart.
"""

from __future__ import annotations

import hashlib
import json
import re
import secrets
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path

from vaultserver.store import Store, canonical, now, uid

TABLES = ("users", "contacts", "files", "chunks", "shares", "activity", "accounts", "uploads", "events")
USER_QUOTA = 100 * 1024 * 1024
TOTAL_QUOTA = 512 * 1024 * 1024
FILE_LIMIT = 25 * 1024 * 1024


class CloudStore(Store):
    def __init__(self, runtime: Path, persistent: Path):
        self.durable = False
        self.last_snapshot = 0
        self.persistent = persistent.resolve()
        self.persistent.mkdir(parents=True, exist_ok=True)
        self.snapshots = self.persistent / "metadata"
        self.snapshots.mkdir(exist_ok=True)
        super().__init__(runtime)
        self.blobs = self.persistent / "ciphertext"
        self.blobs.mkdir(exist_ok=True)
        with self.db() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS accounts (
                    user_id TEXT PRIMARY KEY, role TEXT NOT NULL DEFAULT 'user',
                    enabled INTEGER NOT NULL DEFAULT 1, quota INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS uploads (
                    file_id TEXT PRIMARY KEY, name TEXT NOT NULL, expected INTEGER NOT NULL,
                    updated INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS events (
                    id TEXT PRIMARY KEY, actor_id TEXT, kind TEXT NOT NULL,
                    subject TEXT NOT NULL, detail TEXT NOT NULL, created INTEGER NOT NULL
                );
            """)
        self.restore()
        self.durable = True
        # Verify the mount is writable before accepting accounts or files.
        with self.db() as db:
            self.snapshot(db)
        self.trim_snapshots()

    @contextmanager
    def db(self):
        with self.lock:
            connection = sqlite3.connect(self.database, timeout=30)
            connection.row_factory = sqlite3.Row
            connection.execute("PRAGMA foreign_keys=ON")
            dirty = set()

            def trace(sql):
                # Track table names only; never retain expanded SQL or credentials.
                match = re.match(r"\s*(?:INSERT\s+(?:OR\s+\w+\s+)?INTO|UPDATE(?:\s+OR\s+\w+)?|DELETE\s+FROM)\s+[\"`\[]?(\w+)", sql, re.I)
                if match and match[1].lower() in TABLES:
                    dirty.add(match[1].lower())

            connection.set_trace_callback(trace)
            snapshot = None
            try:
                yield connection
                if self.durable and dirty:
                    # Persist the exact pending transaction before reporting success.
                    snapshot = self.snapshot(connection)
                connection.commit()
            except Exception:
                connection.rollback()
                if snapshot:
                    snapshot.unlink(missing_ok=True)
                raise
            finally:
                connection.close()
            if snapshot:
                self.trim_snapshots()

    def snapshot(self, db):
        payload = {"version": 1, "created": now(), "tables": {
            table: [dict(row) for row in db.execute('SELECT * FROM "' + table + '"')]
            for table in TABLES
        }}
        raw = canonical(payload)
        checksum = hashlib.sha256(raw).hexdigest()
        # Windows clocks may return the same nanosecond value for consecutive
        # transactions. A monotonic sequence prevents random ordering on recovery.
        sequence = max(time.time_ns(), self.last_snapshot + 1)
        self.last_snapshot = sequence
        target = self.snapshots / (f"state-{sequence:020d}-{secrets.token_hex(6)}-{checksum}.json")
        with target.open("xb") as file:
            file.write(raw)
            file.flush()
        if hashlib.sha256(target.read_bytes()).hexdigest() != checksum:
            raise OSError("Persistent snapshot checksum mismatch")
        return target

    def restore(self):
        candidates = sorted(self.snapshots.glob("state-*.json"), reverse=True)
        if candidates:
            self.last_snapshot = max(int(p.name.split("-")[1]) for p in candidates)
        if not candidates:
            return
        for candidate in candidates:
            try:
                raw = candidate.read_bytes()
                expected = candidate.stem.rsplit("-", 1)[1]
                if hashlib.sha256(raw).hexdigest() != expected:
                    continue
                payload = json.loads(raw)
                if payload.get("version") != 1 or set(payload["tables"]) != set(TABLES):
                    continue
                with self.db() as db:
                    db.execute("DELETE FROM sessions")
                    db.execute("DELETE FROM live_chunks")
                    db.execute("DELETE FROM live")
                    for table in reversed(TABLES):
                        db.execute('DELETE FROM "' + table + '"')
                    for table in TABLES:
                        for row in payload["tables"][table]:
                            columns = list(row)
                            db.execute('INSERT INTO "' + table + '" (' + ",".join('"' + c + '"' for c in columns) + ') VALUES (' + ",".join("?" for _ in columns) + ")", tuple(row.values()))
                return
            except (OSError, ValueError, KeyError, sqlite3.Error):
                continue
        raise RuntimeError("No valid persistent metadata snapshot; refusing an empty vault")

    def trim_snapshots(self):
        # Internal snapshot retention. User files are never removed here.
        for obsolete in sorted(self.snapshots.glob("state-*.json"), reverse=True)[3:]:
            try:
                obsolete.unlink()
            except OSError:
                pass

    def settings(self, user_id):
        row = self.one("SELECT * FROM accounts WHERE user_id=?", (user_id,))
        return dict(row) if row else {"user_id": user_id, "role": "user", "enabled": 1, "quota": USER_QUOTA}

    def public_user(self, row):
        result = super().public_user(row)
        result["role"] = self.settings(row["id"])["role"]
        return result

    def usage(self, user_id=None):
        clause = " WHERE f.owner_id=?" if user_id else ""
        parameters = (user_id,) if user_id else ()
        actual = self.one("SELECT COALESCE(SUM(c.size),0) n FROM chunks c JOIN files f ON f.id=c.file_id" + clause, parameters)["n"]
        # Reserve the declared remaining upload size to prevent concurrent oversubscription.
        pending = self.all("SELECT f.id, u.expected FROM files f JOIN uploads u ON u.file_id=f.id WHERE f.ready=0 AND f.deleted=0" + (" AND f.owner_id=?" if user_id else ""), parameters)
        reserved = 0
        for upload in pending:
            written = self.one("SELECT COALESCE(SUM(size),0) n FROM chunks WHERE file_id=?", (upload["id"],))["n"]
            expected = upload["expected"]
            if expected >= 0:
                encrypted_size = expected + max(1, (expected + 1048575) // 1048576) * 16
                reserved += max(0, encrypted_size - written)
        return {"used": actual, "reserved": reserved, "allocated": actual + reserved}

    def event(self, actor, kind, subject="", detail=""):
        with self.db() as db:
            db.execute("INSERT INTO events VALUES(?,?,?,?,?,?)", (uid("e"), actor, kind, str(subject)[:240], str(detail)[:300], now()))
            db.execute("DELETE FROM events WHERE id IN (SELECT id FROM events ORDER BY created DESC LIMIT -1 OFFSET 500)")
            db.execute("DELETE FROM activity WHERE id IN (SELECT id FROM activity ORDER BY created DESC LIMIT -1 OFFSET 500)")
