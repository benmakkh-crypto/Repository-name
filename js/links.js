/* روابط الحلقات: رابط لكل شهر + رابط لكل حلقة مع حالة رفع التوثيق */
renderBrand(true);
const LK = { phone:'', data:null, month:'' };
window.onLangChange = () => { if(LK.data) render(); };
applyLang();

async function copyText(txt, label){
  try { await navigator.clipboard.writeText(txt); toast(label || t('lkCopied')); }
  catch(e){ prompt('', txt); }
}

/* ينفّذ طلباً بطيئاً ثم ينسخ الرابط الناتج؛ الزر يبيّن «جارٍ التجهيز» */
async function fetchAndCopy(btn, fn, okMsg){
  const old = btn.textContent; btn.disabled = true; btn.textContent = t('lkWait');
  try { const r = await fn(); if(!r.url){ toast(t('lkNoFolder'), true); } else await copyText(r.url, okMsg ? okMsg(r) : ''); }
  catch(e){ toast(err(e), true); }
  btn.disabled = false; btn.textContent = old;
}

function renderMonths(){
  const box = $('#lkMonths'); box.innerHTML = '';
  LK.data.months.forEach((m, i) => {
    const total = LK.data.teachers.length, up = LK.data.teachers.filter(x => x.done[m] && x.done[m].p).length;
    const c = document.createElement('div'); c.className = 'card'; c.style.margin = '0';
    const h = document.createElement('h4'); h.textContent = monthBoth(m) + (i === 0 ? ' — ' + t('lkLast') : ''); c.appendChild(h);
    const s = document.createElement('p'); s.className = 'sub'; s.textContent = t('lkUploaded', up, total); c.appendChild(s);
    const b = document.createElement('button'); b.className = 'btn'; b.textContent = '📋 ' + t('lkCopy');
    b.onclick = () => fetchAndCopy(b, () => api.monthShare(LK.phone, m), r => t('lkMonthCopied', monthBoth(m), r.count));
    c.appendChild(b); box.appendChild(c);
  });
}

function render(){
  renderMonths();
  const m = LK.month, q = $('#lkSearch').value.trim().toLowerCase();
  const box = $('#lkList'); box.innerHTML = '';
  LK.data.teachers.filter(x => !q || (x.name + ' ' + x.halaqa + ' ' + x.jiha + ' ' + x.region).toLowerCase().indexOf(q) > -1).forEach(x => {
    const d = x.done[m], ok = d && d.p > 0;
    const c = document.createElement('div'); c.className = 'card';
    const h = document.createElement('h3'); h.textContent = x.name; c.appendChild(h);
    const st = document.createElement('p'); st.style.cssText = 'margin:6px 0;font-weight:700;color:' + (ok ? '#0b7a4f' : '#b42318');
    st.textContent = ok ? t('lkDone', d.p, d.v) : t('lkNotDone'); c.appendChild(st);
    const meta = document.createElement('p'); meta.className = 'sub'; meta.textContent = [x.halaqa && t('halaqa', x.halaqa), x.jiha, x.region].filter(Boolean).join(' — '); c.appendChild(meta);
    const row = document.createElement('div'); row.className = 'fbar';
    const mk = (label, fn, ghost, dis) => { const b = document.createElement('button'); b.className = 'btn' + (ghost ? ' ghost' : ''); b.textContent = label; b.disabled = !!dis; b.onclick = () => fetchAndCopy(b, fn); row.appendChild(b); };
    mk(t('lkCopyMonth', monthBoth(m)), () => api.teacherLink(LK.phone, x.serial, m), false, !ok);
    mk(t('lkCopyAll'), () => api.teacherLink(LK.phone, x.serial, ''), true);
    c.appendChild(row); box.appendChild(c);
  });
}

(async () => {
  const g = await adminGuard('links', 'media'); if(!g) return;
  LK.phone = g.phone;
  try { LK.data = await api.shareInit(g.phone); }
  catch(e){ toast(err(e), true); return; }
  LK.month = LK.data.months[0];
  const sel = $('#lkMonth');
  LK.data.months.forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = monthBoth(m); sel.appendChild(o); });
  sel.onchange = () => { LK.month = sel.value; render(); };
  $('#lkSearch').oninput = render;
  $('#lkRootCopy').onclick = e => fetchAndCopy(e.target, () => api.rootLink(LK.phone));
  render();
})();
