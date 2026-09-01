"""啟動入口：.venv\\Scripts\\python.exe server.py [--open]  →  http://127.0.0.1:8765

--open（或環境變數 OPEN_BROWSER=1）：伺服器就緒後自動開瀏覽器；OPEN_BROWSER=0 強制不開。
"""

import os
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

import uvicorn  # noqa: E402


def _open_browser_when_ready(url: str) -> None:
    def run() -> None:
        for _ in range(150):
            try:
                urllib.request.urlopen(url, timeout=1).read(1)
                break
            except Exception:
                time.sleep(0.2)
        webbrowser.open(url)

    threading.Thread(target=run, daemon=True).start()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8765"))
    url = f"http://127.0.0.1:{port}"
    print(f"外師薪資單產生器  →  {url}   （關閉此視窗即停止）")
    flag = os.environ.get("OPEN_BROWSER")
    if flag != "0" and ("--open" in sys.argv or flag == "1"):
        _open_browser_when_ready(url)
    uvicorn.run("salary_note.app:app", host="127.0.0.1", port=port, reload=False)
