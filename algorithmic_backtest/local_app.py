"""Build and serve the complete backtest application on localhost."""

import argparse
import shutil
import subprocess

import uvicorn
from fastapi.staticfiles import StaticFiles

from .api import PROJECT_ROOT, app


def main() -> None:
    parser = argparse.ArgumentParser(description="BIST backtest uygulamasını başlat.")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("Port 1 ile 65535 arasında olmalı.")

    frontend = PROJECT_ROOT / "frontend"
    npm = shutil.which("npm")
    if npm is None:
        parser.exit(1, "Arayüzü derlemek için Node.js ve npm gerekli.\n")
    if not (frontend / "package-lock.json").is_file():
        parser.exit(1, "Bu komutu frontend klasörünü içeren proje kopyasında çalıştırın.\n")

    try:
        if not (frontend / "node_modules" / ".bin" / "vite").is_file():
            subprocess.run([npm, "ci"], cwd=frontend, check=True)
        subprocess.run([npm, "run", "build"], cwd=frontend, check=True)
    except subprocess.CalledProcessError as exc:
        parser.exit(exc.returncode, "Arayüz hazırlanamadı. Yukarıdaki npm çıktısını kontrol edin.\n")

    app.mount("/", StaticFiles(directory=frontend / "dist", html=True), name="frontend")
    uvicorn.run(app, host="127.0.0.1", port=args.port)


if __name__ == "__main__":
    main()
