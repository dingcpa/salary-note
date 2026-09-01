r"""用 headless Chromium 把 LINE 通知圖卡實際產成 PNG（目視檢查用）。
用法：.venv\Scripts\python.exe scripts\render_card.py [輸出資料夾]
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tests")); sys.path.insert(0, str(ROOT / "src"))
from playwright.sync_api import sync_playwright
import test_static_site as T

out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data" / "output" / "_card"
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(accept_downloads=True); pg = ctx.new_page()
    errors = []; pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto((ROOT / "site" / "index.html").as_uri())
    pg.wait_for_function("typeof SalaryCard !== 'undefined'")
    for key in ("0808", "0809"):
        pg.click("#clearBtn") if key != "0808" else None
        T._fill(pg, T.PAYLOADS[key])
        pg.click("#lineCardBtn")
        pg.wait_for_function("document.querySelectorAll('#cardList img').length >= 1")
        pg.screenshot(path=str(out / f"modal_{key}.png"))
        with pg.expect_download() as dl:
            pg.click("#cardList .dlCard")
        path = out / f"card_{key}.png"
        dl.value.save_as(path)
        print("saved:", path)
        pg.click("#cardClose")
    print("page errors:", errors)
    b.close()
