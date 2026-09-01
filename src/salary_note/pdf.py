"""用 LibreOffice headless 把 xlsx 轉成 pdf。"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import threading
from pathlib import Path

_DEFAULT_CANDIDATES = (
    r"C:\Program Files\LibreOffice\program\soffice.exe",
    r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    "/usr/bin/soffice",
    "/usr/lib/libreoffice/program/soffice",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
)

# LibreOffice 同一個 profile 不能同時跑兩個 headless 轉檔，序列化
_LOCK = threading.Lock()


class PdfConversionError(RuntimeError):
    pass


def find_soffice() -> str | None:
    env = os.environ.get("SOFFICE_PATH")
    if env and Path(env).is_file():
        return env
    for cand in _DEFAULT_CANDIDATES:
        if Path(cand).is_file():
            return cand
    return shutil.which("soffice") or shutil.which("soffice.exe")


def _profile_dir() -> Path:
    """獨立的使用者設定目錄（純 ASCII 路徑），避免跟使用者開著的 LibreOffice 互相卡住。"""
    d = Path(os.environ.get("SOFFICE_PROFILE_DIR") or Path(tempfile.gettempdir()) / "salary-note-lo-profile")
    d.mkdir(parents=True, exist_ok=True)
    return d


def convert_to_pdf(paths: list[Path], outdir: Path, *, soffice: str | None = None,
                   timeout: float = 180) -> list[Path]:
    """把多個 xlsx 一次轉成 pdf（同一個 LibreOffice 行程），回傳 pdf 路徑清單。"""
    exe = soffice or find_soffice()
    if not exe:
        raise PdfConversionError("找不到 LibreOffice（soffice），請安裝或在 .env 設定 SOFFICE_PATH")
    if not paths:
        return []
    outdir.mkdir(parents=True, exist_ok=True)
    cmd = [
        exe, "--headless", "--norestore", "--nologo",
        f"-env:UserInstallation={_profile_dir().as_uri()}",
        "--convert-to", "pdf", "--outdir", str(outdir),
        *[str(p) for p in paths],
    ]
    with _LOCK:
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout,
                                  encoding="utf-8", errors="replace")
        except subprocess.TimeoutExpired as e:
            raise PdfConversionError(f"LibreOffice 轉檔逾時（{timeout}s）") from e
    outputs = [outdir / f"{p.stem}.pdf" for p in paths]
    missing = [o.name for o in outputs if not o.is_file()]
    if proc.returncode != 0 or missing:
        raise PdfConversionError(
            f"LibreOffice 轉檔失敗 rc={proc.returncode} 缺少={missing}\n{proc.stdout}\n{proc.stderr}"
        )
    return outputs
