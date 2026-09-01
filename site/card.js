/* card.js — LINE 風格的薪資通知圖卡（Canvas → PNG），承辦人貼到 LINE 給外師。
 * lines() 只回傳純資料（測試用），draw() 負責畫。輸出寬 1440px（720 CSS px × 2）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./calc.js'));
  else root.SalaryCard = factory(root.SalaryCalc);
})(typeof self !== 'undefined' ? self : this, function (SalaryCalc) {
  'use strict';

  const W = 720;
  const SCALE = 2;
  const M = 20;      // 卡片外的留白
  const PAD = 36;    // 卡片內距
  const FONT = '"Segoe UI", "Microsoft JhengHei", "Noto Sans TC", "PingFang TC", "Helvetica Neue", Arial, sans-serif';
  const H = { header: 112, id: 92, section: 42, item: 38, total: 50, net: 104, foot: 44 };
  const f = (n) => Number(n).toLocaleString('en-US');

  /** 卡片內容（純資料）。kind: section / item / total / net；value 負數＝扣款，plus＝顯示 + 號。 */
  function lines(calc, t) {
    const rows = [];
    rows.push({ kind: 'section', en: 'Earnings', zh: '應發' });
    rows.push({ kind: 'item', en: 'Salary', zh: '本月薪資', value: t.salary });
    rows.push({ kind: 'item', en: 'Housing allowance', zh: '住宿津貼', value: t.housing });
    rows.push({ kind: 'item', en: 'Transportation allowance', zh: '交通津貼', value: t.transport });
    if (t.leave_deduction) rows.push({ kind: 'item', en: 'Leave deduction', zh: '請假扣薪', value: -t.leave_deduction });
    rows.push({ kind: 'total', en: 'Due amount', zh: '應發金額', value: t.subtotal });
    rows.push({ kind: 'section', en: 'Deductions', zh: '扣款' });
    rows.push({ kind: 'item', en: 'Labor insurance', zh: '勞保自付', value: -t.labor_ins_self });
    rows.push({ kind: 'item', en: 'Health insurance', zh: '健保自付', value: -t.health_ins_self });
    rows.push({ kind: 'item', en: `Withholding tax (${t.tax_rate_pct}%)`, zh: '預扣稅額', value: -t.tax });
    rows.push({ kind: 'total', en: 'Deduction', zh: '扣款金額', value: -t.deductions });
    if (t.health_check) {
      rows.push({ kind: 'section', en: 'Other', zh: '其他' });
      rows.push({ kind: 'item', en: 'Health check reimbursement', zh: '健康檢查補助', value: t.health_check, plus: true });
    }
    rows.push({ kind: 'net', en: 'Net Total', zh: '實發金額', value: t.net_with_extras });
    return rows;
  }

  function money(v, plus) {
    const s = f(Math.abs(v));
    return v < 0 ? '−' + s : (plus ? '+' + s : s);
  }
  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function hr(ctx, x1, x2, y) {
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y + 0.5);
    ctx.lineTo(x2, y + 0.5);
    ctx.stroke();
  }
  function labelPair(ctx, en, zh, x, y, enFont, enColor) {
    ctx.textAlign = 'left';
    ctx.font = enFont;
    ctx.fillStyle = enColor;
    ctx.fillText(en, x, y);
    const w = ctx.measureText(en).width;
    ctx.font = `13px ${FONT}`;
    ctx.fillStyle = '#9aa3ad';
    ctx.fillText(zh, x + w + 8, y + 1);
  }

  function height(rows) {
    return H.header + H.id + rows.reduce((s, r) => s + H[r.kind], 0) + H.foot;
  }

  /** 把一位外師的圖卡畫到 canvas（沒給就新建），回傳 canvas。 */
  function draw(calc, t, canvas) {
    const rows = lines(calc, t);
    const cw = W - 2 * M;
    const ch = height(rows);
    const totalH = ch + 2 * M;
    canvas = canvas || document.createElement('canvas');
    canvas.width = W * SCALE;
    canvas.height = totalH * SCALE;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#eef1f5';
    ctx.fillRect(0, 0, W, totalH);

    // 卡片（含陰影）
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.14)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 5;
    roundRectPath(ctx, M, M, cw, ch, 22);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();

    // 深色抬頭（裁成圓角）
    ctx.save();
    roundRectPath(ctx, M, M, cw, ch, 22);
    ctx.clip();
    ctx.fillStyle = '#1c2b3a';
    ctx.fillRect(M, M, cw, H.header);
    ctx.restore();

    const L = M + PAD, R = M + cw - PAD;
    let y = M;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.font = `600 26px ${FONT}`;
    ctx.fillText(calc.statement_title_en, L, y + 44);
    ctx.font = `15px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fillText(calc.statement_title_zh, L, y + 76);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = `600 18px ${FONT}`;
    ctx.fillText(calc.period.label_en, R, y + 44);
    ctx.font = `13px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fillText('payment month 給薪月份', R, y + 72);
    y += H.header;

    // 身分
    ctx.textAlign = 'left';
    ctx.fillStyle = '#111';
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText(t.name, L, y + 38);
    ctx.fillStyle = '#666';
    ctx.font = `15px ${FONT}`;
    ctx.fillText(`${t.office} · ${t.job_title}`, L, y + 68);
    y += H.id;
    hr(ctx, L, R, y);

    for (const r of rows) {
      const h = H[r.kind];
      if (r.kind === 'section') {
        labelPair(ctx, r.en.toUpperCase(), r.zh, L, y + h / 2 + 6, `700 13px ${FONT}`, '#1f5fbf');
      } else if (r.kind === 'item' || r.kind === 'total') {
        const bold = r.kind === 'total';
        if (bold) hr(ctx, L, R, y + 2);
        labelPair(ctx, r.en, r.zh, L, y + h / 2 + (bold ? 2 : 0), `${bold ? 600 : 400} 17px ${FONT}`, bold ? '#111' : '#333');
        ctx.textAlign = 'right';
        ctx.fillStyle = r.value < 0 ? '#b42318' : '#111';
        ctx.font = `${bold ? 700 : 500} 18px ${FONT}`;
        ctx.fillText(money(r.value, r.plus), R, y + h / 2 + (bold ? 2 : 0));
      } else if (r.kind === 'net') {
        const by = y + 14, bh = h - 18;
        roundRectPath(ctx, L - 12, by, R - L + 24, bh, 14);
        ctx.fillStyle = '#e8f7ee';
        ctx.fill();
        ctx.textAlign = 'left';
        ctx.fillStyle = '#0f6b31';
        ctx.font = `700 14px ${FONT}`;
        ctx.fillText('NET TOTAL', L + 6, by + bh / 2 - 12);
        ctx.font = `13px ${FONT}`;
        ctx.fillStyle = '#4a7c59';
        ctx.fillText(r.zh, L + 6, by + bh / 2 + 12);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#0f8a3c';
        ctx.font = `800 34px ${FONT}`;
        ctx.fillText('NT$ ' + f(r.value), R - 6, by + bh / 2);
      }
      y += h;
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#9aa3ad';
    ctx.font = `12px ${FONT}`;
    ctx.fillText(`${calc.school_name} · ${calc.period.label_zh}`, M + cw / 2, y + H.foot / 2 + 2);
    return canvas;
  }

  function toBlob(calc, t) {
    const c = draw(calc, t);
    return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('圖卡產生失敗'))), 'image/png'));
  }
  function fileName(calc, t) {
    const safe = t.name.replace(/[\\/:*?"<>|]/g, ' ').trim() || 'teacher';
    return `外師薪資通知圖卡_${calc.period.file_tag}_${safe}.png`;
  }

  return { W, SCALE, lines, height, draw, toBlob, fileName };
});
