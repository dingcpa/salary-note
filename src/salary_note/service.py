"""一鍵產檔：算數字 → 寫兩份 xlsx → 轉 pdf → 打包 zip。"""

from __future__ import annotations

import logging
import time
import zipfile
from dataclasses import dataclass, field
from pathlib import Path

from .calc import PayrollCalc, compute_payroll
from .models import Payroll
from .pdf import PdfConversionError, convert_to_pdf, find_soffice
from .roster import write_roster
from .statement import write_statements

log = logging.getLogger(__name__)


@dataclass
class OutputFile:
    name: str
    kind: str  # roster-xlsx / roster-pdf / statement-xlsx / statement-pdf / zip
    size: int


@dataclass
class GenerateResult:
    job: str
    folder: Path
    files: list[OutputFile] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    calc: PayrollCalc | None = None


def _job_name(payroll: Payroll) -> str:
    return f"{time.strftime('%Y%m%d-%H%M%S')}_{payroll.period.roc_year}{payroll.period.month:02d}"


def generate_files(payroll: Payroll, output_root: Path, *, make_pdf: bool = True,
                   job: str | None = None) -> GenerateResult:
    calc = compute_payroll(payroll)
    job = job or _job_name(payroll)
    folder = output_root / job
    folder.mkdir(parents=True, exist_ok=True)
    tag = payroll.period.file_tag

    roster_path = write_roster(calc, folder / f"外師薪資印領清冊_{tag}.xlsx")
    statement_path = write_statements(calc, folder / f"外師鐘點通知單_{tag}.xlsx")
    result = GenerateResult(job=job, folder=folder, calc=calc)
    produced: list[tuple[Path, str]] = [(roster_path, "roster-xlsx"), (statement_path, "statement-xlsx")]

    if make_pdf:
        if not find_soffice():
            result.warnings.append("找不到 LibreOffice，只產出 xlsx；安裝 LibreOffice 或在 .env 設定 SOFFICE_PATH 後可產 PDF。")
        else:
            try:
                pdfs = convert_to_pdf([roster_path, statement_path], folder)
                produced += [(pdfs[0], "roster-pdf"), (pdfs[1], "statement-pdf")]
            except PdfConversionError as e:
                log.exception("PDF 轉檔失敗")
                result.warnings.append(f"PDF 轉檔失敗：{e}")

    zip_path = folder / f"外師薪資_{tag}_全部.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for p, _ in produced:
            zf.write(p, arcname=p.name)
    produced.append((zip_path, "zip"))

    result.files = [OutputFile(name=p.name, kind=kind, size=p.stat().st_size) for p, kind in produced]
    return result
