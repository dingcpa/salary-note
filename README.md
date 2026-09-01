# salary-note — 外籍教師薪資單套版產生器

嘉義國中外籍英語教師「薪資印領清冊」與「鐘點通知單（CYJH Salary Statement）」的線上套版工具：網頁填表 → 一鍵產出 xlsx + pdf。

## 使用

```
py -3.12 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt -r requirements-dev.txt
.venv\Scripts\python.exe server.py
```

瀏覽器開 http://127.0.0.1:8765 ，填完按「產生檔案」，下載區會列出：

- `外師薪資印領清冊_{年}.{月}.xlsx` / `.pdf`
- `外師鐘點通知單_{年}.{月}.xlsx` / `.pdf`（每位外師一個工作表／一頁）
- 全部打包的 zip

PDF 轉檔需要本機安裝 LibreOffice（沒有的話只會產 xlsx，並在畫面提示）。

## 結構

- `src\salary_note\` 程式碼本體（models / calc / numerals / roster / statement / pdf / service / app）
- `server.py` 啟動入口
- `scripts\` 一次性腳本
- `tests\` pytest 測試
- `data\input\` 參考檔（原始 xls 版型、通知單樣本圖，不進 git）
- `data\output\` 程式產出（不進 git，可隨時刪除重跑）
- `logs\` 執行紀錄（不進 git）
- `docs\` 文件與筆記（含 `PROGRESS.md` 進度文件）
