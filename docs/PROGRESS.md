---
status: active
goal: 網頁填表一鍵產出嘉義國中外籍教師薪資印領清冊與鐘點通知單的 xlsx 與 pdf
progress: 75%
updated: 2026-09-01
next: 使用者用真實資料在瀏覽器實測一輪（.venv\Scripts\python.exe server.py → http://127.0.0.1:8765），依回饋微調版面與欄位；之後做外師基本資料記憶功能
url_local: http://127.0.0.1:8765
url_prod:
deploy: 本機執行（需 LibreOffice 轉 PDF）
---

# 開發進度

## 專案目標與預期成果

學校每月要做兩份文件：給行政流程用的「外籍英語教師薪資印領清冊」（橫式 A4、含各處室核章欄）與交給外師的雙語「鐘點通知單（CYJH Salary Statement）」（直式 A4）。目前是手動改 Excel 與 Word，本專案做一個本機網頁：填期間與每位外師的薪資項目 → 一鍵產出兩份文件的 xlsx（保留公式）與 pdf。

驗收標準：用 115.08（8/16–8/31 不足月、含健康檢查費用 1,936）的樣本資料產出，金額與原表完全一致（應發 54,000／實領 40,587／總計 55,936／實領總計 42,523／通知單實發 42,523），版面與原表相近可直接列印。

## 目前成果（已完成、現在就可用的部分）

- 2026-09-01 MVP 完成，38 項 pytest 全綠（含 LibreOffice 轉 PDF 整合測試與 FastAPI 端點測試）：
  - `src/salary_note/models.py` 期間（民國年月、不足月起迄日、英文月份標籤、按天數換算）與外師薪資項目模型
  - `calc.py` 小計／應發／預扣稅／代扣／實領／含健檢合計；`numerals.py` 金額大寫
  - `roster.py` 印領清冊 xlsx（欄寬列高字型公式核章欄皆對照原表；支援多位外師、健康檢查費用另列一行、不足月表頭 16/31、16/30 註記）
  - `statement.py` 鐘點通知單 xlsx（每位外師一個工作表；中英標籤用 rich text 分別套標楷體／Times New Roman）
  - `pdf.py` LibreOffice headless 轉 PDF（獨立 profile、序列化鎖）；`service.py` 一鍵產檔＋zip
  - `app.py` + `templates/index.html` 單頁表單（多位外師、即時試算預覽、全月金額自動換算選項、localStorage 記住上次輸入、下載清單）
  - `tests/test_e2e.py` Playwright 瀏覽器測試 6 項（載入預設、新增／移除外師、預覽、送出、記住輸入、驗證錯誤顯示、直接開 html 檔的紅字警告）
  - 驗收：115.08 樣本產出的 PDF 金額與原表一致，版面目視與原表相符（`scripts/render_sample.py` 可重跑並轉 PNG 檢視）
- 專案初始化：範本結構、venv（Python 3.12）、原始 xls 與通知單樣本歸位 `data\input\`

## 進行中

- [ ] 使用者以真實資料在瀏覽器實測，收集版面／欄位回饋

## 待執行

- [ ] 外師基本資料（姓名、薪級、聘期、保費、全月薪資）記憶／帶入功能，讓次月只改期間
- [ ] 機票補助印領清冊（原表第三個工作表 `114.07機票`）版型
- [ ] 通知單「給薪月份」全月時的英文寫法（目前 `September 2026`）待學校確認
- [ ] 若要給非本機使用者用：決定部署方式（目前只綁 127.0.0.1）

## 決策紀錄

- 2026-09-01 技術路線：Python 3.12 + FastAPI + Jinja2 單頁表單；openpyxl 從零建 xlsx（不套用 LibreOffice 轉出的 xlsx 當範本，避免殘留舊資料與轉檔雜訊）；PDF 用 LibreOffice headless 轉（實測含兩份 PDF 產檔約 0.7 秒）。
- 2026-09-01 印領清冊與通知單分別產成獨立 xlsx／pdf（學校兩份文件流向不同），另附 zip。
- 2026-09-01 總計大寫由 Python 產生字串，不依賴 Excel [DBNum2] 格式。
- 2026-09-01 請假扣薪以正數輸入，公式 =C+D+E−F（原表 SUM(C:F) 需自行填負數）。
- 2026-09-01 清冊固定產出「總計（數字）」＋「總計（大寫）」兩列（原表單人月份只有大寫列），一致比較好讀。
- 2026-09-01 測試資料用假名 `Sample Teacher`，金額沿用原表以便驗證；真實姓名不進 git。

## Commit Trail

- acf9ea5 init: 專案初始化（from _template）

（收工時把最新 commit hash 加在最上面）
