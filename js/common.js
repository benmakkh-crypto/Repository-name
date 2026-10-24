/* الأدوات المشتركة بين كل الصفحات: اللغة، التاريخ الهجري، الاتصال بالخادم، الترويسة، القائمة */
const LOCALE = { ar:'ar-u-nu-latn', en:'en', bn:'bn-BD' };
const lsGet = k => { try { return localStorage.getItem(k); } catch(e){ return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch(e){} };
let LANG = lsGet('hq_lang');
if(!I18N[LANG]) LANG = (navigator.language || '').toLowerCase().indexOf('bn') === 0 ? 'bn' : 'ar';

const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function t(k, ...a){
  let s = (I18N[LANG] && I18N[LANG][k] != null) ? I18N[LANG][k] : (I18N.ar[k] != null ? I18N.ar[k] : k);
  a.forEach((v, i) => { s = s.split('{' + i + '}').join(v); });
  return s;
}
// ترجمة رسائل الخادم (E_CODE أو E_CODE|param)
function err(e){
  const m = (e && e.message) || String(e);
  const x = /E_[A-Z0-9]+/.exec(m);
  if(!x || I18N.ar[x[0]] == null) return m;
  const after = m.split(x[0] + '|')[1];
  return t(x[0], after ? after.split(/\s/)[0] : '');
}

/* ---------- التاريخ الميلادي والهجري ---------- */
function monthLabel(m){
  const p = String(m).split('-');
  try { return new Date(+p[0], +p[1] - 1, 1).toLocaleDateString(LOCALE[LANG], { month:'long', year:'numeric' }); } catch(e){ return m; }
}
const HLOC = { ar:'ar-SA-u-ca-islamic-umalqura-nu-latn', en:'en-u-ca-islamic-umalqura', bn:'bn-BD-u-ca-islamic-umalqura' };
const HSUF = { ar:'هـ', en:'AH', bn:'হিজরি' };
const dOf = x => { const p = String(x).split('-'); return new Date(+p[0], +p[1] - 1, +(p[2] || 1), 12); };
const ymd = d => d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
function hParts(d, lang){ try { return new Intl.DateTimeFormat(HLOC[lang], { day:'numeric', month:'long', year:'numeric' }).formatToParts(d); } catch(e){ return null; } }
const hGet = (p, ty) => (p.find(x => x.type === ty) || {}).value || '';
function hijriFull(d, lang){ lang = lang || LANG; const p = hParts(d, lang); return p ? hGet(p,'day') + ' ' + hGet(p,'month') + ' ' + hGet(p,'year') + ' ' + HSUF[lang] : ''; }
function hijriMonth(y, m, lang){
  lang = lang || LANG;
  const pa = hParts(new Date(y, m - 1, 1, 12), lang), pb = hParts(new Date(y, m, 0, 12), lang);
  if(!pa || !pb) return '';
  const ma = hGet(pa,'month'), mz = hGet(pb,'month'), ya = hGet(pa,'year'), yz = hGet(pb,'year');
  const s = ya === yz ? (ma === mz ? ma + ' ' + ya : ma + ' – ' + mz + ' ' + ya) : ma + ' ' + ya + ' – ' + mz + ' ' + yz;
  return s + ' ' + HSUF[lang];
}
function monthBoth(m){ const p = String(m).split('-'); const h = hijriMonth(+p[0], +p[1]); return monthLabel(m) + (h ? ' — ' + h : ''); }
function dateBoth(s){ const h = hijriFull(dOf(s)); return s + (h ? ' — ' + h : ''); }

/* ---------- الاتصال بالخادم (Apps Script Web App) ---------- */
const API_URL = String((window.HQ_CONFIG || {}).API_URL || '').trim();
async function call(fn, args){
  if(!API_URL) throw new Error('E_CONFIG');
  let r;
  try {
    // text/plain لتجنب طلب preflight (Apps Script لا يدعمه)
    r = await fetch(API_URL, { method:'POST', headers:{ 'Content-Type':'text/plain;charset=utf-8' }, body: JSON.stringify({ fn:fn, args:args }) });
  } catch(e){ throw new Error('E_NET'); }
  let j;
  try { j = await r.json(); } catch(e){ throw new Error('E_SERVER'); }
  if(!j.ok) throw new Error(j.error || 'E_SERVER');
  return j.data;
}
const api = new Proxy({}, { get: (_, fn) => (...a) => call(fn, a) });

const store = {
  get(){ try { return JSON.parse(localStorage.getItem('hq_session') || 'null'); } catch(e){ return null; } },
  set(v){ try { localStorage.setItem('hq_session', JSON.stringify(v)); } catch(e){} },
  clear(){ try { localStorage.removeItem('hq_session'); } catch(e){} }
};

/* ---------- واجهة ---------- */
let tt;
function toast(msg, isErr){
  const el = $('#toast'); el.textContent = msg; el.className = isErr ? 'err' : ''; clearTimeout(tt);
  tt = setTimeout(() => el.classList.add('hidden'), 4500);
}
function load(btn, on, txt){ if(on){ btn._t = btn.textContent; btn.textContent = txt || t('wait'); } else btn.textContent = btn._t; btn.disabled = on; }
function mb(n){ return (n/1048576).toFixed(n > 10485760 ? 0 : 1) + ' ' + t('mb'); }
const thumb = (id, w) => 'https://drive.google.com/thumbnail?id=' + id + '&sz=w' + w;

function applyLang(){
  const h = document.documentElement; h.lang = LANG; h.dir = LANG === 'ar' ? 'rtl' : 'ltr';
  document.title = t(document.body.dataset.title || 'title');
  document.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = t(e.dataset.i18n, ...(e.dataset.a ? e.dataset.a.split(',') : [])); });
  document.querySelectorAll('[data-ph]').forEach(e => { e.placeholder = t(e.dataset.ph); });
  document.querySelectorAll('[data-alt]').forEach(e => { e.alt = t(e.dataset.alt); });
  document.querySelectorAll('.langs button').forEach(b => b.classList.toggle('on', b.dataset.l === LANG));
  if(typeof window.onLangChange === 'function') window.onLangChange();
}
function setLang(l){ LANG = l; lsSet('hq_lang', l); applyLang(); }

