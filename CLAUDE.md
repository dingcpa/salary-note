# CLAUDE.md

（共用資料夾規則見上層 `D:\Dev\CLAUDE.md`，此處只寫本專案特有的事）

## 專案目的

嘉義市立嘉義國民中學外籍英語教師薪資套版產生器：在網頁表單填入期間與每位外師的薪資項目，一鍵產出「外籍英語教師薪資印領清冊」與「外籍教師鐘點通知單（CYJH Salary Statement）」的 xlsx 與 pdf。

**交付物是 `site\`（純前端靜態網頁，部署到 GitHub Pages 給學校承辦人用）**；`src\salary_note\` 的 Python 版是最早的實作，現在當「對照答案」：`tests\test_static_site.py` 在真瀏覽器用 ExcelJS 產 xlsx，再用 openpyxl 跟 Python 版逐格比對。改版型或計算規則時**兩邊都要改**，測試會抓出不一致。

## 如何啟動

```
start-server.bat                         # 雙擊即可：cd 到專案、起伺服器、自動開瀏覽器
.venv\Scripts\python.exe server.py --open   # 同上，手動版（要先 cd 到專案資料夾）
.venv\Scripts\python.exe -m pytest -q   # 測試
```

- Python 3.12 venv（`py -3.12 -m venv .venv`；套件見 `requirements*.txt`）
- PDF 轉檔靠 LibreOffice headless：預設找 `C:\Program Files\LibreOffice\program\soffice.exe`，可用 `.env` 的 `SOFFICE_PATH` 覆蓋
- 產出放 `data\output\{時間戳}_{民國年月}\`，可用 `OUTPUT_DIR` 覆蓋

## 本專案特有慣例

- `site\` 不用打包工具、不用 ES module（要能 file:// 直接開），JS 用 UMD 風格掛全域：`SalaryCalc`、`SalaryXlsx`、`SalaryPrint`、`SalaryCard`（LINE 通知圖卡，Canvas 畫 PNG；`lines()` 純資料、`draw()` 畫圖，`scripts\render_card.py` 可產 PNG 目視）；ExcelJS 放 `site\vendor\` 不走 CDN
- `site\index.html` 的 `<script src="x.js?v=N">` 是快取破壞版本號（GitHub Pages 快取 10 分鐘）：**改任何 site JS 就把 N 加一**，否則使用者可能拿到新 index.html＋舊 JS
- 靜態版的「記住上次內容」= 每次輸入即寫 localStorage（key `salary-note-v2`）＋匯出／匯入 JSON＋產出的 xlsx 內藏隱藏工作表 `_salary_note_data`（A2 為 JSON）
- 靜態版 PDF 走瀏覽器列印（`#print-root` 只在 print media 顯示，`#page-style` 動態切 landscape／portrait）；`scripts\render_site_print.py` 可用 headless Chromium 印成 PDF/PNG 目視檢查

- 印領清冊版型以 `data\input\115嘉義國中外師薪資印領清冊表new(次月10日前).xls` 的 `115.08` 工作表為準；通知單版型以 `data\input\通知單樣本_115.08.jpg` 為準
- 計算規則（沿用學校原表公式）：
  - 小計 = 本月薪資 + 住宿津貼 + 交通費 − 請假扣薪（原表是 SUM(C:F)，請假扣薪在本系統以正數輸入、由公式扣除）
  - 應發金額 = 小計 + 勞保機補 + 健保機補 + 勞退機補
  - 預扣稅額 = ROUNDDOWN((本月薪資 + 住宿津貼) × 稅率, 0)，稅率預設 5%
  - 代扣款小計 = 預扣稅額 + 勞保自付 + 健保自付；實領 = 小計 − 代扣款小計
  - 健康檢查費用另列一行（只進應發與實領）；通知單實發 = 小計 − 代扣款小計 + 健康檢查補助
  - 不足月時按天數換算：薪資／住宿／交通 × 天數/當月天數；勞保機補／勞退機補／勞保自付 × 天數/30；健保不換算。四捨五入到元
- 總計大寫用 Python 產生字串寫入（不用 Excel 的 [DBNum2] 格式，避免 LibreOffice 轉 PDF 時走樣）
- 金額欄在 xlsx 內保留公式，讓學校事後可手動微調
- 中文字型：標題／表頭用「標楷體」，數字與英文用「Times New Roman」
