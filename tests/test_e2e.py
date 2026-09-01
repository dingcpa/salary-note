"""瀏覽器端到端測試（Playwright + Chromium）：真的起 uvicorn、真的按按鈕。

沒裝 playwright／chromium 時整個檔案跳過：
  .venv\\Scripts\\python.exe -m pip install playwright && .venv\\Scripts\\python.exe -m playwright install chromium
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import pytest

playwright = pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright  # noqa: E402

from conftest import SAMPLE_0808  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
PORT = 8797
BASE = f"http://127.0.0.1:{PORT}"


@pytest.fixture(scope="module")
def server(tmp_path_factory: pytest.TempPathFactory):
    env = dict(os.environ, PORT=str(PORT), OUTPUT_DIR=str(tmp_path_factory.mktemp("out")), PYTHONIOENCODING="utf-8")
    proc = subprocess.Popen([sys.executable, "server.py"], cwd=ROOT, env=env,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    try:
        for _ in range(80):
            try:
                urllib.request.urlopen(BASE + "/", timeout=1).read()
                break
            except Exception:
                time.sleep(0.25)
        else:
            proc.kill()
            out = proc.communicate()[0].decode("utf-8", "replace")
            pytest.fail("伺服器起不來:\n" + out)
        yield BASE
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()


@pytest.fixture(scope="module")
def browser():
    with sync_playwright() as p:
        try:
            b = p.chromium.launch()
        except Exception as e:  # chromium 沒安裝
            pytest.skip(f"Chromium 無法啟動：{e}")
        yield b
        b.close()


@pytest.fixture
def page(browser, server):
    ctx = browser.new_context()
    pg = ctx.new_page()
    errors: list[str] = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.errors = errors  # type: ignore[attr-defined]
    yield pg
    ctx.close()


def test_page_boots_with_defaults(page):
    page.goto(BASE + "/")
    assert "v0.1.0" in page.locator("header").inner_text()
    assert page.locator("#teachers .teacher").count() == 1  # 自動帶一位外師
    assert int(page.input_value("#roc_year")) >= 115
    assert page.input_value("#school_name") == "嘉義市立嘉義國民中學"
    assert page.errors == []


def test_add_and_remove_teacher(page):
    page.goto(BASE + "/")
    page.click("#addTeacher")
    assert page.locator("#teachers .teacher").count() == 2
    assert page.locator("#teachers .teacher .idx").nth(1).inner_text() == "外師 2"
    page.click("#addTeacher")
    assert page.locator("#teachers .teacher").count() == 3
    page.locator("#teachers .teacher .remove").nth(0).click()
    assert page.locator("#teachers .teacher").count() == 2
    assert page.locator("#teachers .teacher .idx").nth(0).inner_text() == "外師 1"  # 重新編號
    assert page.errors == []


def _fill_sample(page, block, data=SAMPLE_0808):
    for k, v in data.items():
        if v is None:
            continue
        block.locator(f'[data-k="{k}"]').fill(str(v))


def test_preview_and_generate_without_pdf(page):
    page.goto(BASE + "/")
    page.fill("#roc_year", "115")
    page.fill("#month", "8")
    page.fill("#start_day", "16")
    page.fill("#end_day", "")
    assert "不足月" in page.locator("#periodHint").inner_text()
    assert "16/31" in page.locator("#periodHint").inner_text()

    block = page.locator("#teachers .teacher").first
    _fill_sample(page, block)
    preview = block.locator(".preview").inner_text()
    for expected in ("44,774", "54,000", "2,212", "4,187", "40,587", "42,523"):
        assert expected in preview, preview

    page.uncheck("#make_pdf")
    page.click("#submitBtn")
    page.wait_for_selector("#result:not([hidden])", timeout=30_000)
    assert page.locator("#status").inner_text() == "完成"
    files = page.locator("#files li")
    assert files.count() == 3
    assert "伍萬伍仟玖佰參拾陸" in page.locator("#summary").inner_text()
    assert page.errors == []

    # 重新整理後記住上次輸入
    page.reload()
    assert page.locator("#teachers .teacher").first.locator('[data-k="salary"]').input_value() == "41677"
    assert page.input_value("#start_day") == "16"


def test_prorate_checkbox_recomputes_preview(page):
    page.goto(BASE + "/")
    page.fill("#roc_year", "115"); page.fill("#month", "8"); page.fill("#start_day", "16")
    block = page.locator("#teachers .teacher").first
    _fill_sample(page, block, dict(name="X", salary=80750, housing=5000, transport=1000,
                                   labor_ins_employer=4095, health_ins_employer=4239, pension_employer=5256,
                                   labor_ins_self=1155, health_ins_self=1359))
    page.check("#prorate")
    preview = block.locator(".preview").inner_text()
    assert "41,677 / 2,581 / 516" in preview
    assert "54,000" in preview and "40,587" in preview


def test_validation_error_is_shown(page):
    page.goto(BASE + "/")
    page.fill("#roc_year", "115"); page.fill("#month", "2"); page.fill("#end_day", "30")
    block = page.locator("#teachers .teacher").first
    block.locator('[data-k="name"]').fill("X")
    page.uncheck("#make_pdf")
    page.click("#submitBtn")
    page.wait_for_function("document.getElementById('status').textContent.startsWith('失敗')", timeout=15_000)
    assert "迄日" in page.locator("#status").inner_text()


def test_raw_template_shows_fatal_banner(browser):
    """直接開 html 檔（未經 Jinja）要看到紅字警告，而不是死掉的表單。"""
    ctx = browser.new_context()
    pg = ctx.new_page()
    pg.goto((ROOT / "src" / "salary_note" / "templates" / "index.html").as_uri())
    banner = pg.locator(".fatal")
    assert banner.count() == 1
    assert "server.py" in banner.inner_text()
    ctx.close()
