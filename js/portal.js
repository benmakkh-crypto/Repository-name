/* بوابة الجهة الداعمة: رابط دائم، تفتح على الشهر الماضي، بطاقات حلقات بصور وفيديوهات وعارض معرض */
const P = { phone:'', key:'', data:null, month:'', filter:'all', cur:null, idx:0 };
let items = [];
window.onLangChange = () => { if(P.data) render(); };
document.querySelectorAll('#pbLang button').forEach(b => b.onclick = () => setLang(b.dataset.l));
const syncLang = () => document.querySelectorAll('#pbLang button').forEach(b => b.classList.toggle('on', b.dataset.l === document.documentElement.lang));
const _al = window.applyLang; applyLang(); syncLang();
const _sl = window.setLang; window.setLang = function(l){ _sl(l); syncLang(); };

async function load(month){
  if(month && month !== P.month) P.filter = 'all';
  try { P.data = await api.portalData(P.phone, month || P.month || ''); P.month = P.data.month; render(); }
  catch(e){ toast(err(e), true); }
}

function render(){
  const d = P.data, pct = d.total ? Math.round(d.uploaded * 100 / d.total) : 0;
  $('#pbMonthTitle').textContent = monthBoth(d.month).split(' — ')[0] + ' ' + d.month.slice(0, 4);
  $('#pbWho').textContent = t('pbWelcome', d.account.name);
  $('#kUp').textContent = d.uploaded; $('#kMiss').textContent = d.total - d.uploaded; $('#kPh').textContent = d.photos; $('#kVi').textContent = d.videos;
  $('#pbPct').textContent = pct + '%';
  $('#pbArc').style.strokeDashoffset = 326.7 * (1 - pct / 100);
  const rail = $('#pbMonths'); rail.innerHTML = '';
  d.months.forEach((m, i) => {
    const n = d.counts[m] || 0, b = document.createElement('button'); b.className = 'pb-m' + (m === d.month ? ' on' : '');
    b.innerHTML = '<b></b><small></small><i><u></u></i>';
    b.querySelector('b').textContent = monthBoth(m).split(' — ')[0] + ' ' + m.slice(2, 4) + (i === 0 ? ' ★' : '');
    b.querySelector('small').textContent = n + ' / ' + d.total;
    b.querySelector('u').style.width = (d.total ? n * 100 / d.total : 0) + '%';
    b.onclick = () => load(m); rail.appendChild(b);
    if(m === d.month) setTimeout(() => b.scrollIntoView({ inline:'center', block:'nearest' }), 0);
  });
  [['all','All'],['done','Done'],['miss','Miss']].forEach(p => $('#f' + p[1]).classList.toggle('on', p[0] === P.filter));
  renderList();
}

function renderList(){
  const q = $('#pbSearch').value.trim().toLowerCase(), box = $('#dList'); box.innerHTML = '';
  const rows = P.data.circles.filter(c => (P.filter === 'all' || (P.filter === 'done') === c.done) &&
    (!q || (c.name + ' ' + c.halaqa + ' ' + c.jiha + ' ' + c.region).toLowerCase().indexOf(q) > -1));
  rows.sort((a, b) => (b.done - a.done) || (Number(a.serial) - Number(b.serial)));
  if(!rows.length){ box.className = ''; box.innerHTML = '<div class="pb-empty"></div>'; box.firstChild.textContent = t('dpNone'); return; }
  box.className = 'pb-grid'; rows.forEach(c => box.appendChild(card(c)));
}

