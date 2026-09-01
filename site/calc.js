/* calc.js — 純計算（不碰 DOM），瀏覽器與 Node 共用。
 * 規則與 Python 版 src/salary_note/{models,calc,numerals}.py 完全相同，tests/test_static_site.py 會逐項對照。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SalaryCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const INSURANCE_DAY_BASE = 30;

  const NUM_FIELDS = ['salary', 'housing', 'transport', 'leave_deduction', 'labor_ins_employer',
    'health_ins_employer', 'pension_employer', 'labor_ins_self', 'health_ins_self', 'health_check'];

  function roundHalfUp(x) { return Math.floor(x + 0.5 + 1e-9); }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function daysInMonth(adYear, month) { return new Date(adYear, month, 0).getDate(); }

  /** 期間資訊；輸入不合法時 valid=false 並附 error。 */
  function periodInfo(p) {
    const roc = Number(p.roc_year), month = Number(p.month);
    const start = Number(p.start_day) || 1;
    if (!(roc >= 100 && roc <= 200)) return { valid: false, error: '民國年要在 100–200 之間' };
    if (!(month >= 1 && month <= 12)) return { valid: false, error: '月份要在 1–12 之間' };
    const ad = roc + 1911;
    const dim = daysInMonth(ad, month);
    const end = (p.end_day === '' || p.end_day === null || p.end_day === undefined) ? dim : Number(p.end_day);
    const info = {
      valid: true, roc_year: roc, month, ad_year: ad, days_in_month: dim, start_day: start, end_day: end,
      days: end - start + 1, is_partial: start !== 1 || end !== dim,
      label_zh: `${roc}年${pad2(month)}月份`, file_tag: `${roc}.${pad2(month)}`,
    };
    if (end > dim) return { valid: false, error: `迄日 ${end} 超過當月天數 ${dim}` };
    if (start < 1 || start > end) return { valid: false, error: '起日不可晚於迄日' };
    info.label_en = info.is_partial ? `${MONTH_EN[month - 1]} ${start}-${end}, ${ad}` : `${MONTH_EN[month - 1]} ${ad}`;
    info.ratio_label = `${info.days}/${dim}`;
    info.insurance_ratio_label = `${info.days}/${INSURANCE_DAY_BASE}`;
    return info;
  }

  function prorate(period, amount) { return roundHalfUp(amount * period.days / period.days_in_month); }
  function prorateInsurance(period, amount) { return roundHalfUp(amount * period.days / INSURANCE_DAY_BASE); }

  function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

  function normalizeTeacher(t) {
    const out = {
      name: String(t.name || '').trim(),
      grade: (t.grade === '' || t.grade === null || t.grade === undefined) ? null : Number(t.grade),
      contract: String(t.contract || '').trim(),
      office: String(t.office || 'Academic Affairs Office').trim(),
      job_title: String(t.job_title || 'Teacher').trim(),
      tax_rate_pct: (t.tax_rate_pct === '' || t.tax_rate_pct === null || t.tax_rate_pct === undefined) ? 5 : Number(t.tax_rate_pct),
    };
    for (const k of NUM_FIELDS) out[k] = num(t[k]);
    return out;
  }

  /** 一位外師：換算後入表金額＋所有計算欄。 */
  function computeTeacher(rawT, period, prorateFlag) {
    const t = normalizeTeacher(rawT);
    const doP = !!prorateFlag && period.is_partial;
    const pay = (x) => doP ? prorate(period, x) : x;
    const ins = (x) => doP ? prorateInsurance(period, x) : x;
    const c = Object.assign({}, t, {
      salary: pay(t.salary), housing: pay(t.housing), transport: pay(t.transport),
      labor_ins_employer: ins(t.labor_ins_employer), pension_employer: ins(t.pension_employer),
      labor_ins_self: ins(t.labor_ins_self),
    });
    c.subtotal = c.salary + c.housing + c.transport - c.leave_deduction;           // G
    c.gross = c.subtotal + c.labor_ins_employer + c.health_ins_employer + c.pension_employer; // K
    c.tax = Math.floor((c.salary + c.housing) * c.tax_rate_pct / 100 + 1e-9);      // L ROUNDDOWN
    c.deductions = c.tax + c.labor_ins_self + c.health_ins_self;                   // O
    c.net = c.subtotal - c.deductions;                                             // P
    c.gross_with_extras = c.gross + c.health_check;
    c.net_with_extras = c.net + c.health_check;                                    // 通知單實發
    c.remark = c.contract ? `聘期\n${c.contract}` : '';
    return c;
  }

  function computePayroll(payload) {
    const period = periodInfo(payload.period || {});
    if (!period.valid) throw new Error(period.error);
    const teachers = (payload.teachers || []).map((t) => computeTeacher(t, period, payload.prorate));
    if (!teachers.length) throw new Error('至少要有一位外師');
    const rates = new Set(teachers.map((t) => t.tax_rate_pct));
    const total_gross = teachers.reduce((s, t) => s + t.gross_with_extras, 0);
    const total_net = teachers.reduce((s, t) => s + t.net_with_extras, 0);
    return {
      period, teachers, total_gross, total_net,
      total_gross_upper: toChineseUpper(total_gross),
      common_tax_rate_pct: rates.size === 1 ? [...rates][0] : null,
      school_name: payload.school_name || '嘉義市立嘉義國民中學',
      roster_title_suffix: payload.roster_title_suffix || '外籍英語教師薪資印領清冊',
      statement_title_zh: payload.statement_title_zh || '嘉義市嘉義國中外籍教師鐘點通知單',
      statement_title_en: payload.statement_title_en || 'CYJH Salary Statement',
      get roster_title() { return `${this.school_name}${this.period.label_zh}${this.roster_title_suffix}`; },
    };
  }

  // ---------- 金額大寫（對應 Excel [DBNum2]） ----------
  const DIGITS = '零壹貳參肆伍陸柒捌玖';
  const UNITS = ['', '拾', '佰', '仟'];
  const BIG = ['', '萬', '億', '兆'];

  function group4(g) {
    let out = '', started = false, pendingZero = false;
    for (const pos of [3, 2, 1, 0]) {
      const d = Math.floor(g / 10 ** pos) % 10;
      if (d === 0) { if (started) pendingZero = true; continue; }
      if (pendingZero) { out += '零'; pendingZero = false; }
      out += DIGITS[d] + UNITS[pos];
      started = true;
    }
    return out;
  }

  function toChineseUpper(n) {
    n = Math.trunc(n);
    if (n < 0) return '負' + toChineseUpper(-n);
    if (n === 0) return '零';
    const groups = [];
    for (let m = n; m > 0; m = Math.floor(m / 10000)) groups.push(m % 10000);
    const top = groups.length - 1;
    let out = '', gap = false;
    for (let gi = top; gi >= 0; gi--) {
      const g = groups[gi];
      if (g === 0) { if (gi < top) gap = true; continue; }
      let part = group4(g);
      if (gi < top && (gap || g < 1000)) part = '零' + part;
      gap = false;
      out += part + BIG[gi];
    }
    return out;
  }

  function deductionText(t) {
    const f = (x) => x.toLocaleString('en-US');
    return `${f(t.labor_ins_self)} (labor insurance)\n${f(t.health_ins_self)} (health insurance)\n${f(t.tax)} (withholding tax)\n= ${f(t.deductions)}`;
  }

  /** 通知單每列：[{zh, en, value, isNum, kind}]；健康檢查補助為 0 時不列。 */
  function statementRows(calc, t) {
    const rows = [
      { zh: '姓名', en: 'Name', value: t.name },
      { zh: '給薪月份', en: 'payment month', value: calc.period.label_en },
      { zh: '單位', en: 'Office', value: t.office },
      { zh: '職務', en: 'Job title', value: t.job_title },
      { zh: '本月薪資', en: 'Salary', value: t.salary, isNum: true },
      { zh: '住宿津貼', en: 'Housing allowance', value: t.housing, isNum: true },
      { zh: '交通津貼', en: 'Transportation allowance', value: t.transport, isNum: true },
      { zh: '應發金額', en: 'Due amount', value: t.subtotal, isNum: true },
      { zh: '扣款金額', en: 'Deduction', value: deductionText(t), kind: 'deduction' },
    ];
    if (t.health_check) rows.push({ zh: '健康檢查補助', en: 'health check reimbursement', value: t.health_check, isNum: true, kind: 'tall' });
    rows.push({ zh: '實發金額', en: 'Net Total', value: t.net_with_extras, isNum: true });
    return rows;
  }

  // ---------- 印領清冊表頭（xlsx 與列印共用） ----------
  const ROSTER_COLS = 'ABCDEFGHIJKLMNOPQ'.split('');
  const ROSTER_HEADERS = {
    A: '外師姓名', B: '薪級', C: '本月\n薪資', D: '住宿\n津貼', E: '交通費', F: '請假\n扣薪', G: '小計',
    H: '勞保\n機補', I: '健保\n機補', J: '勞退\n機補', K: '應發\n金額', L: '預扣\n稅額', M: '勞保\n自付',
    N: '健保\n自付', O: '代扣款\n小計', P: '實領\n金額', Q: '備註',
  };
  function rosterHeaders(calc) {
    const h = Object.assign({}, ROSTER_HEADERS);
    const p = calc.period;
    if (p.is_partial) {
      for (const c of ['C', 'D', 'E']) h[c] += `\n${p.ratio_label}`;
      for (const c of ['H', 'J', 'M']) h[c] += `\n${p.insurance_ratio_label}`;
    }
    if (calc.common_tax_rate_pct !== null) h.L += `\n${calc.common_tax_rate_pct}%`;
    return h;
  }

  /** 預設期間：上個月。 */
  function defaultPeriod(today) {
    const d = today ? new Date(today) : new Date();
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const prev = new Date(first.getTime() - 86400000);
    return { roc_year: prev.getFullYear() - 1911, month: prev.getMonth() + 1, start_day: 1, end_day: '' };
  }

  return { MONTH_EN, NUM_FIELDS, ROSTER_COLS, ROSTER_HEADERS, roundHalfUp, periodInfo, prorate, prorateInsurance,
    normalizeTeacher, computeTeacher, computePayroll, toChineseUpper, deductionText, statementRows, rosterHeaders,
    defaultPeriod };
});