function renderBrand(compact){
  const el = $('#brand'); el.className = 'brand' + (compact ? ' compact' : '');
  el.innerHTML = '<nav class="langs" aria-label="Language"><button data-l="ar">العربية</button><button data-l="en">English</button><button data-l="bn">বাংলা</button></nav>' +
    '<div class="lg"><img src="assets/logo.webp" alt="" data-alt="logoAlt"></div>' +
    '<h1 data-i18n="title"></h1><p class="sh" data-i18n="brandSheikh"></p><p data-i18n="brandCo"></p>';
  el.querySelectorAll('.langs button').forEach(b => b.onclick = () => setLang(b.dataset.l));
}

function logout(){ store.clear(); location.href = 'index.html'; }

/* ---------- صفحات الإدارة: التحقق من الجلسة والقائمة ---------- */
function renderNav(active, acc){
  const items = [];
  if(acc.stats) items.push(['admin.html', 'navDash', 'dash']);
  if(acc.media) items.push(['docs.html', 'navDocs', 'docs']);
  if(acc.stats) items.push(['insights.html', 'navInsights', 'insights']);
  if(acc.contacts) items.push(['teachers.html', 'navTeachers', 'teachers']);
  if(acc.stats || acc.media || acc.manage) items.push(['programs.html', 'navPrograms', 'programs']);
  if(acc.manage) items.push(['manage.html', 'navManage', 'manage']);
  items.push(['about.html', 'navAbout', 'about']);
  const nav = $('#topnav'); nav.innerHTML = '';
  items.forEach(i => { const a = document.createElement('a'); a.href = i[0]; a.dataset.i18n = i[1]; if(i[2] === active){ a.className = 'on'; a.setAttribute('aria-current', 'page'); } nav.appendChild(a); });
  const o = document.createElement('button'); o.className = 'out'; o.dataset.i18n = 'logout'; o.onclick = logout; nav.appendChild(o);
  applyLang();
}