function card(c){
  const el = document.createElement('article'); el.className = 'pb-c' + (c.done ? '' : ' miss');
  const cov = document.createElement('div'); cov.className = 'pb-cov';
  if(c.done && c.photos[0]) cov.style.backgroundImage = 'url(' + thumb(c.photos[0], 640) + ')';
  const st = document.createElement('span'); st.className = 'pb-st ' + (c.done ? 'ok' : 'no'); st.textContent = c.done ? t('pbBadgeOk') : t('pbBadgeNo'); cov.appendChild(st);
  if(c.done){
    const bd = document.createElement('div'); bd.className = 'pb-badges';
    bd.innerHTML = '<span>🖼 ' + c.photos.length + '</span>' + (c.videos.length ? '<span>▶ ' + c.videos.length + '</span>' : ''); cov.appendChild(bd);
    el.onclick = () => openViewer(c, 0);
  }
  el.appendChild(cov);
  const inf = document.createElement('div'); inf.className = 'pb-info';
  inf.innerHTML = '<b></b><small></small>';
  inf.querySelector('b').textContent = c.name;
  inf.querySelector('small').textContent = [c.halaqa && t('halaqa', c.halaqa), c.region].filter(Boolean).join(' — ');
  el.appendChild(inf); return el;
}

/* عارض المعرض: صور ثم فيديوهات، تنقل بالأسهم والسحب */
function openViewer(c, i){
  P.cur = c; items = c.photos.map(id => ({ t:'p', id:id })).concat(c.videos.map(id => ({ t:'v', id:id })));
  $('#pvName').textContent = c.name;
  $('#pvSub').textContent = [c.halaqa && t('halaqa', c.halaqa), c.region].filter(Boolean).join(' — ');
  $('#pvCap').textContent = t('repDate', c.date + (c.dateH ? ' — ' + c.dateH : '')) + (c.notes ? ' · ' + c.notes : '');
  const tb = $('#pvT'); tb.innerHTML = '';
  items.forEach((it, k) => { const b = document.createElement('button'); if(it.t === 'p') b.style.backgroundImage = 'url(' + thumb(it.id, 160) + ')'; else b.textContent = '▶'; b.onclick = () => show(k); tb.appendChild(b); });
  $('#pv').classList.remove('hidden'); document.body.style.overflow = 'hidden'; show(i);
}
function show(k){
  P.idx = (k + items.length) % items.length; const it = items[P.idx], st = $('#pvStage'); st.innerHTML = '';
  if(it.t === 'p'){ const im = document.createElement('img'); im.src = thumb(it.id, 1800); im.alt = P.cur.name; st.appendChild(im); }
  else { const f = document.createElement('iframe'); f.src = 'https://drive.google.com/file/d/' + it.id + '/preview'; f.allow = 'autoplay; fullscreen'; f.allowFullscreen = true; st.appendChild(f); }
  [...$('#pvT').children].forEach((b, j) => { b.classList.toggle('on', j === P.idx); if(j === P.idx) b.scrollIntoView({ inline:'center', block:'nearest' }); });
}
const closeV = () => { $('#pv').classList.add('hidden'); $('#pvStage').innerHTML = ''; document.body.style.overflow = ''; };
$('#pvX').onclick = closeV; $('#pvP').onclick = () => show(P.idx - 1); $('#pvN').onclick = () => show(P.idx + 1);
document.addEventListener('keydown', e => { if($('#pv').classList.contains('hidden')) return; const rtl = document.documentElement.dir === 'rtl';
  if(e.key === 'Escape') closeV(); if(e.key === 'ArrowRight') show(P.idx + (rtl ? -1 : 1)); if(e.key === 'ArrowLeft') show(P.idx + (rtl ? 1 : -1)); });
let sx = 0; $('.pv-s').addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive:true });
$('.pv-s').addEventListener('touchend', e => { const dx = e.changedTouches[0].clientX - sx; if(Math.abs(dx) > 60) show(P.idx + (dx > 0 ? -1 : 1) * (document.documentElement.dir === 'rtl' ? -1 : 1)); }, { passive:true });

$('#pbSearch').oninput = renderList;
$('#fAll').onclick = () => { P.filter = 'all'; render(); }; $('#fDone').onclick = () => { P.filter = 'done'; render(); }; $('#fMiss').onclick = () => { P.filter = 'miss'; render(); };

(async function(){
  P.key = new URLSearchParams(location.search).get('k') || '';
  try { const r = await api.loginKey(P.key); P.phone = r.phone; }
  catch(e){ const b = $('#dList'); b.className = ''; b.innerHTML = '<div class="pb-empty"></div>'; b.firstChild.textContent = err(e); return; }
  await load('');
})();
