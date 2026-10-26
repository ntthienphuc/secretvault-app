"""SecretVault local Python backend.

The server stores ciphertext, public metadata, and encrypted key envelopes in
SQLite. Plaintext file contents and private keys stay in the browser. Live
transfer uses a small polling event relay so the demo works with only Python's
standard library installed.
"""

from __future__ import annotations

import json
import mimetypes
import os
import sqlite3
import threading
import time
import uuid
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"
DB_PATH = ROOT / "secretvault.db"
HOST = "127.0.0.1"
PORT = int(os.environ.get("SECRET_VAULT_PORT", "8765"))
MAX_BODY = 120 * 1024 * 1024
DB_LOCK = threading.RLock()


def now_ms() -> int:
    return int(time.time() * 1000)


def make_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def get_db() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    with DB_LOCK, get_db() as db:
        db.executescript(
            """
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                initials TEXT NOT NULL,
                color TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'online',
                ed_public_jwk TEXT,
                elgamal_public TEXT,
                fingerprint TEXT,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL,
                name TEXT NOT NULL,
                mime TEXT NOT NULL,
                size INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                file_iv TEXT NOT NULL,
                ciphertext TEXT NOT NULL,
                local_key_wrap TEXT NOT NULL,
                cipher_hash TEXT NOT NULL,
                demo INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY(owner_id) REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS shares (
                id TEXT PRIMARY KEY,
                file_id TEXT NOT NULL,
                owner_id TEXT NOT NULL,
                recipient_id TEXT NOT NULL,
                envelope TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY(file_id) REFERENCES files(id)
            );
            CREATE TABLE IF NOT EXISTS activity (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                kind TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS live_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                target_user_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                payload TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
            """
        )
        existing = db.execute("SELECT COUNT(*) AS count FROM users").fetchone()["count"]
        if existing == 0:
            users = [
                ("alice", "Alice Nguyen", "alice@secretvault.local", "AN", "#7c5cff"),
                ("bob", "Bob Tran", "bob@secretvault.local", "BT", "#18b6a4"),
                ("carol", "Carol Pham", "carol@secretvault.local", "CP", "#f29b4b"),
            ]
            created_at = now_ms()
            db.executemany(
                """
                INSERT INTO users (id, name, email, initials, color, status, created_at)
                VALUES (?, ?, ?, ?, ?, 'online', ?)
                """,
                [(user_id, name, email, initials, color, created_at) for user_id, name, email, initials, color in users],
            )


def row_to_user(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "initials": row["initials"],
        "color": row["color"],
        "status": row["status"],
        "edPublicJwk": json.loads(row["ed_public_jwk"]) if row["ed_public_jwk"] else None,
        "elgamalPublic": row["elgamal_public"],
        "fingerprint": row["fingerprint"],
    }


