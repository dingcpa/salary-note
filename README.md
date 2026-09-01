# salary-note — 外籍教師薪資單套版產生器

嘉義國中外籍英語教師「薪資印領清冊」與「鐘點通知單（CYJH Salary Statement）」的線上套版工具：網頁填表 → 一鍵產出 xlsx + pdf。

## 使用

**最簡單：雙擊專案資料夾裡的 `start-server.bat`**，它會自己切到專案資料夾、起伺服器、就緒後自動開瀏覽器；關掉那個黑色視窗就是停止。

手動的話，先 `cd` 到專案資料夾再執行（在別的目錄打 `.venv\Scripts\python.exe` 會找不到檔案）：

```
cd "D:\Work\嘉義國中_外師薪資單\salary-note"
py -3.12 -m venv .venv                                    # 第一次才需要
.venv\Scripts\python.exe -m pip install -r requirements.txt -r requirements-dev.txt   # 第一次才需要
.venv\Scripts\python.exe server.py --open               # --open 會自動開瀏覽器
```

瀏覽器開 http://127.0.0.1:8765 ，填完按「產生檔案」，下載區會列出：

> ⚠ 一定要經由 `server.py` 開網頁。直接雙擊 `index.html` 或用 VS Code Live Preview 看到的只是 Jinja 模板（右上角會出現 `{{ version }}` 原字），按鈕都不會有反應——頁面會顯示紅字提醒。

- `外師薪資印領清冊_{年}.{月}.xlsx` / `.pdf`
- `外師鐘點通知單_{年}.{月}.xlsx` / `.pdf`（每位外師一個工作表／一頁）
- 全部打包的 zip

PDF 轉檔需要本機安裝 LibreOffice（沒有的話只會產 xlsx，並在畫面提示）。

## 測試

```
.venv\Scripts\python.exe -m pytest -q
```

`tests	est_e2e.py` 是 Playwright 瀏覽器測試（真的起伺服器、真的按按鈕），第一次要先裝 Chromium：
`.venv\Scripts\python.exe -m playwright install chromium`；沒裝會自動跳過。

## 結構

- `src\salary_note\` 程式碼本體（models / calc / numerals / roster / statement / pdf / service / app）
- `server.py` 啟動入口
- `scripts\` 一次性腳本
- `tests\` pytest 測試
- `data\input\` 參考檔（原始 xls 版型、通知單樣本圖，不進 git）
- `data\output\` 程式產出（不進 git，可隨時刪除重跑）
- `logs\` 執行紀錄（不進 git）
- `docs\` 文件與筆記（含 `PROGRESS.md` 進度文件）
