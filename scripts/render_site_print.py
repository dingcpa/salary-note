r"""用 headless Chromium 把靜態版的「列印→PDF」實際輸出成 PDF 與 PNG（目視檢查版面）。
用法：.venv\Scripts\python.exe scripts\render_site_print.py [輸出資料夾]
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tests")); sys.path.insert(0, str(ROOT / "src"))
import pymupdf
from playwright.sync_api import sync_playwright
import test_static_site as T

out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data" / "output" / "_site_print"
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(); pg = ctx.new_page()
    errors = []; pg.on("pageerror", lambda e: errors.append(str(e))); pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.goto((ROOT / "site" / "index.html").as_uri())   # file:// 直接開檔也要能用
    pg.wait_for_function("typeof SalaryXlsx !== 'undefined'")
    pg.evaluate("() => { window.print = () => {}; }")
    T._fill(pg, T.PAYLOADS["0808"])
    for kind, btn in (("roster", "#printRoster"), ("statement", "#printStatement")):
        pg.click(btn)
        pg.emulate_media(media="print")
        pdf = out / f"site_print_{kind}.pdf"
        pg.pdf(path=str(pdf), prefer_css_page_size=True, print_background=True)
        pg.emulate_media(media="screen")
        doc = pymupdf.open(pdf)
        for i, page in enumerate(doc):
            png = out / f"site_print_{kind}_p{i+1}.png"; page.get_pixmap(dpi=100).save(png)
            print(f"{kind}: page {i+1} {page.rect.width:.0f}x{page.rect.height:.0f}pt → {png}")
    print("page errors:", errors)
    b.close()
