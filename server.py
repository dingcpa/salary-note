"""啟動入口：.venv\\Scripts\\python.exe server.py  →  http://127.0.0.1:8765"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

import uvicorn  # noqa: E402

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8765"))
    print(f"外師薪資單產生器  →  http://127.0.0.1:{port}")
    uvicorn.run("salary_note.app:app", host="127.0.0.1", port=port, reload=False)