/** يرجع {phone, acc} أو null (مع تحويل المستخدم إلى الصفحة المناسبة) */
async function adminGuard(active, need){
  const s = store.get();
  if(!s || !s.admin){ location.replace('index.html'); return null; }
  let r;
  try { r = await api.login(s.phone); }
  catch(e){ toast(err(e), true); return null; }
  if(!r.ok || !r.admin){ store.clear(); location.replace('index.html'); return null; }
  const acc = r.admin;
  if(need && !acc[need]){ location.replace(acc.stats ? 'admin.html' : (acc.media ? 'docs.html' : 'index.html')); return null; }
  renderNav(active, acc);
  return { phone: s.phone, acc: acc };
}

/* قوائم السنة والشهر (ميلادي + هجري) لعشر سنوات قادمة */
function fillYM(ySel, mSel, month, years){
  const cy = +month.slice(0, 4), cm = +month.slice(5);
  ySel.innerHTML = '';
  for(let y = years.from; y <= years.to; y++){ const o = document.createElement('option'); o.value = y; o.textContent = y; ySel.appendChild(o); }
  ySel.value = cy;
  mSel.innerHTML = '';
  for(let m = 1; m <= 12; m++){
    const h = hijriMonth(cy, m);
    const o = document.createElement('option'); o.value = ('0' + m).slice(-2);
    o.textContent = new Date(cy, m - 1, 1).toLocaleDateString(LOCALE[LANG], { month:'long' }) + (h ? ' — ' + h : '');
    mSel.appendChild(o);
  }
  mSel.value = ('0' + cm).slice(-2);
}

/* تنزيل ملف قادم من الخادم (base64) */
function dl(r){
  const bin = atob(r.b64), u8 = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([u8], { type:r.mime })); a.download = r.name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
}
async function doExport(btn, fn){
  load(btn, true, t('exporting'));
  try { dl(await fn()); } catch(e){ toast(err(e), true); }
  finally { load(btn, false); }
}
function logoPng(){
  try {
    const im = $('.brand .lg img'), c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0);
    return c.toDataURL('image/png');
  } catch(e){ return ''; }
}

/* ---------- بطاقة برنامج / نشاط (تُستخدم في عدة صفحات) ---------- */
function progCard(p, withCircle){
  const d = document.createElement('div'); d.className = 'pcard ' + p.status;
  const h = document.createElement('div'); h.className = 'ph2';
  const by = document.createElement('span'); by.className = 'badge by ' + (p.by === 'admin' ? 'adm' : 'tch'); by.textContent = t(p.by === 'admin' ? 'pgByAdmin' : 'pgByTeacher');
  const ty = document.createElement('span'); ty.className = 'badge ' + (p.type === 'activity' ? 'no2' : 'ok'); ty.textContent = t(p.type === 'activity' ? 'pgActivity' : 'pgProgram');
  const st = document.createElement('span'); st.className = 'badge st'; st.textContent = t({ planned:'pgPlanned', running:'pgRunning', done:'pgDone' }[p.status] || 'pgPlanned');
  h.append(by, ty, st); d.appendChild(h);
  const ti = document.createElement('h3'); ti.textContent = p.title; d.appendChild(ti);
  const meta = [p.date ? dateBoth(p.date) : '', withCircle ? (p.serial === '*' ? t('pgAll') : (p.halaqa || p.teacher)) : ''].filter(Boolean).join(' — ');
  if(meta){ const m = document.createElement('div'); m.className = 'meta'; m.textContent = meta; d.appendChild(m); }
  if(p.desc){ const x = document.createElement('p'); x.textContent = p.desc; d.appendChild(x); }
  if(p.prize){ const x = document.createElement('div'); x.className = 'prize'; x.textContent = t('pgPrizeLbl', p.prize); d.appendChild(x); }
  if(p.winners){ const x = document.createElement('div'); x.className = 'meta'; x.textContent = t('pgWinLbl', p.winners); d.appendChild(x); }
  return d;
}
