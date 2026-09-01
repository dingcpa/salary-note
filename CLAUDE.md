# CLAUDE.md

（共用資料夾規則見上層 `D:\Dev\CLAUDE.md`，此處只寫本專案特有的事）

## 專案目的

嘉義市立嘉義國民中學外籍英語教師薪資套版產生器：在網頁表單填入期間與每位外師的薪資項目，一鍵產出「外籍英語教師薪資印領清冊」與「外籍教師鐘點通知單（CYJH Salary Statement）」的 xlsx 與 pdf。

## 如何啟動

```
.venv\Scripts\python.exe server.py      # http://127.0.0.1:8765
.venv\Scripts\python.exe -m pytest -q   # 測試
```

- Python 3.12 venv（`py -3.12 -m venv .venv`；套件見 `requirements*.txt`）
- PDF 轉檔靠 LibreOffice headless：預設找 `C:\Program Files\LibreOffice\program\soffice.exe`，可用 `.env` 的 `SOFFICE_PATH` 覆蓋
- 產出放 `data\output\{時間戳}_{民國年月}\`，可用 `OUTPUT_DIR` 覆蓋

## 本專案特有慣例

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
