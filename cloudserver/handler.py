"""Hosted API policy and a separately authorized operations dashboard."""

from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
import time
from urllib.parse import urlparse

from vaultserver.server import Handler
from vaultserver.security import ApiError, CHUNK_SIZE, require, valid_id
from vaultserver.store import now, canonical
from . import VERSION
from .store import FILE_LIMIT, TOTAL_QUOTA, USER_QUOTA


class CloudHandler(Handler):
    def log_message(self, *args):
        # Do not log user email query strings or authentication bodies.
        pass

    def current_user(self):
        user = super().current_user()
        require(self.store.settings(user["id"])["enabled"], "Tài khoản tạm dừng. Liên hệ quản trị viên.", 403)
        return user

    def throttle(self, email):
        address = self.headers.get("X-SV-Remote-IP", self.client_address[0])
        with self.server.attempt_lock:
            for key, limit in (("email:" + email, 15), ("ip:" + address, 45)):
                attempts = self.server.auth_attempts.setdefault(key, [])
                attempts[:] = [t for t in attempts if t > time.time() - 300]
                require(len(attempts) < limit, "Thử lại sau ít phút.", 429)
                attempts.append(time.time())
            if len(self.server.auth_attempts) > 10000:
                self.server.auth_attempts = {k: v for k, v in self.server.auth_attempts.items() if v and v[-1] > time.time() - 300}

    def json(self, data, status=200):
        path = urlparse(self.path).path
        if status < 300 and isinstance(data, dict):
            if path in ("/api/register", "/api/login") and "user" in data:
                user_id = data["user"]["id"]
                require(self.store.settings(user_id)["enabled"], "Tài khoản tạm dừng. Liên hệ quản trị viên.", 403)
                self.store.execute("INSERT OR IGNORE INTO accounts VALUES(?,'user',1,?)", (user_id, USER_QUOTA))
                self.store.event(user_id, "account.created" if path.endswith("register") else "account.login", data["user"]["name"])
            if path == "/api/bootstrap" and "user" in data:
                settings = self.store.settings(data["user"]["id"])
                data["account"] = {"role": settings["role"], "quota": settings["quota"], **self.store.usage(data["user"]["id"])}
                data["limits"] = {"maxFileSize": FILE_LIMIT, "chunkSize": CHUNK_SIZE}
                # Friendly product activity rather than the academic implementation log.
                for item in data.get("activity", []):
                    item["message"] = item["message"].replace("Đã mã hóa và lưu ", "Đã tải lên ").replace("Đã chia sẻ offline cho ", "Đã chia sẻ với ").replace("Có tệp offline mới từ ", "Có tệp mới từ ").replace("Đã giải mã phiên live ", "Đã nhận trực tiếp ")
        super().json(data, status)

    def dispatch(self, method):
        path = urlparse(self.path).path
        try:
            self.check_origin()
            if path == "/api/health" and method == "GET":
                self.json({"ok": True, "app": "SecretVault", "version": VERSION, "maxFileSize": FILE_LIMIT,
                           "chunkSize": CHUNK_SIZE, "storage": "persistent-private-bucket", "setupRequired": not self.store.one("SELECT user_id FROM accounts WHERE role='admin'")})
                return
            if path.startswith("/api/admin/"):
                user = self.current_user()
                if path == "/api/admin/claim" and method == "POST":
                    self.claim(user, self.read_json())
                else:
                    require(self.store.settings(user["id"])["role"] == "admin", "Bạn không có quyền quản trị.", 403)
                    if path == "/api/admin/overview" and method == "GET":
                        self.overview()
                    elif path == "/api/admin/user" and method == "POST":
                        self.manage_user(user, self.read_json())
                    else:
                        raise ApiError("Không tìm thấy API", 404)
                return
            if path == "/api/trash" and method == "GET":
                user = self.current_user()
                rows = self.store.all("SELECT * FROM files WHERE owner_id=? AND deleted=1 AND ready=1 ORDER BY created DESC", (user["id"],))
                self.json({"files": [{"id": row["id"], "name": json.loads(row["manifest"])["name"], "size": json.loads(row["manifest"])["size"]} for row in rows]})
                return
            if re.fullmatch(r"/api/files/f_[0-9a-f]{32}/restore", path) and method == "POST":
                user = self.current_user()
                file_id = path.split("/")[3]
                row = self.store.one("SELECT * FROM files WHERE id=? AND owner_id=? AND deleted=1", (file_id, user["id"]))
                require(row is not None, "Không tìm thấy tệp trong thùng rác.", 404)
                self.store.execute("UPDATE files SET deleted=0 WHERE id=?", (file_id,))
                self.store.event(user["id"], "file.restored", file_id)
                self.json({"ok": True})
                return
            if path == "/api/register" and method == "POST":
                require(self.store.one("SELECT COUNT(*) n FROM users")["n"] < 50, "Không gian demo đã đủ 50 tài khoản. Liên hệ quản trị viên.", 403)
            # Hold quota mutations under a single lock, including concurrent uploads.
            with self.store.lock:
                super().dispatch(method)
        except ApiError as error:
            super().json({"error": str(error)}, error.status)
        except (ValueError, TypeError, KeyError):
            super().json({"error": "Dữ liệu yêu cầu không hợp lệ."}, 400)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception:
            import traceback
            traceback.print_exc()
            super().json({"error": "Không thể lưu dữ liệu. Vui lòng thử lại."}, 503)

    def claim(self, user, body):
        self.throttle("admin-claim")
        expected = os.getenv("SV_ADMIN_CLAIM_HASH", "")
        supplied = hashlib.sha256(str(body.get("code", "")).strip().encode()).hexdigest()
        require(len(expected) == 64 and secrets.compare_digest(expected, supplied), "Mã kích hoạt không đúng.", 403)
        with self.store.db() as db:
            require(not db.execute("SELECT user_id FROM accounts WHERE role='admin'").fetchone(), "Quản trị viên đã được kích hoạt.", 409)
            db.execute("INSERT INTO accounts VALUES(?,'admin',1,?) ON CONFLICT(user_id) DO UPDATE SET role='admin'", (user["id"], USER_QUOTA))
        self.store.event(user["id"], "admin.activated", user["name"])
        self.json({"ok": True})

    def manage_user(self, actor, body):
        target = self.store.user(body.get("userId", ""))
        require(target is not None, "Không tìm thấy tài khoản.", 404)
        settings = self.store.settings(target["id"])
        enabled = body.get("enabled", bool(settings["enabled"]))
        quota = body.get("quota", settings["quota"])
        require(type(enabled) is bool and type(quota) is int and 1048576 <= quota <= TOTAL_QUOTA, "Hạn mức không hợp lệ.")
        require(target["id"] != actor["id"] or enabled, "Không thể tự tạm dừng tài khoản quản trị.")
        require(quota >= self.store.usage(target["id"])["allocated"], "Hạn mức mới nhỏ hơn dữ liệu đang lưu.")
        with self.store.db() as db:
            db.execute("INSERT INTO accounts VALUES(?,'user',?,?) ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled,quota=excluded.quota", (target["id"], int(enabled), quota))
            if not enabled:
                db.execute("DELETE FROM sessions WHERE user_id=?", (target["id"],))
        self.store.event(actor["id"], "account.updated", target["name"], "Đang hoạt động" if enabled else "Tạm dừng")
        self.json({"ok": True})

    def overview(self):
        users = []
        for row in self.store.all("SELECT id,name,email,created FROM users ORDER BY created DESC"):
            settings = self.store.settings(row["id"])
            seen = self.store.one("SELECT MAX(last_seen) n FROM sessions WHERE user_id=? AND expires>?", (row["id"], now()))["n"]
            users.append({**dict(row), "role": settings["role"], "enabled": bool(settings["enabled"]), "quota": settings["quota"], **self.store.usage(row["id"]), "online": bool(seen and seen > now() - 20000)})
        files = []
        for row in self.store.all("SELECT f.*,u.name owner,up.expected,up.name upload_name FROM files f JOIN users u ON u.id=f.owner_id LEFT JOIN uploads up ON up.file_id=f.id ORDER BY f.created DESC LIMIT 100"):
            manifest = json.loads(row["manifest"])
            written = self.store.one("SELECT COALESCE(SUM(size),0) n FROM chunks WHERE file_id=?", (row["id"],))["n"]
            files.append({"id": row["id"], "name": manifest.get("name", row["upload_name"] or "Đang tải lên"), "owner": row["owner"], "size": manifest.get("size", max(0, row["expected"] or 0)), "stored": written, "state": "trash" if row["deleted"] else "ready" if row["ready"] else "uploading", "created": row["created"]})
        events = [dict(row) for row in self.store.all("SELECT e.id,e.kind,e.subject,e.detail,e.created,u.name actor FROM events e LEFT JOIN users u ON u.id=e.actor_id ORDER BY e.created DESC LIMIT 60")]
        active = self.store.one("SELECT COUNT(*) n FROM live WHERE expires>? AND state IN ('offered','accepted','sent')", (now(),))["n"]
        self.json({"users": users, "files": files, "events": events, "storage": {**self.store.usage(), "quota": TOTAL_QUOTA}, "summary": {"users": len(users), "online": sum(u["online"] for u in users), "files": sum(f["state"] == "ready" for f in files), "activeTransfers": active, "shares": self.store.one("SELECT COUNT(*) n FROM shares WHERE revoked=0")["n"]}, "service": {"version": VERSION, "persistence": "Private storage bucket", "maxFileSize": FILE_LIMIT, "maxUsers": 50}})

    def begin_file(self, user, body):
        expected = body.get("size", -1)
        name = str(body.get("name", "Đang tải lên"))[:240]
        require(type(expected) is int and -1 <= expected <= FILE_LIMIT, "Mỗi tệp tối đa 25 MiB.", 413)
        needed = max(0, expected) + max(1, (max(0, expected) + CHUNK_SIZE - 1) // CHUNK_SIZE) * 16
        require(self.store.usage(user["id"])["allocated"] + needed <= self.store.settings(user["id"])["quota"], "Dung lượng tài khoản đã đầy.", 413)
        require(self.store.usage()["allocated"] + needed <= TOTAL_QUOTA, "Không gian lưu trữ đang đầy. Liên hệ quản trị viên.", 413)
        file_id = body.get("id", "")
        require(valid_id(file_id) and file_id.startswith("f_"), "File ID không hợp lệ")
        require(not self.store.one("SELECT id FROM files WHERE id=?", (file_id,)), "Tệp đã tồn tại.", 409)
        require(not self.store.one("SELECT file_id FROM uploads WHERE file_id=?", (file_id,)), "Tệp đã tồn tại.", 409)
        require(self.store.one("SELECT COUNT(*) n FROM files WHERE owner_id=? AND deleted=0", (user["id"],))["n"] < 1000, "Đã đạt giới hạn 1.000 tệp.")
        with self.store.db() as db:
            db.execute("INSERT INTO files VALUES(?,?,?,?,?,?,0,0,?)", (file_id, user["id"], "{}", "", "{}", "", now()))
            db.execute("INSERT INTO uploads VALUES(?,?,?,?)", (file_id, name, expected, now()))
        self.json({"id": file_id}, 201)

    def file_chunk(self, user, file_id, index, method):
        if method == "POST":
            require(index < max(1, FILE_LIMIT // CHUNK_SIZE), "Mỗi tệp tối đa 25 MiB.", 413)
            old = self.store.one("SELECT size FROM chunks WHERE file_id=? AND idx=?", (file_id, index))
            length = int(self.headers.get("Content-Length", "0"))
            difference = length - (old["size"] if old else 0)
            for account, quota in ((user["id"], self.store.settings(user["id"])["quota"]), (None, TOTAL_QUOTA)):
                require(self.store.usage(account)["used"] + difference <= quota, "Dung lượng đã đầy.", 413)
            intent = self.store.one("SELECT expected FROM uploads WHERE file_id=?", (file_id,))
            if intent and intent["expected"] >= 0:
                expected = intent["expected"]
                require(index < max(1, (expected + CHUNK_SIZE - 1) // CHUNK_SIZE), "Tệp vượt kích thước đã khai báo.", 413)
        super().file_chunk(user, file_id, index, method)

    def commit_file(self, user, file_id, body):
        self.owner_file(user, file_id)
        require(0 <= body["manifest"]["size"] <= FILE_LIMIT, "Mỗi tệp tối đa 25 MiB.", 413)
        intent = self.store.one("SELECT expected FROM uploads WHERE file_id=?", (file_id,))
        require(not intent or intent["expected"] < 0 or intent["expected"] == body["manifest"]["size"], "Kích thước tải lên không khớp.")
        self._capture_reply = True
        self._pending_reply = None
        try:
            super().commit_file(user, file_id, body)
            self.store.event(user["id"], "file.uploaded", body["manifest"]["name"])
        finally:
            self._capture_reply = False
        if self._pending_reply:
            super().send_bytes(*self._pending_reply)

    def share(self, user, body):
        require(self.store.settings(body["payload"]["recipientId"])["enabled"], "Người nhận đang tạm dừng.", 403)
        super().share(user, body)

    def live_offer(self, user, body):
        offer = body["payload"]
        require(type(offer["size"]) is int and 0 <= offer["size"] <= FILE_LIMIT, "Mỗi tệp tối đa 25 MiB.", 413)
        active = self.store.one("SELECT COUNT(*) n,COALESCE(SUM(json_extract(offer,'$.size')),0) bytes FROM live WHERE expires>? AND state IN ('offered','accepted','sent')", (now(),))
        require(active["n"] < 12 and active["bytes"] + offer["size"] <= 100 * 1048576, "Đang có nhiều phiên gửi. Thử lại sau ít phút.", 429)
        require(self.store.settings(offer["recipientId"])["enabled"], "Người nhận đang tạm dừng.", 403)
        self._capture_reply = True
        self._pending_reply = None
        try:
            super().live_offer(user, body)
            self.store.event(user["id"], "transfer.invited", offer["name"])
        finally:
            self._capture_reply = False
        if self._pending_reply:
            super().send_bytes(*self._pending_reply)

    def live_update(self, user, live_id, action, body):
        # Only audit verified state changes. Capture inherited success before flushing.
        self._pending_reply = None
        self._capture_reply = True
        try:
            super().live_update(user, live_id, action, body)
            if action == "ack":
                self.store.execute("DELETE FROM live_chunks WHERE live_id=?", (live_id,))
            if action != "chunk":
                row = self.store.one("SELECT offer FROM live WHERE id=?", (live_id,))
                self.store.event(user["id"], "transfer." + action, json.loads(row["offer"])["name"])
        finally:
            self._capture_reply = False
        if self._pending_reply:
            super().send_bytes(*self._pending_reply)

    def send_bytes(self, data, content_type="application/octet-stream", status=200):
        if getattr(self, "_capture_reply", False):
            self._pending_reply = (data, content_type, status)
        else:
            super().send_bytes(data, content_type, status)
