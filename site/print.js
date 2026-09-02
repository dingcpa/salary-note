/* print.js — 把印領清冊／通知單排成 HTML，給畫面預覽與「列印 → 另存為 PDF」用。
 * 尺寸對照 Excel 版型：欄寬按 Excel 字元寬比例、列高由 pt 換成 mm（1pt = 0.3528mm）。
 */
(function (root, factory) {
  root.SalaryPrint = factory(root.SalaryCalc);
})(typeof self !== 'undefined' ? self : this, function (SalaryCalc) {
  'use strict';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nl = (s) => esc(s).replace(/\n/g, '<br>');
  const f = (n) => Number(n).toLocaleString('en-US');
  const COLW = [22.9, 5.9, 8.5, 8.4, 8.4, 6.6, 8.5, 7.5, 7.5, 8.4, 9.5, 7.5, 7.5, 8.4, 8.9, 10.4, 13.6];
  const TOTAL_W = COLW.reduce((a, b) => a + b, 0);
  const pct = (w) => `${(w / TOTAL_W * 100).toFixed(2)}%`;
  const td = (v, cls) => `<td${cls ? ` class="${cls}"` : ''}>${v}</td>`;
  const empties = (n) => '<td></td>'.repeat(n);

  function rosterHtml(calc) {
    const h = SalaryCalc.rosterHeaders(calc);
    const colgroup = `<colgroup>${COLW.map((w) => `<col style="width:${pct(w)}">`).join('')}</colgroup>`;
    let rows = `<tr class="hdr">${SalaryCalc.ROSTER_COLS.map((c) => `<th>${nl(h[c])}</th>`).join('')}</tr>`;
    for (const t of calc.teachers) {
      rows += '<tr class="t">' +
        td(esc(t.name)) + td(t.grade == null ? '' : t.grade) +
        [t.salary, t.housing, t.transport, t.leave_deduction, t.subtotal, t.labor_ins_employer, t.health_ins_employer,
          t.pension_employer, t.gross, t.tax, t.labor_ins_self, t.health_ins_self, t.deductions, t.net].map((v) => td(f(v))).join('') +
        td(nl(t.remark), 'remark') + '</tr>';
      if (t.health_check) {
        rows += `<tr class="x">${empties(10)}${td(f(t.health_check))}${empties(4)}${td(f(t.health_check))}${td('健康檢查費用', 'remark2')}</tr>`;
      }
    }
    rows += `<tr class="x">${empties(17)}</tr>`;
    rows += `<tr class="x">${td('總計', 'zh')}${empties(9)}${td(f(calc.total_gross))}${empties(4)}${td(f(calc.total_net))}<td></td></tr>`;
    rows += `<tr class="x">${td('總計', 'zh')}<td colspan="14" class="upper">${esc(calc.total_gross_upper)}</td>${td('元整', 'zh')}<td></td></tr>`;
    // 核章欄兩列各三位、分散對齊：位置對照 Excel 欄 A / I / Q 的左緣（I 欄起點約在全寬一半）
    const left = (i) => pct(COLW.slice(0, i).reduce((a, b) => a + b, 0));
    return `<section class="doc roster">
  <h1>${esc(calc.roster_title)}</h1>
  <table>${colgroup}${rows}</table>
  <div class="sig"><span style="left:${left(0)}">教學組長</span><span style="left:${left(8)}">出納組長</span><span style="left:${left(16)}">會計室</span></div>
  <div class="sig sig2"><span style="left:${left(0)}">教務主任</span><span style="left:${left(8)}">總務主任</span><span style="left:${left(16)}">校長</span></div>
</section>`;
  }

  function statementHtml(calc) {
    return calc.teachers.map((t) => {
      const rows = SalaryCalc.statementRows(calc, t).map((r) =>
        `<tr class="${r.kind || ''}"><th><span class="zh">${esc(r.zh)}</span><br><span class="en">${esc(r.en)}</span></th>` +
        `<td>${r.isNum ? f(r.value) : nl(r.value)}</td></tr>`).join('');
      return `<section class="doc statement">
  <table>
    <colgroup><col style="width:43%"><col style="width:57%"></colgroup>
    <tr class="title"><th colspan="2"><span class="zh">${esc(calc.statement_title_zh)}</span><br><span class="en">${esc(calc.statement_title_en)}</span></th></tr>
    ${rows}
  </table>
</section>`;
    }).join('\n');
  }

  return { rosterHtml, statementHtml };
});
