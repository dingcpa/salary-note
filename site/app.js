/* app.js — 表單、自動記憶（localStorage）、匯出／匯入、下載 xlsx、列印。純前端，不需要伺服器。 */
(function () {
  'use strict';
  const STORE_KEY = 'salary-note-v2';
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Number(n).toLocaleString('en-US');
  const DEFAULT_TITLES = {
    school_name: '嘉義市立嘉義國民中學',
    statement_title_zh: '嘉義市嘉義國中外籍教師鐘點通知單',
    statement_title_en: 'CYJH Salary Statement',
  };
  const NUM_KEYS = SalaryCalc.NUM_FIELDS.concat(['grade', 'tax_rate_pct']);

  window.addEventListener('error', (e) => setStatus('頁面腳本錯誤：' + e.message, 'err'));
  window.addEventListener('unhandledrejection', (e) => setStatus('錯誤：' + (e.reason && e.reason.message || e.reason), 'err'));

  function setStatus(msg, cls) {
    const s = $('status');
    s.className = cls || '';
    s.textContent = msg || '';
  }

  // ---------- 外師區塊 ----------
  function addTeacher(data) {
    const node = $('teacherTpl').content.firstElementChild.cloneNode(true);
    $('teachers').appendChild(node);
    if (data) {
      for (const [k, v] of Object.entries(data)) {
        const inp = node.querySelector(`[data-k="${k}"]`);
        if (inp && v !== null && v !== undefined) inp.value = v;
      }
    }
    renumber();
    return node;
  }
  function renumber() {
    document.querySelectorAll('#teachers .teacher').forEach((t, i) => { t.querySelector('.idx').textContent = `外師 ${i + 1}`; });
  }
  function readTeacher(node) {
    const t = {};
    node.querySelectorAll('[data-k]').forEach((inp) => {
      const k = inp.dataset.k;
      if (NUM_KEYS.includes(k)) t[k] = inp.value === '' ? (k === 'grade' ? null : (k === 'tax_rate_pct' ? 5 : 0)) : Number(inp.value);
      else t[k] = inp.value.trim();
    });
    return t;
  }

  // ---------- 收集／套用／記憶 ----------
  function collect() {
    return {
      period: {
        roc_year: Number($('roc_year').value), month: Number($('month').value),
        start_day: Number($('start_day').value) || 1,
        end_day: $('end_day').value === '' ? '' : Number($('end_day').value),
      },
      school_name: $('school_name').value.trim() || DEFAULT_TITLES.school_name,
      statement_title_zh: $('statement_title_zh').value.trim() || DEFAULT_TITLES.statement_title_zh,
      statement_title_en: $('statement_title_en').value.trim() || DEFAULT_TITLES.statement_title_en,
      prorate: $('prorate').checked,
      teachers: [...document.querySelectorAll('#teachers .teacher')].map(readTeacher),
    };
  }
  function applyPayload(d) {
    d = d || {};
    const per = Object.assign(SalaryCalc.defaultPeriod(), d.period || {});
    $('roc_year').value = per.roc_year;
    $('month').value = per.month;
    $('start_day').value = per.start_day || 1;
    $('end_day').value = (per.end_day === null || per.end_day === undefined) ? '' : per.end_day;
    $('school_name').value = d.school_name || DEFAULT_TITLES.school_name;
    $('statement_title_zh').value = d.statement_title_zh || DEFAULT_TITLES.statement_title_zh;
    $('statement_title_en').value = d.statement_title_en || DEFAULT_TITLES.statement_title_en;
    $('prorate').checked = !!d.prorate;
    $('teachers').innerHTML = '';
    (Array.isArray(d.teachers) && d.teachers.length ? d.teachers : [null]).forEach((t) => addTeacher(t));
    renderAll();
  }
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { return null; }
  }
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(collect()));
      $('savedAt').textContent = '已自動記住 ' + new Date().toLocaleTimeString('zh-TW', { hour12: false });
    } catch (e) {
      $('savedAt').textContent = '⚠ 無法記住（瀏覽器封鎖了網站資料）';
    }
  }
  let saveTimer = null;
  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 300); }

  // ---------- 試算與預覽 ----------
  function currentCalc() {
    try {
      const c = SalaryCalc.computePayroll(collect());
      setStatus('');
      return c;
    } catch (e) {
      setStatus(e.message, 'err');
      return null;
    }
  }
  function renderPeriodHint() {
    const p = SalaryCalc.periodInfo(collect().period);
    $('periodHint').textContent = !p.valid ? '⚠ ' + p.error
      : p.is_partial
        ? `不足月：${p.roc_year}/${p.month}/${p.start_day}–${p.end_day}，共 ${p.days} 天；表頭會標示 ${p.ratio_label}（薪資類）與 ${p.insurance_ratio_label}（勞保／勞退）；通知單月份 ${p.label_en}`
        : `全月：${p.label_zh}，共 ${p.days_in_month} 天；通知單月份 ${p.label_en}`;
  }
  function renderTeacherPreviews(calc) {
    const nodes = document.querySelectorAll('#teachers .teacher');
    nodes.forEach((node, i) => {
      const t = calc && calc.teachers[i];
      if (!t) { node.querySelector('.preview').innerHTML = ''; return; }
      const pro = (calc.period.is_partial && $('prorate').checked)
        ? `<span>換算後薪資／住宿／交通 <b>${fmt(t.salary)} / ${fmt(t.housing)} / ${fmt(t.transport)}</b></span>` : '';
      node.querySelector('.preview').innerHTML = pro +
        `<span>小計 <b>${fmt(t.subtotal)}</b></span><span>應發 <b>${fmt(t.gross)}</b></span>` +
        `<span>預扣稅 <b>${fmt(t.tax)}</b></span><span>代扣款 <b>${fmt(t.deductions)}</b></span>` +
        `<span>實領 <b>${fmt(t.net)}</b></span><span>通知單實發 <b>${fmt(t.net_with_extras)}</b></span>`;
    });
  }
  function renderSummary(calc) {
    if (!calc) { $('summary').innerHTML = ''; return; }
    let html = '<tr><th>外師</th><th>小計</th><th>應發</th><th>預扣稅</th><th>代扣款</th><th>實領</th><th>通知單實發</th></tr>';
    for (const t of calc.teachers) {
      html += `<tr><td>${t.name || '（未填姓名）'}</td><td>${fmt(t.subtotal)}</td><td>${fmt(t.gross)}</td><td>${fmt(t.tax)}</td><td>${fmt(t.deductions)}</td><td>${fmt(t.net)}</td><td>${fmt(t.net_with_extras)}</td></tr>`;
    }
    html += `<tr><th>總計（含健檢）</th><th></th><th>${fmt(calc.total_gross)}</th><th></th><th></th><th>${fmt(calc.total_net)}</th><th></th></tr>`;
    html += `<tr><td colspan="7">應發總計大寫：${calc.total_gross_upper} 元整</td></tr>`;
    $('summary').innerHTML = html;
  }
  function renderDocs(calc) {
    $('preview').innerHTML = calc ? SalaryPrint.rosterHtml(calc) + SalaryPrint.statementHtml(calc) : '';
  }
  function renderAll() {
    renderPeriodHint();
    const calc = currentCalc();
    renderTeacherPreviews(calc);
    renderSummary(calc);
    renderDocs(calc);
    return calc;
  }

  // ---------- 下載／列印／匯出入 ----------
  function saveAs(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  function requireCalc() {
    const calc = renderAll();
    if (!calc) throw new Error('請先修正上面的錯誤');
    const missing = calc.teachers.findIndex((t) => !t.name);
    if (missing >= 0) throw new Error(`外師 ${missing + 1} 的姓名未填`);
    save();
    return calc;
  }
  async function download(kind) {
    const btn = kind === 'roster' ? $('dlRoster') : $('dlStatement');
    btn.disabled = true;
    try {
      const calc = requireCalc();
      const wb = kind === 'roster' ? SalaryXlsx.buildRoster(calc) : SalaryXlsx.buildStatements(calc);
      SalaryXlsx.attachData(wb, collect());
      const name = `${kind === 'roster' ? '外師薪資印領清冊' : '外師鐘點通知單'}_${calc.period.file_tag}.xlsx`;
      saveAs(await SalaryXlsx.toBlob(wb), name);
      setStatus(`已下載 ${name}`, 'ok');
    } catch (e) {
      setStatus(e.message, 'err');
    } finally {
      btn.disabled = false;
    }
  }
  function printDoc(kind) {
    try {
      const calc = requireCalc();
      $('print-root').innerHTML = kind === 'roster' ? SalaryPrint.rosterHtml(calc) : SalaryPrint.statementHtml(calc);
      let style = $('page-style');
      if (!style) { style = document.createElement('style'); style.id = 'page-style'; document.head.appendChild(style); }
      style.textContent = kind === 'roster'
        ? '@page { size: A4 landscape; margin: 8mm 8mm 6mm; }'
        : '@page { size: A4 portrait; margin: 18mm 18mm; }';
      window.print();
    } catch (e) {
      setStatus(e.message, 'err');
    }
  }
  // ---------- LINE 通知圖卡（彈窗預覽 → 截圖／下載／複製） ----------
  let cardUrls = [];
  function setCardStatus(msg, cls) {
    const s = $('cardStatus');
    s.className = cls || '';
    s.textContent = msg || '';
  }
  async function openCardModal() {
    try {
      const calc = requireCalc();
      const list = $('cardList');
      revokeCardUrls();
      list.innerHTML = '';
      for (let i = 0; i < calc.teachers.length; i++) {
        const t = calc.teachers[i];
        const url = URL.createObjectURL(await SalaryCard.toBlob(calc, t));
        cardUrls.push(url);
        const fig = document.createElement('figure');
        fig.className = 'cardFig';
        fig.dataset.i = String(i);
        fig.innerHTML = '<img><figcaption><span></span>' +
          '<button type="button" class="small dlCard">⬇ 下載 PNG</button>' +
          '<button type="button" class="small copyCard">📋 複製到剪貼簿</button></figcaption>';
        const img = fig.querySelector('img');
        img.src = url;
        img.alt = `${t.name} 通知圖卡`;
        fig.querySelector('figcaption span').textContent = t.name;
        list.appendChild(fig);
      }
      setCardStatus('');
      $('cardModal').hidden = false;
      document.body.classList.add('modal-open');
    } catch (e) {
      setStatus(e.message, 'err');
    }
  }
  function revokeCardUrls() {
    for (const u of cardUrls) URL.revokeObjectURL(u);
    cardUrls = [];
  }
  function closeCardModal() {
    revokeCardUrls();
    $('cardList').innerHTML = '';
    $('cardModal').hidden = true;
    document.body.classList.remove('modal-open');
  }
  async function cardAction(btn) {
    const i = Number(btn.closest('.cardFig').dataset.i);
    try {
      const calc = currentCalc();
      const t = calc && calc.teachers[i];
      if (!t) throw new Error('找不到這位外師的資料，請關閉後重新開啟圖卡');
      const blob = await SalaryCard.toBlob(calc, t);
      if (btn.classList.contains('dlCard')) {
        saveAs(blob, SalaryCard.fileName(calc, t));
        setCardStatus(`已下載 ${t.name} 的通知圖卡`, 'ok');
      } else {
        if (!navigator.clipboard || !navigator.clipboard.write || !window.ClipboardItem) {
          throw new Error('這個瀏覽器不支援複製圖片，請在圖片上按右鍵「複製圖片」或改用「下載 PNG」');
        }
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCardStatus(`已複製 ${t.name} 的通知圖卡，到 LINE 聊天視窗按 Ctrl+V 貼上`, 'ok');
      }
    } catch (e) {
      setCardStatus(e.message, 'err');
    }
  }
  function exportJson() {
    const payload = collect();
    const p = SalaryCalc.periodInfo(payload.period);
    const blob = new Blob([JSON.stringify({ app: 'salary-note', version: 1, saved_at: new Date().toISOString(), payload }, null, 2)], { type: 'application/json' });
    saveAs(blob, `外師薪資設定_${p.valid ? p.file_tag : 'backup'}.json`);
    setStatus('已匯出設定檔', 'ok');
  }
  async function importFile(file) {
    if (!file) return;
    try {
      let payload = null;
      if (/\.json$/i.test(file.name)) {
        const obj = JSON.parse(await file.text());
        payload = obj && obj.payload ? obj.payload : obj;
      } else {
        payload = await SalaryXlsx.readData(await file.arrayBuffer());
        if (!payload) throw new Error('這個 Excel 不是本網頁產生的（找不到內藏設定），無法帶入');
      }
      if (!payload || !Array.isArray(payload.teachers)) throw new Error('檔案格式不對');
      applyPayload(payload);
      save();
      setStatus(`已從 ${file.name} 帶入`, 'ok');
    } catch (e) {
      setStatus('匯入失敗：' + e.message, 'err');
    } finally {
      $('importFile').value = '';
    }
  }
  function clearAll() {
    if (!window.confirm('確定要清除所有欄位與記住的內容？')) return;
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
    applyPayload(null);
    $('savedAt').textContent = '';
    setStatus('已清除', 'ok');
  }

  // ---------- 綁定 ----------
  $('addTeacher').addEventListener('click', () => { addTeacher(null); renderAll(); scheduleSave(); });
  $('teachers').addEventListener('click', (ev) => {
    if (ev.target.classList.contains('remove')) {
      ev.target.closest('.teacher').remove();
      renumber(); renderAll(); scheduleSave();
    }
  });
  $('form').addEventListener('input', () => { renderAll(); scheduleSave(); });
  $('form').addEventListener('change', () => { renderAll(); scheduleSave(); });
  $('dlRoster').addEventListener('click', () => download('roster'));
  $('dlStatement').addEventListener('click', () => download('statement'));
  $('printRoster').addEventListener('click', () => printDoc('roster'));
  $('printStatement').addEventListener('click', () => printDoc('statement'));
  $('lineCardBtn').addEventListener('click', openCardModal);
  $('cardClose').addEventListener('click', closeCardModal);
  $('cardModal').addEventListener('click', (ev) => { if (ev.target === $('cardModal')) closeCardModal(); });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !$('cardModal').hidden) closeCardModal(); });
  $('cardList').addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (btn) cardAction(btn);
  });
  $('exportBtn').addEventListener('click', exportJson);
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', (ev) => importFile(ev.target.files[0]));
  $('clearBtn').addEventListener('click', clearAll);
  document.addEventListener('dragover', (ev) => { ev.preventDefault(); });
  document.addEventListener('drop', (ev) => { ev.preventDefault(); if (ev.dataTransfer.files[0]) importFile(ev.dataTransfer.files[0]); });

  // ---------- 啟動：帶入上次內容 ----------
  const saved = load();
  applyPayload(saved);
  if (saved) $('savedAt').textContent = '已帶入上次內容';
})();