def row_to_file(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "ownerId": row["owner_id"],
        "name": row["name"],
        "mime": row["mime"],
        "size": row["size"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "fileIv": row["file_iv"],
        "ciphertext": row["ciphertext"],
        "localKeyWrap": row["local_key_wrap"],
        "cipherHash": row["cipher_hash"],
        "demo": bool(row["demo"]),
    }


def row_to_share(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "fileId": row["file_id"],
        "ownerId": row["owner_id"],
        "recipientId": row["recipient_id"],
        "envelope": json.loads(row["envelope"]),
        "createdAt": row["created_at"],
    }


def row_to_activity(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "userId": row["user_id"],
        "kind": row["kind"],
        "message": row["message"],
        "createdAt": row["created_at"],
    }


def json_body(handler: BaseHTTPRequestHandler) -> dict:
    raw_length = handler.headers.get("Content-Length", "0")
    try:
        length = int(raw_length)
    except ValueError as error:
        raise ValueError("Invalid content length") from error
    if length > MAX_BODY:
        raise ValueError("Request body is too large")
    raw = handler.rfile.read(length)
    if not raw:
        return {}
    decoded = json.loads(raw.decode("utf-8"))
    if not isinstance(decoded, dict):
        raise ValueError("JSON body must be an object")
    return decoded


class SecretVaultHandler(BaseHTTPRequestHandler):
    server_version = "SecretVaultPython/1.0"

    def log_message(self, format_string: str, *args: object) -> None:
        if self.path.startswith("/api/live/poll"):
            return
        print(f"[{self.log_date_time_string()}] {format_string % args}")

    def send_json(self, payload: object, status: int = HTTPStatus.OK) -> None:
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(encoded)

    def send_error_json(self, message: str, status: int = HTTPStatus.BAD_REQUEST) -> None:
        self.send_json({"error": message}, status)

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            try:
                self.handle_api_get(parsed.path, parse_qs(parsed.query))
            except Exception as error:  # pragma: no cover - last-resort API guard
                print(f"GET {parsed.path} failed: {error}")
                self.send_error_json("Server error", HTTPStatus.INTERNAL_SERVER_ERROR)
            return
        self.serve_static(parsed.path)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            self.send_error_json("Route not found", HTTPStatus.NOT_FOUND)
            return
        try:
            body = json_body(self)
            self.handle_api_post(parsed.path, body)
        except ValueError as error:
            self.send_error_json(str(error), HTTPStatus.BAD_REQUEST)
        except Exception as error:  # pragma: no cover - last-resort API guard
            print(f"POST {parsed.path} failed: {error}")
            self.send_error_json("Server error", HTTPStatus.INTERNAL_SERVER_ERROR)

    def serve_static(self, requested_path: str) -> None:
        relative = requested_path.lstrip("/") or "index.html"
        candidate = (PUBLIC / relative).resolve()
        try:
            candidate.relative_to(PUBLIC.resolve())
        except ValueError:
            self.send_error_json("File not found", HTTPStatus.NOT_FOUND)
            return
        if not candidate.is_file():
            candidate = PUBLIC / "index.html"
        content = candidate.read_bytes()
        content_type, _ = mimetypes.guess_type(candidate.name)
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type or "application/octet-stream")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def handle_api_get(self, path: str, query: dict[str, list[str]]) -> None:
        if path == "/api/health":
            self.send_json({"ok": True, "service": "secretvault-python", "timestamp": now_ms()})
            return
        if path == "/api/bootstrap":
            self.handle_bootstrap(query)
            return
        if path == "/api/live/poll":
            self.handle_live_poll(query)
            return
        self.send_error_json("Route not found", HTTPStatus.NOT_FOUND)

    def handle_api_post(self, path: str, body: dict) -> None:
        if path == "/api/users/keys":
            self.handle_user_keys(body)
            return
        if path == "/api/files":
            self.handle_create_file(body)
            return
        if path == "/api/shares":
            self.handle_create_share(body)
            return
        if path == "/api/activity":
            self.handle_activity(body)
            return
        if path == "/api/live/offer":
            self.handle_live_offer(body)
            return
        if path == "/api/live/accept":
            self.handle_live_accept(body)
            return
        if path == "/api/live/data":
            self.handle_live_data(body)
            return
        if path == "/api/live/complete":
            self.handle_live_complete(body)
            return
        self.send_error_json("Route not found", HTTPStatus.NOT_FOUND)

    def handle_bootstrap(self, query: dict[str, list[str]]) -> None:
        user_id = query.get("user_id", [""])[0]
        with DB_LOCK, get_db() as db:
            users = [row_to_user(row) for row in db.execute("SELECT * FROM users ORDER BY name")]
            files = [row_to_file(row) for row in db.execute("SELECT * FROM files ORDER BY updated_at DESC")]
            shares = [row_to_share(row) for row in db.execute("SELECT * FROM shares ORDER BY created_at DESC")]
            activities = [
                row_to_activity(row)
                for row in db.execute(
                    "SELECT * FROM activity WHERE user_id = ? ORDER BY created_at DESC LIMIT 30", (user_id,)
                )
            ]
        self.send_json({"users": users, "files": files, "shares": shares, "activity": activities})

    def handle_user_keys(self, body: dict) -> None:
        user_id = str(body.get("userId", ""))
        if not user_id:
            raise ValueError("userId is required")
        with DB_LOCK, get_db() as db:
            user = db.execute("SELECT id FROM users WHERE id = ?", (user_id,)).fetchone()
            if user is None:
                self.send_error_json("Unknown user", HTTPStatus.NOT_FOUND)
                return
            ed_jwk = body.get("edPublicJwk")
            elgamal_public = str(body.get("elgamalPublic", ""))
            fingerprint = str(body.get("fingerprint", ""))
            db.execute(
                "UPDATE users SET ed_public_jwk = ?, elgamal_public = ?, fingerprint = ? WHERE id = ?",
                (json.dumps(ed_jwk) if ed_jwk else None, elgamal_public, fingerprint, user_id),
            )
        self.send_json({"ok": True})

    def handle_create_file(self, body: dict) -> None:
        required = ["ownerId", "name", "mime", "size", "fileIv", "ciphertext", "localKeyWrap", "cipherHash"]
        if any(key not in body for key in required):
            raise ValueError("Missing encrypted file fields")
        file_id = make_id("file")
        timestamp = now_ms()
        with DB_LOCK, get_db() as db:
            db.execute(
                """
                INSERT INTO files (id, owner_id, name, mime, size, created_at, updated_at,
                    file_iv, ciphertext, local_key_wrap, cipher_hash, demo)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    file_id,
                    str(body["ownerId"]),
                    str(body["name"]),
                    str(body["mime"] or "application/octet-stream"),
                    int(body["size"]),
                    timestamp,
                    timestamp,
                    str(body["fileIv"]),
                    str(body["ciphertext"]),
                    str(body["localKeyWrap"]),
                    str(body["cipherHash"]),
                    1 if body.get("demo") else 0,
                ),
            )
        self.send_json({"id": file_id, "createdAt": timestamp}, HTTPStatus.CREATED)

    def handle_create_share(self, body: dict) -> None:
        required = ["fileId", "ownerId", "recipientId", "envelope"]
        if any(key not in body for key in required):
            raise ValueError("Missing share fields")
        share_id = make_id("share")
        timestamp = now_ms()
        with DB_LOCK, get_db() as db:
            file_row = db.execute("SELECT owner_id FROM files WHERE id = ?", (body["fileId"],)).fetchone()
            if file_row is None or file_row["owner_id"] != body["ownerId"]:
                self.send_error_json("File ownership could not be verified", HTTPStatus.FORBIDDEN)
                return
            db.execute(
                "INSERT INTO shares (id, file_id, owner_id, recipient_id, envelope, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (
                    share_id,
                    str(body["fileId"]),
                    str(body["ownerId"]),
                    str(body["recipientId"]),
                    json.dumps(body["envelope"]),
                    timestamp,
                ),
            )
        self.send_json({"id": share_id, "createdAt": timestamp}, HTTPStatus.CREATED)

    def handle_activity(self, body: dict) -> None:
        user_id = str(body.get("userId", ""))
        message = str(body.get("message", ""))
        kind = str(body.get("kind", "info"))
        if not user_id or not message:
            raise ValueError("userId and message are required")
        activity_id = make_id("activity")
        timestamp = now_ms()
        with DB_LOCK, get_db() as db:
            db.execute(
                "INSERT INTO activity (id, user_id, kind, message, created_at) VALUES (?, ?, ?, ?, ?)",
                (activity_id, user_id, kind, message, timestamp),
            )
        self.send_json({"id": activity_id, "createdAt": timestamp}, HTTPStatus.CREATED)

    def handle_live_offer(self, body: dict) -> None:
        self.create_live_event("offer", body, body.get("recipientId"))

    def handle_live_accept(self, body: dict) -> None:
        self.create_live_event("accept", body, body.get("senderId"))

    def handle_live_data(self, body: dict) -> None:
        self.create_live_event("data", body, body.get("recipientId"))

    def handle_live_complete(self, body: dict) -> None:
        self.create_live_event("complete", body, body.get("targetUserId"))

    def create_live_event(self, event_type: str, payload: dict, target_user_id: object) -> None:
        if not target_user_id:
            raise ValueError("A target user is required")
        timestamp = now_ms()
        with DB_LOCK, get_db() as db:
            cursor = db.execute(
                "INSERT INTO live_events (target_user_id, event_type, payload, created_at) VALUES (?, ?, ?, ?)",
                (str(target_user_id), event_type, json.dumps(payload), timestamp),
            )
            event_id = cursor.lastrowid
        self.send_json({"ok": True, "eventId": event_id}, HTTPStatus.CREATED)

    def handle_live_poll(self, query: dict[str, list[str]]) -> None:
        user_id = query.get("user_id", [""])[0]
        try:
            cursor = int(query.get("cursor", ["0"])[0])
        except ValueError:
            cursor = 0
        if not user_id:
            self.send_error_json("user_id is required")
            return
        with DB_LOCK, get_db() as db:
            rows = db.execute(
                "SELECT id, event_type, payload, created_at FROM live_events WHERE target_user_id = ? AND id > ? ORDER BY id ASC LIMIT 50",
                (user_id, cursor),
            ).fetchall()
        events = [
            {"id": row["id"], "type": row["event_type"], "payload": json.loads(row["payload"]), "createdAt": row["created_at"]}
            for row in rows
        ]
        next_cursor = events[-1]["id"] if events else cursor
        self.send_json({"events": events, "cursor": next_cursor})


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    init_db()
    server = ThreadingHTTPServer((HOST, PORT), SecretVaultHandler)
    print(f"SecretVault is running at http://{HOST}:{PORT}")
    print(f"Database: {DB_PATH}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping SecretVault")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
