# salary-note — 外籍教師薪資單套版產生器

嘉義國中外籍英語教師「薪資印領清冊」與「鐘點通知單（CYJH Salary Statement）」的線上套版工具：網頁填表 → 一鍵產出 xlsx + pdf。

## 給學校承辦人：直接開網頁（GitHub Pages 靜態版）

網址：`https://<GitHub帳號>.github.io/<repo>/`（推上 GitHub 並啟用 Pages 後即可，見下方「部署」）。

- 純前端，資料都留在承辦人自己的瀏覽器裡，不會上傳。
- **每次打開都會自動帶入上次的內容**（每次輸入即自動記在瀏覽器 localStorage），每月只要改給薪期間。
- 換電腦或瀏覽器資料被清掉時：用「匯出設定檔」的 JSON，或**把上個月產出的 Excel 直接拖進網頁**（xlsx 內藏一份設定）即可全部帶入。
- 「⬇ Excel」直接下載 xlsx（保留公式）；「🖨 列印／存 PDF」開列印對話框，選「另存為 PDF」。
- **通知圖卡**：每位外師一張 LINE 風格的薪資卡（PNG，中英雙語），按「複製到剪貼簿」後到 LINE 聊天視窗 Ctrl+V 貼給外師，或下載 PNG 再傳。
- 沒網路時雙擊 `site\index.html` 也能用（同樣會記住內容）。

## 給開發者：本機 Python 版（對照答案）

`src\salary_note\` 是原始的 Python 實作（FastAPI + openpyxl + LibreOffice 轉 PDF），保留當靜態版的**對照答案**：測試會在真瀏覽器用 ExcelJS 產 xlsx，再用 openpyxl 與 Python 版逐格比對。

雙擊 `start-server.bat`，或：

```
cd "D:\Work\嘉義國中_外師薪資單\salary-note"
py -3.12 -m venv .venv                                    # 第一次才需要
.venv\Scripts\python.exe -m pip install -r requirements.txt -r requirements-dev.txt   # 第一次才需要
.venv\Scripts\python.exe -m playwright install chromium   # 第一次才需要（瀏覽器測試）
.venv\Scripts\python.exe server.py --open
```

## 部署到 GitHub Pages

1. 把這個 repo 推上 GitHub（`data\`、`.venv\` 都在 .gitignore，不會上去）。
2. GitHub → Settings → Pages → Build and deployment → Source 選 **GitHub Actions**。
3. 之後每次 push 到 `main`，[.github/workflows/pages.yml](.github/workflows/pages.yml) 會把 `site\` 發布上去；網址在 Actions 的 deploy 紀錄或 Settings → Pages 看得到。

## 測試

```
.venv\Scripts\python.exe -m pytest -q
```

`tests\test_static_site.py`（靜態版）與 `tests\test_e2e.py`（Python 版）是 Playwright 瀏覽器測試，沒裝 Chromium 會自動跳過。

## 結構

- `site\` **靜態版網頁（GitHub Pages 部署的就是這個）**：calc.js 計算、xlsx.js（ExcelJS）產 Excel、print.js 列印版型、card.js LINE 通知圖卡、app.js 表單與自動記憶
- `src\salary_note\` Python 版（對照答案；models / calc / numerals / roster / statement / pdf / service / app）
- `server.py` 啟動入口
- `scripts\` 一次性腳本
- `tests\` pytest 測試
- `data\input\` 參考檔（原始 xls 版型、通知單樣本圖，不進 git）
- `data\output\` 程式產出（不進 git，可隨時刪除重跑）
- `logs\` 執行紀錄（不進 git）
- `docs\` 文件與筆記（含 `PROGRESS.md` 進度文件）
