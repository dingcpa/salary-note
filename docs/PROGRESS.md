---
status: active
goal: 網頁填表一鍵產出嘉義國中外籍教師薪資印領清冊與鐘點通知單的 xlsx 與 pdf
progress: 95%
updated: 2026-09-02
next: 請學校承辦人用真實資料實測 https://dingcpa.github.io/salary-note/ ，並確認全月時通知單英文月份寫法（September 2026 或 September 1-30, 2026）；依回饋微調
url_local: http://127.0.0.1:8765
url_prod: https://dingcpa.github.io/salary-note/
deploy: GitHub Pages（repo dingcpa/salary-note，push main 自動部署）；Python 版本機 start-server.bat
---

# 開發進度

## 專案目標與預期成果

學校每月要做兩份文件：給行政流程用的「外籍英語教師薪資印領清冊」（橫式 A4、含各處室核章欄）與交給外師的雙語「鐘點通知單（CYJH Salary Statement）」（直式 A4）。目前是手動改 Excel 與 Word，本專案做一個本機網頁：填期間與每位外師的薪資項目 → 一鍵產出兩份文件的 xlsx（保留公式）與 pdf。

驗收標準：用 115.08（8/16–8/31 不足月、含健康檢查費用 1,936）的樣本資料產出，金額與原表完全一致（應發 54,000／實領 40,587／總計 55,936／實領總計 42,523／通知單實發 42,523），版面與原表相近可直接列印。

## 目前成果（已完成、現在就可用的部分）

- 2026-09-01 **已上線**：https://dingcpa.github.io/salary-note/ （public repo `dingcpa/salary-note`，push main 自動部署，script 帶 `?v=N` 快取版本號）
- 2026-09-01 **靜態版 `site\` 完成**（給學校承辦人、GitHub Pages 部署）：
  - `calc.js` 計算（與 Python 版逐項對照）、`xlsx.js` ExcelJS 產印領清冊／通知單 xlsx（與 Python 版 openpyxl 產出逐格比對一致：值、公式、字型、對齊、框線、合併、欄寬、列高、頁面設定）、`print.js` 列印版型（橫式清冊／直式通知單）、`app.js` 表單
  - 每次輸入即自動存 localStorage、打開即帶入；匯出／匯入 JSON；產出的 xlsx 內藏設定可拖回帶入
  - `card.js` LINE 風格通知圖卡：綠色「LINE 圖卡」按鈕 → 彈窗預覽（可截圖／右鍵複製）＋下載 PNG／複製到剪貼簿
  - `tests\test_static_site.py` 18 項 Playwright 測試（全專案共 62 項）；`.github/workflows/pages.yml` 部署 workflow

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

- [ ] 承辦人以真實資料實測 https://dingcpa.github.io/salary-note/ ，收集回饋

## 待執行

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

- 2026-09-01 交付物改為靜態版 `site\`（承辦人不必裝 Python／LibreOffice）；Python 版保留當對照答案，兩邊版型同步維護。PDF 改走瀏覽器列印（標楷體是微軟授權字型，不能內嵌到公開網站的 jsPDF）。
- 2026-09-01 「記住上次內容」三層：localStorage 自動存＋JSON 匯出入＋xlsx 內藏設定（隱藏工作表）。

- 2026-09-01 外師通知改用「圖卡貼 LINE」（方案 A）：純前端 Canvas 產 PNG，承辦人手動貼；不做 LINE Messaging API 推送（需官方帳號、後端保管 token、外師加好友），日後有需要再加，卡片設計可直接沿用成 Flex Message。

## Commit Trail

- 2f3191e docs: 修 CLAUDE.md 斷行路徑與快取版本號說明
- fa49650 feat(site): LINE 圖卡改為綠色按鈕＋彈窗預覽；script 加 ?v= 快取版本號
- 6e32416 feat(site): LINE 風格通知圖卡（Canvas → PNG）
- 88758e4 fix(docs,site): 反斜線修復；清冊備註列印不折行
- d7c7868 feat(site): GitHub Pages 靜態版（瀏覽器產 xlsx、列印 PDF、自動帶入上次內容）
- 0101c28 feat: start-server.bat 雙擊啟動；server.py --open
- 8d60b6c fix(ui): 未經伺服器開啟的紅字警告＋Playwright e2e
- 08af2e6 test: 首頁 Jinja 渲染檢查
- 2665b73 feat: MVP 印領清冊＋鐘點通知單網頁產生器（xlsx/pdf）
- acf9ea5 init: 專案初始化（from _template）

（收工時把最新 commit hash 加在最上面）
