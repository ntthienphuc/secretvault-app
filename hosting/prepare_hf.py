"""Create a source-only HF upload bundle without local data or credentials."""
import hashlib
import json
import zipfile
from pathlib import Path

root=Path(__file__).resolve().parents[1]
output=root/'hosting'/'hf-upload'
output.mkdir(exist_ok=True)
sources=[root/'vaultserver'/n for n in ('__init__.py','security.py','server.py','store.py')]
sources+=sorted((root/'cloudserver').glob('*.py'))
with zipfile.ZipFile(output/'server.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for source in sources:
        archive.write(source,source.relative_to(root).as_posix())
(output/'app.py').write_text('''"""SecretVault public API, hosted with the supported Gradio SDK."""
import os
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).with_name("server.zip")))
from cloudserver.main import create_app
import uvicorn
app=create_app()
if __name__ == "__main__":
    uvicorn.run(app,host="0.0.0.0",port=7860)
''',encoding='utf8')
(output/'requirements.txt').write_text((root/'hosting'/'cloud-requirements.txt').read_text(encoding='utf8'),encoding='utf8')
(output/'README.md').write_text('''---
title: SecretVault API
emoji: 🔐
colorFrom: purple
colorTo: blue
sdk: gradio
sdk_version: 6.30.0
python_version: '3.12'
app_file: app.py
pinned: false
short_description: Secure file sharing API and admin for SecretVault
---

Python API for the SecretVault web and Windows clients. The Gradio page is a service status page.

Application requests use `/api/*` with per-session bearer authentication. The administrator dashboard uses the web client and an administrator account; it is not a public monitoring endpoint.

The private Storage Bucket mounted at `/data` stores ciphertext and immutable, verified metadata snapshots. SQLite runs locally, outside the bucket. No database, user account, local LAN certificate or deployment credential is included in this repository. `/data` is explicitly blocked from Gradio file serving.

This is an academic demonstration, not an independently audited commercial security product. Limits: 25 MiB/file, 100 MiB/account by default, 512 MiB total, 50 accounts, one service replica. Free hardware may sleep; live transfers expire and must be restarted after a service restart. Account and stored-file metadata persist in the private bucket.

Required configuration: `SV_ALLOWED_ORIGINS` (exact web origin), `SV_FRONTEND_URL` (web URL), secret `SV_ADMIN_CLAIM_HASH` (SHA-256 of a separately delivered one-time owner activation code).
''',encoding='utf8')
manifest={f.name:{'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in output.iterdir() if f.is_file()}
(root/'audit'/'cloud-hf-bundle.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
print(json.dumps(manifest,indent=2))
