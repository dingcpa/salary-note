r"""用 115.08 樣本資料產出到 data/output，並把 PDF 每頁轉成 PNG（給目視檢查版面用）。
用法：.venv\Scripts\python.exe scripts\render_sample.py [png輸出資料夾]
"""
import sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "tests"))

import pymupdf
from conftest import SAMPLE_0808
from salary_note.models import Payroll, Period, Teacher
from salary_note.service import generate_files

png_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data" / "output" / "_preview"
png_dir.mkdir(parents=True, exist_ok=True)

payroll = Payroll(period=Period(roc_year=115, month=8, start_day=16), teachers=[Teacher(**SAMPLE_0808)])
t0 = time.time()
r = generate_files(payroll, ROOT / "data" / "output", make_pdf=True)
print(f"generated in {time.time()-t0:.1f}s → {r.folder}")
for f in r.files:
    print(f"  {f.kind:15} {f.name}  {f.size:,} bytes")
print("warnings:", r.warnings)
for f in r.files:
    if f.kind.endswith("-pdf"):
        doc = pymupdf.open(r.folder / f.name)
        for i, page in enumerate(doc):
            out = png_dir / f"{Path(f.name).stem}_p{i+1}.png"
            page.get_pixmap(dpi=110).save(out)
            print("  png:", out)
