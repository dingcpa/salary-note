# Session log 2026-09-01 ～ 09-02：從零到上線（MVP → GitHub Pages 靜態版 → LINE 圖卡）

## 起點

- 全新資料夾，只有兩個檔案：學校的原始印領清冊 `115嘉義國中外師薪資印領清冊表new(次月10日前).xls`（BIFF 舊格式，含 115.08／115.09／114.07機票 三個工作表）與通知單樣本照片（Word 表格拍照）。
- 需求：網頁填外師薪資 → 一鍵產出「薪資印領清冊」與「鐘點通知單（CYJH Salary Statement）」的 Excel 與 PDF。
- session 中途需求演進兩次：改成 GitHub Pages 靜態版給學校承辦人直接用（每次打開自動帶入上次內容）→ 再加 LINE 風格通知圖卡。

## 本 session 完成事項（依時序）

| # | 主題 | 變更摘要 |
|---|------|----------|
| 1 | 專案初始化 | robocopy `_template` 補結構、git init、資料檔歸位 `data\input\`、Python 3.12 venv |
| 2 | 版型分析 | xlrd（cp950）讀 xls、LibreOffice 轉 xlsx 抽公式／欄寬／列高／頁面設定；通知單從照片重建 |
| 3 | Python MVP | models／calc／numerals（大寫）／roster／statement／pdf（LO headless）／service／FastAPI 單頁表單，38 測試 |
| 4 | 啟動體驗 | 未渲染紅字警告、`start-server.bat`（%~dp0 自動 cd、--open 就緒後開瀏覽器）、Playwright e2e |
| 5 | 靜態版 `site\` | calc.js／xlsx.js（ExcelJS）／print.js／app.js；三層記憶；Pages workflow；18 項瀏覽器測試 |
| 6 | 上線 | `gh repo create dingcpa/salary-note --push`、`gh api ...pages build_type=workflow`、部署成功 |
| 7 | LINE 圖卡 | card.js（Canvas → 1440px PNG）；綠色按鈕 → 彈窗預覽＋下載／複製剪貼簿；`?v=N` 快取版本號 |

Commits（新→舊）：`2f3191e` `fa49650` `6e32416` `88758e4` `d7c7868` `0101c28` `8d60b6c` `08af2e6` `2665b73` `acf9ea5`

## 設計決策與 rationale

1. **交付物改為純前端靜態版，Python 版降級為「對照答案」**：學校承辦人不可能裝 Python＋LibreOffice；GitHub Pages 免安裝、資料留在瀏覽器。但 openpyxl 版已驗證過與原表一致，捨棄可惜——改當 oracle：`tests/test_static_site.py::_assert_sheets_equal` 把 ExcelJS 產的 xlsx 用 openpyxl 讀回，與 Python 版**逐格比對**（值、公式、字型、對齊、框線、合併、欄寬、列高、頁面設定）。改版型兩邊都要改，測試抓不一致。
2. **靜態版 PDF 走瀏覽器列印而非 jsPDF**：標楷體（DFKai-SB）是微軟授權字型，不能內嵌進公開網站；教育部 TW-Kai 約 10MB 且要重排版。瀏覽器列印在 Windows 上有標楷體，輸出與 LibreOffice 版幾乎一致（`scripts/render_site_print.py` 以 Chromium `page.pdf()` 驗證過）。
3. **「記住上次內容」三層**：(a) 每次輸入 debounce 300ms 寫 localStorage（key `salary-note-v2`）；(b) 匯出／匯入 JSON；(c) 產出的 xlsx 內藏隱藏工作表 `_salary_note_data`（A2 = JSON）——學校電腦常設「登出清瀏覽器資料」，(c) 讓「把上月 Excel 拖回網頁」就能還原，最符合承辦人習慣。
4. **請假扣薪以正數輸入**，公式 `=C+D+E-F`（原表 `SUM(C:F)` 要使用者自己填負數，易錯）。
5. **總計大寫由程式產字串**（calc.py／calc.js 各自實作、測試互相對照），不用 Excel `[DBNum2]` 格式——LibreOffice 轉 PDF 時 DBNum 走樣風險。
6. **xlsx 公式保留且帶 cached result**（ExcelJS `{formula, result}`）：學校事後可手動微調，Excel 開檔即顯示正確值。
7. **LINE 通知選「圖卡貼 LINE」不做 Messaging API 推送**：後者要官方帳號＋後端保管 token＋外師加好友；圖卡純前端零門檻，日後要升級 Flex Message 可直接沿用 `card.js` 的 `lines()` 資料層。
8. **site\ 不用打包工具、不用 ES module**：要能 file:// 雙擊直接開（離線備援），四支 JS UMD 掛全域，ExcelJS vendor 進 repo 不走 CDN。

## 踩過的坑與解法 (lessons learned)

| 坑 | 症狀 | 原因／解法 |
|----|------|------------|
| Bash 工具跑 Python 印中文 | 輸出全是 `�` | stdout 是 cp950；命令前加 `PYTHONIOENCODING=utf-8`（已寫入 user memory） |
| `soffice` 不在 Bash PATH | command not found | 用完整路徑 `/c/Program Files/LibreOffice/program/soffice.exe` |
| openpyxl `print_area` 讀回格式 | `'115.08'!$A$1:$Q$14` ≠ `A1:Q14` | 斷言改 `.endswith()` |
| Jinja `tojson` 中文轉 `\uXXXX` | 測試比對原文失敗 | 測試改成解析 JSON 再比對 |
| 使用者直接開 index.html／Live Preview | `{{ version }}` 原字、按鈕全死 | 第一行 `JSON.parse('{{...}}')` 丟錯整段 JS 停掉。加「未經伺服器」紅字警告＋`window.onerror` 顯示到狀態列 |
| 使用者在 System32 打 `.venv\Scripts\python.exe` | CommandNotFound | 相對路徑問題 → `start-server.bat` 用 `%~dp0` 自動 cd |
| ExcelJS 相鄰同寬欄合寫 `<col min max>` | openpyxl 只掛第一欄，E 欄寬變預設 13 | 測試用 `dim.min..dim.max` 展開再比 |
| Playwright `page.evaluate("window.print = () => …")` | stub 一設就先被呼叫一次 | evaluate 對「值是函式」的運算式會自動呼叫；一律包 `() => { ... }`（已寫入 user memory） |
| Python 非 raw 字串改 .md | `\t`→tab、`\v`→VT、`\r`→CR（再被 universal newline 變真換行） | 改文件腳本一律 raw 字串；改完 `grep -P "[\t\x0b\x0c\r]"` 檢查（已寫入 user memory） |
| Pages 首次 push 的 workflow 失敗 | `configure-pages: Not Found` | push 當下 Pages 尚未啟用；先 `gh api -X POST repos/.../pages -f build_type=workflow` 再 `gh workflow run pages.yml` |
| GitHub Pages 快取 10 分鐘 | 使用者拿到新 index.html＋舊 app.js，新區塊空白 | script 加 `?v=N` 版本號，改任何 site JS 就把 N 加一（規則在 CLAUDE.md） |
| 原表勞保自付 616 對不上 1145×16/30=611 | 換算驗證差 5 元 | 原表用 1155 當基數（月中費率不同）；UI 換算法要填 1155，已提醒使用者向學校確認 |

## 目前架構速覽

```
salary-note\
├── site\                     ← 交付物（GitHub Pages 部署這裡）
│   ├── index.html            表單 UI＋列印版型 CSS＋圖卡彈窗（script 帶 ?v=N）
│   ├── calc.js               計算／大寫／期間（UMD，Node 可 require）
│   ├── xlsx.js               ExcelJS 產兩份 xlsx＋內藏設定（_salary_note_data）
│   ├── print.js              清冊（橫式）／通知單（直式）列印 HTML
│   ├── card.js               LINE 圖卡（lines() 純資料 → draw() Canvas → PNG）
│   ├── app.js                表單、localStorage 自動記憶、匯出入、下載、列印、彈窗
│   └── vendor\exceljs.min.js
├── src\salary_note\          Python 對照答案（FastAPI＋openpyxl＋LO 轉 PDF）
├── server.py / start-server.bat
├── tests\                    62 項：calc 24＋files 10＋app 5＋e2e 6＋static 18（部分含 skipif）
├── scripts\render_*.py       headless 產 PDF/PNG 目視檢查
└── .github\workflows\pages.yml  push main → 部署 site\
```

資料流（靜態版）：表單 → `collect()` payload → `SalaryCalc.computePayroll` → 即時預覽／`SalaryXlsx` 下載 xlsx／`SalaryPrint` 列印／`SalaryCard` 圖卡；payload 同步進 localStorage 與 xlsx 隱藏工作表。

## 已知未解 / 後續方向

- 全月時英文月份寫法（現為 `September 2026`）待學校確認。
- 機票補助印領清冊（原表 `114.07機票` 工作表）未做。
- LINE Messaging API 推送（方案 B）未做；`card.js lines()` 可直接翻 Flex Message。
- 勞保自付換算基數 616 vs 611 之謎待學校說明。
- repo 在 `D:\Work` 底下但已推上 GitHub（違反「上 GitHub 的放 D:\Dev」慣例）；使用者知情，日後可 clone 到 `D:\Dev\salary-note` 歸位。

## 給接手伙伴的 5 條最重要 invariant

1. **改計算或版型必須同時改 Python 版與 site\ JS 版**——`test_static_site.py` 逐格比對會紅，這是刻意的。
2. **改任何 site\ 下的 JS，`index.html` 的 `?v=N` 就要加一**，否則線上使用者會拿到新舊混搭。
3. **薪資資料永遠不落地伺服器**：靜態版一切在瀏覽器內；不要為了方便加任何回傳。
4. **客戶真實姓名不進 git**：測試與範例一律 `Sample Teacher`；金額可留（驗證用）。
5. **請假扣薪是正數**、預扣稅基＝薪資＋住宿（不含交通）、健保不按天換算、勞保／勞退按 `天數/30`——這些規則來自學校原表，改前先問學校。
