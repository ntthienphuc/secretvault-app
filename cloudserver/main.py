"""FastAPI ingress with exact-origin CORS; supported Gradio SDK hosting on HF."""

from __future__ import annotations

import os
import tempfile
import threading
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from vaultserver.server import VaultHTTPServer
from .handler import CloudHandler
from .store import CloudStore


def create_app(*, with_gradio=True):
    on_hf = bool(os.getenv("SPACE_ID"))
    persistent = Path(os.getenv("SV_PERSISTENT_DIR", "/data/secretvault" if on_hf else "audit/runtime-cloud/persistent"))
    if on_hf and not Path("/data").is_dir():
        raise RuntimeError("Attach the private storage bucket at /data before starting SecretVault")
    runtime = Path(os.getenv("SV_RUNTIME_DIR", str(Path(tempfile.gettempdir()) / "secretvault-cloud")))
    store = CloudStore(runtime, persistent)
    web = Path(os.getenv("SV_WEB_DIR", "web"))
    server = VaultHTTPServer(("127.0.0.1", 0), store, web, behind_proxy=True)
    server.RequestHandlerClass = CloudHandler
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = f"http://127.0.0.1:{server.server_port}"
    allowed = [o.strip().rstrip("/") for o in os.getenv("SV_ALLOWED_ORIGINS", "http://127.0.0.1:8787,http://localhost:8787").split(",") if o.strip()]
    host = os.getenv("SPACE_HOST")
    if host:
        allowed.append("https://" + host)

    @asynccontextmanager
    async def lifespan(app):
        async with httpx.AsyncClient(timeout=90, limits=httpx.Limits(max_connections=20)) as client:
            app.state.http = client
            yield
        server.shutdown()
        server.server_close()

    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
    app.state.store = store
    app.add_middleware(CORSMiddleware, allow_origins=allowed, allow_methods=["GET", "POST", "DELETE"], allow_headers=["Authorization", "Content-Type"], allow_credentials=False, max_age=600)

    @app.middleware("http")
    async def ingress(request: Request, call_next):
        if not request.url.path.startswith("/api/") and request.method not in ("GET", "HEAD"):
            # The status page is read-only. Do not expose Gradio uploads or queues.
            return JSONResponse({"error": "Method not allowed"}, status_code=405)
        if request.url.path.startswith("/api/"):
            source = request.headers.get("origin")
            if source and source not in allowed:
                return JSONResponse({"error": "Origin bị từ chối"}, status_code=403)
            # Large files travel as 1 MiB chunks directly to HF, never through Vercel Functions.
            try:
                size = int(request.headers.get("content-length", "0"))
            except ValueError:
                size = 99999999
            if size > 2 * 1048576:
                return JSONResponse({"error": "Request vượt giới hạn"}, status_code=413)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

    @app.api_route("/api/{path:path}", methods=["GET", "POST", "DELETE"])
    async def api_proxy(request: Request, path: str):
        content = bytearray()
        async for part in request.stream():
            content.extend(part)
            if len(content) > 2 * 1048576:
                return JSONResponse({"error": "Request vượt giới hạn"}, status_code=413)
        headers = {"X-Forwarded-Proto": "https", "X-SV-Remote-IP": request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown").split(",")[-1].strip()}
        for name in ("Authorization", "Content-Type"):
            if request.headers.get(name):
                headers[name] = request.headers[name]
        try:
            result = await request.app.state.http.request(request.method, origin + request.url.path + ("?" + request.url.query if request.url.query else ""), headers=headers, content=bytes(content))
        except httpx.HTTPError:
            return JSONResponse({"error": "Máy chủ đang khởi động. Thử lại sau ít phút."}, status_code=503)
        return Response(result.content, status_code=result.status_code, media_type=result.headers.get("content-type"), headers={"Cache-Control": "no-store", "X-Frame-Options": "DENY"})

    if with_gradio:
        import gradio as gr
        frontend = os.getenv("SV_FRONTEND_URL", "https://vercel.com")
        with gr.Blocks(title="SecretVault API", analytics_enabled=False) as status:
            gr.Markdown("# SecretVault\nSecure file sharing service\n\nThe application and administrator dashboard are available on the SecretVault web client.")
            gr.Markdown("[Open SecretVault](" + frontend + ")\n\nService health: `/api/health`. No files or account information are available on this page.")
        app = gr.mount_gradio_app(app, status, path="/", blocked_paths=[str(persistent.resolve()), str(runtime.resolve()), "/data"], allowed_paths=[], ssr_mode=False, footer_links=[], run_history=False, enable_monitoring=False, mcp_server=False, max_file_size=1)
    else:
        from fastapi.staticfiles import StaticFiles
        from fastapi.responses import FileResponse
        @app.get("/admin")
        @app.get("/setup")
        async def spa():
            return FileResponse(web / "index.html")
        app.mount("/", StaticFiles(directory=str(web), html=True), name="web")
    return app


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(create_app(with_gradio=not bool(os.getenv("SV_LOCAL_WEB"))), host="0.0.0.0", port=int(os.getenv("PORT", "7860")))
