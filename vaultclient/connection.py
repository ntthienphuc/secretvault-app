"""Validate public connection kits, verify TLS, and manage current-user trust."""

from __future__ import annotations

import hashlib
import json
import os
import re
import ssl
import subprocess
import urllib.error
import urllib.request
import zipfile
from pathlib import Path
from urllib.parse import urlparse


class ConnectionError(ValueError):
    pass


def default_profile_dir():
    return Path(os.environ.get("LOCALAPPDATA", Path.home() / ".local/share")) / "SecretVault" / "Client"


def _atomic_write(path, data):
    temporary = path.with_name(path.name + ".new")
    temporary.write_bytes(data)
    temporary.replace(path)


def validate_profile(metadata, certificate):
    if not isinstance(metadata, dict) or not isinstance(certificate, bytes) or not 128 <= len(certificate) <= 16384:
        raise ConnectionError("Gói kết nối không hợp lệ.")
    fingerprint = hashlib.sha256(certificate).hexdigest()
    if metadata.get("hostId") != fingerprint or metadata.get("caSha256", "").lower() != fingerprint:
        raise ConnectionError("Chứng chỉ không khớp fingerprint của host.")
    thumbprint = hashlib.sha1(certificate).hexdigest().upper()
    if metadata.get("caThumbprint", "").upper() != thumbprint:
        raise ConnectionError("Chứng chỉ không khớp định danh Windows.")
    urls = metadata.get("urls")
    if not isinstance(urls, list) or not 1 <= len(urls) <= 5:
        raise ConnectionError("Gói kết nối thiếu địa chỉ HTTPS.")
    for url in urls:
        if not isinstance(url, str) or len(url) > 300:
            raise ConnectionError("Địa chỉ host không hợp lệ.")
        parsed = urlparse(url)
        try:
            port = parsed.port
        except ValueError as error:
            raise ConnectionError("Cổng HTTPS không hợp lệ.") from error
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ("", "/") or (port is not None and not 1 <= port <= 65535):
            raise ConnectionError("Chỉ chấp nhận địa chỉ HTTPS gốc của host.")
    if metadata.get("url") not in urls:
        raise ConnectionError("Địa chỉ mặc định không có trong gói kết nối.")
    return {**metadata, "caSha256": fingerprint, "caThumbprint": thumbprint}


def save_profile(root, metadata, certificate):
    metadata = validate_profile(metadata, certificate)
    root = Path(root)
    profile_dir = root / "profiles" / metadata["hostId"]
    profile_dir.mkdir(parents=True, exist_ok=True)
    _atomic_write(profile_dir / "ca.cer", certificate)
    _atomic_write(profile_dir / "ca.pem", ssl.DER_cert_to_PEM_cert(certificate).encode("ascii"))
    _atomic_write(profile_dir / "connection.json", json.dumps(metadata, ensure_ascii=False, indent=2).encode("utf-8"))
    _atomic_write(root / "active.json", json.dumps({"hostId": metadata["hostId"]}).encode("utf-8"))
    return {**metadata, "directory": profile_dir}


def import_kit(root, archive):
    with zipfile.ZipFile(archive) as bundle:
        if len(bundle.infolist()) > 15 or sum(item.file_size for item in bundle.infolist()) > 262144:
            raise ConnectionError("Gói kết nối quá lớn hoặc chứa dữ liệu không mong đợi.")
        metadata_files = [item for item in bundle.infolist() if item.filename.rsplit("/", 1)[-1] == "connection.json"]
        certificate_files = [item for item in bundle.infolist() if item.filename.rsplit("/", 1)[-1] == "SecretVault-LAN-CA.cer"]
        if len(metadata_files) != 1 or len(certificate_files) != 1:
            raise ConnectionError("ZIP phải chứa đúng một cấu hình và một chứng chỉ công khai.")
        if metadata_files[0].file_size > 65536 or certificate_files[0].file_size > 16384:
            raise ConnectionError("Cấu hình hoặc chứng chỉ quá lớn.")
        # Read named entries only; never extract paths or execute scripts from the ZIP.
        metadata = json.loads(bundle.read(metadata_files[0]).decode("utf-8-sig"))
        certificate = bundle.read(certificate_files[0])
    return save_profile(root, metadata, certificate)


def load_profile(root):
    root = Path(root)
    selection = json.loads((root / "active.json").read_text(encoding="utf-8-sig"))
    host_id = selection.get("hostId", "")
    if not re.fullmatch(r"[0-9a-f]{64}", host_id):
        raise ConnectionError("Định danh cấu hình đã lưu không hợp lệ.")
    directory = root / "profiles" / host_id
    metadata = json.loads((directory / "connection.json").read_text(encoding="utf-8-sig"))
    certificate = (directory / "ca.cer").read_bytes()
    metadata = validate_profile(metadata, certificate)
    if metadata["hostId"] != host_id:
        raise ConnectionError("Cấu hình không khớp chứng chỉ đã lưu.")
    # Rebuild public PEM from validated DER, never trust a modified PEM sidecar.
    _atomic_write(directory / "ca.pem", ssl.DER_cert_to_PEM_cert(certificate).encode("ascii"))
    return {**metadata, "directory": directory}


def seed_profile(root, bootstrap):
    if (Path(root) / "active.json").exists():
        return load_profile(root)
    bootstrap = Path(bootstrap)
    metadata = json.loads((bootstrap / "connection.json").read_text(encoding="utf-8-sig"))
    certificate = (bootstrap / "SecretVault-LAN-CA.cer").read_bytes()
    return save_profile(root, metadata, certificate)


def _certutil(arguments, timeout=15):
    executable = Path(os.environ["SystemRoot"]) / "System32/certutil.exe"
    return subprocess.run([str(executable), *arguments], capture_output=True, text=True, errors="replace", timeout=timeout,
                          creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))


def windows_trusted(profile):
    if os.name != "nt":
        return False
    return _certutil(["-user", "-store", "Root", profile["caThumbprint"]]).returncode == 0


def install_trust(profile):
    if os.name != "nt":
        raise ConnectionError("Bản cài này hỗ trợ Windows.")
    if windows_trusted(profile):
        return
    try:
        result = _certutil(["-user", "-addstore", "-f", "Root", str(profile["directory"] / "ca.cer")], timeout=120)
    except subprocess.TimeoutExpired as error:
        raise ConnectionError("Windows chưa nhận xác nhận chứng chỉ. Hãy kết nối lại và xác nhận chứng chỉ của host.") from error
    if result.returncode != 0 or not windows_trusted(profile):
        raise ConnectionError("Chứng chỉ chưa được Windows tin cậy. Bạn có thể thử lại khi sẵn sàng.")


def check_connection(profile):
    context = ssl.create_default_context(cafile=str(profile["directory"] / "ca.pem"))
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    for base in profile["urls"]:
        try:
            with urllib.request.urlopen(base.rstrip("/") + "/api/health", context=context, timeout=3) as response:
                health = json.loads(response.read(16384).decode("utf-8"))
            if health.get("app") == "SecretVault" and health.get("lanHostId") == profile["hostId"] and str(health.get("version", "")).startswith("2."):
                return {"url": base.rstrip("/"), "hostId": profile["hostId"], "serverVersion": health["version"], "tlsVerified": True}
        except (OSError, ValueError, urllib.error.URLError):
            continue
    raise ConnectionError("Chưa kết nối được host. Kiểm tra máy host đang bật, cùng mạng và địa chỉ/gói kết nối mới nhất.")
