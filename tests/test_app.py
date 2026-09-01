"""FastAPI 端點測試（不轉 PDF，避免依賴 LibreOffice）。"""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import salary_note.app as app_module
from conftest import SAMPLE_0808


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setattr(app_module, "OUTPUT_DIR", tmp_path)
    return TestClient(app_module.app, raise_server_exceptions=False)


def _body(**overrides):
    body = {
        "period": {"roc_year": 115, "month": 8, "start_day": 16},
        "teachers": [SAMPLE_0808],
        "make_pdf": False,
    }
    body.update(overrides)
    return body


def test_index_renders_form(client: TestClient):
    r = client.get("/")
    assert r.status_code == 200
    assert "外師薪資單" in r.text
    assert 'id="teachers"' in r.text


def test_generate_and_download(client: TestClient):
    r = client.post("/api/generate", json=_body())
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["summary"]["total_gross"] == 55936
    assert data["summary"]["total_net"] == 42523
    assert data["summary"]["teachers"][0]["statement_net"] == 42523
    names = [f["name"] for f in data["files"]]
    assert "外師薪資印領清冊_115.08.xlsx" in names and "外師鐘點通知單_115.08.xlsx" in names
    assert data["warnings"] == []

    url = next(f["url"] for f in data["files"] if f["kind"] == "roster-xlsx")
    d = client.get(url)
    assert d.status_code == 200
    assert d.headers["content-type"].startswith("application/vnd.openxmlformats")
    assert d.content[:2] == b"PK"


def test_generate_validation_error(client: TestClient):
    r = client.post("/api/generate", json=_body(teachers=[]))
    assert r.status_code == 422
    r = client.post("/api/generate", json=_body(period={"roc_year": 115, "month": 2, "end_day": 30}))
    assert r.status_code == 422


def test_download_rejects_bad_paths(client: TestClient):
    assert client.get("/download/../etc/passwd").status_code in (400, 404)
    assert client.get("/download/20260901-000000_11508/..%5c..%5cx.txt").status_code in (400, 404)
    assert client.get("/download/20260901-000000_11508/missing.xlsx").status_code == 404
