"""FastAPI 網頁：GET / 表單、POST /api/generate 產檔、GET /download/... 下載。"""

from __future__ import annotations

import logging
import os
import re
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from pydantic import Field

from . import __version__
from .models import Payroll, Period
from .pdf import find_soffice
from .service import generate_files

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")

OUTPUT_DIR = Path(os.environ.get("OUTPUT_DIR") or ROOT / "data" / "output")
TEMPLATES = Jinja2Templates(directory=str(Path(__file__).parent / "templates"))

log = logging.getLogger(__name__)
app = FastAPI(title="外師薪資單產生器", version=__version__)

_SAFE_NAME = re.compile(r"^[^\\/:*?\"<>|\x00-\x1f]+$")


class GenerateRequest(Payroll):
    make_pdf: bool = Field(default=True, description="False 時只產 xlsx")


def _default_period() -> Period:
    """預設帶上個月（清冊在次月 10 日前做）。"""
    import datetime as dt

    today = dt.date.today()
    first = today.replace(day=1)
    prev = first - dt.timedelta(days=1)
    return Period(roc_year=prev.year - 1911, month=prev.month)


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    period = _default_period()
    fields = Payroll.model_fields
    defaults = {
        "period": {"roc_year": period.roc_year, "month": period.month},
        "payroll": {k: fields[k].default for k in ("school_name", "statement_title_zh", "statement_title_en")},
        "has_soffice": bool(find_soffice()),
    }
    return TEMPLATES.TemplateResponse(request, "index.html", {"defaults": defaults, "version": __version__})


@app.post("/api/generate")
def generate(req: GenerateRequest):
    payroll = Payroll.model_validate(req.model_dump(exclude={"make_pdf"}))
    result = generate_files(payroll, OUTPUT_DIR, make_pdf=req.make_pdf)
    calc = result.calc
    assert calc is not None
    return {
        "job": result.job,
        "folder": str(result.folder),
        "files": [
            {"name": f.name, "kind": f.kind, "size": f.size, "url": f"/download/{result.job}/{f.name}"}
            for f in result.files
        ],
        "warnings": result.warnings,
        "summary": {
            "total_gross": calc.total_gross,
            "total_net": calc.total_net,
            "total_gross_upper": calc.total_gross_upper,
            "teachers": [
                {
                    "name": t.name, "subtotal": t.subtotal, "gross": t.gross, "tax": t.tax,
                    "deductions": t.deductions, "net": t.net, "statement_net": t.net_with_extras,
                }
                for t in calc.teachers
            ],
        },
    }


@app.get("/download/{job}/{filename}")
def download(job: str, filename: str):
    if not re.fullmatch(r"[0-9]{8}-[0-9]{6}_[0-9]{5,6}", job) or not _SAFE_NAME.fullmatch(filename):
        raise HTTPException(status_code=400, detail="不合法的路徑")
    path = (OUTPUT_DIR / job / filename).resolve()
    if OUTPUT_DIR.resolve() not in path.parents or not path.is_file():
        raise HTTPException(status_code=404, detail="檔案不存在")
    return FileResponse(path, filename=filename)


@app.exception_handler(Exception)
async def _unhandled(request: Request, exc: Exception):
    log.exception("未處理的錯誤")
    return JSONResponse(status_code=500, content={"detail": f"{type(exc).__name__}: {exc}"})
