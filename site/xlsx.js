/* xlsx.js — 用 ExcelJS 在瀏覽器產生「印領清冊」與「鐘點通知單」xlsx。
 * 版型（欄寬、列高、字型、框線、公式、頁面設定）對照 Python 版 src/salary_note/roster.py、statement.py，
 * tests/test_static_site.py 會把兩邊產出的 xlsx 逐格比對。
 * 另外把整份輸入資料塞進一個隱藏工作表，之後把這個 xlsx 拖回網頁就能全部帶入。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./vendor/exceljs.min.js'), require('./calc.js'));
  else root.SalaryXlsx = factory(root.ExcelJS, root.SalaryCalc);
})(typeof self !== 'undefined' ? self : this, function (ExcelJS, SalaryCalc) {
  'use strict';

  const KAI = '標楷體', TNR = 'Times New Roman', NUM = '#,##0';
  const THIN = { style: 'thin' };
  const BOX = { top: THIN, left: THIN, bottom: THIN, right: THIN };
  const CENTER = { horizontal: 'center', vertical: 'middle' };
  const CENTER_WRAP = { horizontal: 'center', vertical: 'middle', wrapText: true };
  const LEFT = { horizontal: 'left', vertical: 'middle' };
  const LEFT_WRAP = { horizontal: 'left', vertical: 'middle', wrapText: true };
  const COLS = SalaryCalc.ROSTER_COLS;
  const COL_WIDTHS = { A: 22.9, B: 5.9, C: 8.5, D: 8.4, E: 8.4, F: 6.6, G: 8.5, H: 7.5, I: 7.5, J: 8.4, K: 9.5, L: 7.5, M: 7.5, N: 8.4, O: 8.9, P: 10.4, Q: 13.6 };
  const DATA_SHEET = '_salary_note_data';
  const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  function put(ws, ref, value, opts) {
    const { font, align = CENTER, fmt, border = BOX } = opts || {};
    const c = ws.getCell(ref);
    c.value = value;
    if (font) c.font = font;
    c.alignment = align;
    if (fmt) c.numFmt = fmt;
    if (border) c.border = border;
    return c;
  }
  function boxRow(ws, row) { for (const col of COLS) ws.getCell(`${col}${row}`).border = BOX; }
  function rateLiteral(pct) { return String(pct / 100); } // 5 → "0.05"

  // ---------- 印領清冊 ----------
  function buildRoster(calc) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(calc.period.file_tag);
    for (const [col, w] of Object.entries(COL_WIDTHS)) ws.getColumn(col).width = w;

    ws.getRow(1).height = 39;
    ws.mergeCells('A1:Q1');
    put(ws, 'A1', calc.roster_title, { font: { name: KAI, size: 22, bold: true }, border: null });
    ws.getRow(2).height = 20;

    ws.getRow(3).height = 53.45;
    for (const [col, text] of Object.entries(SalaryCalc.rosterHeaders(calc))) {
      put(ws, `${col}3`, text, { font: { name: KAI, size: 12 }, align: CENTER_WRAP });
    }

    const num = { name: TNR, size: 12 };
    let row = 4;
    const firstData = row;
    for (const t of calc.teachers) {
      ws.getRow(row).height = 52.7;
      boxRow(ws, row);
      put(ws, `A${row}`, t.name, { font: num });
      put(ws, `B${row}`, t.grade, { font: num, fmt: NUM });
      for (const [col, val] of [['C', t.salary], ['D', t.housing], ['E', t.transport], ['F', t.leave_deduction],
        ['H', t.labor_ins_employer], ['I', t.health_ins_employer], ['J', t.pension_employer],
        ['M', t.labor_ins_self], ['N', t.health_ins_self]]) {
        put(ws, `${col}${row}`, val, { font: num, fmt: NUM });
      }
      const rate = rateLiteral(t.tax_rate_pct);
      put(ws, `G${row}`, { formula: `C${row}+D${row}+E${row}-F${row}`, result: t.subtotal }, { font: num, fmt: NUM });
      put(ws, `K${row}`, { formula: `SUM(G${row}:J${row})`, result: t.gross }, { font: num, fmt: NUM });
      put(ws, `L${row}`, { formula: `ROUNDDOWN((C${row}+D${row})*${rate},0)`, result: t.tax }, { font: num, fmt: NUM });
      put(ws, `O${row}`, { formula: `SUM(L${row}:N${row})`, result: t.deductions }, { font: num, fmt: NUM });
      put(ws, `P${row}`, { formula: `G${row}-O${row}`, result: t.net }, { font: num, fmt: NUM });
      put(ws, `Q${row}`, t.remark || null, { font: { name: KAI, size: 10 }, align: LEFT_WRAP });
      row++;
      if (t.health_check) {
        ws.getRow(row).height = 31.35;
        boxRow(ws, row);
        put(ws, `K${row}`, t.health_check, { font: num, fmt: NUM });
        put(ws, `P${row}`, t.health_check, { font: num, fmt: NUM });
        put(ws, `Q${row}`, '健康檢查費用', { font: { name: KAI, size: 12 }, align: LEFT_WRAP });
        row++;
      }
    }
    ws.getRow(row).height = 31.35; // 空一列（原表習慣）
    boxRow(ws, row);
    const lastData = row;
    row++;

    ws.getRow(row).height = 31.35; // 總計（數字）
    boxRow(ws, row);
    put(ws, `A${row}`, '總計', { font: { name: KAI, size: 12 } });
    put(ws, `K${row}`, { formula: `SUM(K${firstData}:K${lastData})`, result: calc.total_gross }, { font: num, fmt: NUM });
    put(ws, `P${row}`, { formula: `SUM(P${firstData}:P${lastData})`, result: calc.total_net }, { font: num, fmt: NUM });
    row++;

    ws.getRow(row).height = 31.35; // 總計（大寫）
    boxRow(ws, row);
    put(ws, `A${row}`, '總計', { font: { name: KAI, size: 12 }, align: CENTER_WRAP });
    ws.mergeCells(`B${row}:O${row}`);
    put(ws, `B${row}`, calc.total_gross_upper, { font: { name: KAI, size: 14 } });
    put(ws, `P${row}`, '元整', { font: { name: KAI, size: 12 } });
    const upper = row;

    for (const [off, h] of [[1, 28.5], [2, 24], [3, 24], [4, 19.5], [5, 49.35], [6, 23.25]]) ws.getRow(upper + off).height = h;
    const sig = { name: KAI, size: 14 };
    for (const [col, text] of Object.entries({ A: '教學組長', F: '出納組長', L: '會計室' })) {
      put(ws, `${col}${upper + 4}`, text, { font: sig, align: LEFT, border: null });
    }
    for (const [col, text] of Object.entries({ A: '教務主任', F: '總務主任', L: '校長' })) {
      put(ws, `${col}${upper + 6}`, text, { font: sig, align: LEFT, border: null });
    }
    const last = upper + 6;

    ws.pageSetup = {
      paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1,
      horizontalCentered: true, printArea: `A1:Q${last}`,
      margins: { left: 0.31, right: 0.31, top: 0.75, bottom: 0.35, header: 0.3, footer: 0.3 },
    };
    return wb;
  }

  // ---------- 鐘點通知單 ----------
  function sheetTitle(name, used) {
    const base = name.replace(/[\[\]:*?/\\]/g, ' ').trim().slice(0, 28) || 'Statement';
    let title = base, n = 2;
    while (used.has(title)) { title = `${base.slice(0, 25)} (${n})`; n++; }
    used.add(title);
    return title;
  }
  function bilingual(zh, en, size) {
    size = size || 12;
    return { richText: [{ font: { name: KAI, size }, text: zh + '\n' }, { font: { name: TNR, size }, text: en }] };
  }

  function buildStatements(calc) {
    const wb = new ExcelJS.Workbook();
    const used = new Set();
    for (const t of calc.teachers) {
      const ws = wb.addWorksheet(sheetTitle(t.name, used));
      ws.getColumn('A').width = 26;
      ws.getColumn('B').width = 34;
      ws.getRow(1).height = 60;
      ws.mergeCells('A1:B1');
      put(ws, 'A1', bilingual(calc.statement_title_zh, calc.statement_title_en, 14), { font: { name: KAI, size: 14 }, align: CENTER_WRAP });
      ws.getCell('B1').border = BOX;
      let row = 2;
      for (const r of SalaryCalc.statementRows(calc, t)) {
        ws.getRow(row).height = r.kind === 'deduction' ? 100 : r.kind === 'tall' ? 58 : 44;
        put(ws, `A${row}`, bilingual(r.zh, r.en), { font: { name: KAI, size: 12 }, align: CENTER_WRAP });
        put(ws, `B${row}`, r.value, { font: { name: TNR, size: 12 }, align: CENTER_WRAP, fmt: r.isNum ? NUM : undefined });
        row++;
      }
      ws.pageSetup = {
        paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1,
        horizontalCentered: true, printArea: `A1:B${row - 1}`,
        margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
      };
    }
    return wb;
  }

  // ---------- 內藏設定（讓 xlsx 可以拖回網頁帶入） ----------
  function attachData(wb, payload) {
    const ws = wb.addWorksheet(DATA_SHEET, { state: 'hidden' });
    ws.getCell('A1').value = 'salary-note settings — 供網頁匯入用，請勿修改';
    ws.getCell('A2').value = JSON.stringify({ app: 'salary-note', version: 1, saved_at: new Date().toISOString(), payload });
    return wb;
  }
  async function readData(arrayBuffer) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer);
    const ws = wb.getWorksheet(DATA_SHEET);
    if (!ws) return null;
    const v = ws.getCell('A2').value;
    const s = typeof v === 'string' ? v : (v && v.richText ? v.richText.map((r) => r.text).join('') : String(v || ''));
    try { return JSON.parse(s).payload || null; } catch (e) { return null; }
  }
  async function toBlob(wb) {
    const buf = await wb.xlsx.writeBuffer();
    return new Blob([buf], { type: XLSX_MIME });
  }
  async function toBase64(wb) {
    const bytes = new Uint8Array(await wb.xlsx.writeBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  return { DATA_SHEET, COL_WIDTHS, buildRoster, buildStatements, attachData, readData, toBlob, toBase64 };
});
