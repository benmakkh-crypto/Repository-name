/* بوابة الجهة الداعمة: رابط واحد دائم، يفتح مباشرة على حلقات الشهر الماضي مع حالة الرفع والصور والفيديوهات */
renderBrand(true);
const P = { phone:'', key:'', data:null, month:'', filter:'all' };
const LB = { list:[], i:0 };
let io = null;
window.onLangChange = () => { if(P.data) render(); };
applyLang();

async function load(month){
  if(month && month !== P.month) P.filter = 'all'; // عند اختيار شهر تظهر كل الحلقات بصورها ومقاطعها
  try { P.data = await api.portalData(P.phone, month || P.month || ''); P.month = P.data.month; render(); }
  catch(e){ toast(err(e), true); }
}

function render(){
  const d = P.data;
  $('#pbWho').textContent = t('pbWelcome', d.account.name);
  $('#kUp').textContent = d.uploaded; $('#kMiss').textContent = d.total - d.uploaded; $('#kPh').textContent = d.photos; $('#kVi').textContent = d.videos;
  const mb = $('#pbMonths'); mb.innerHTML = '';
  d.months.forEach((m, i) => {
    const b = document.createElement('button'); b.className = m === d.month ? 'on' : '';
    b.textContent = monthBoth(m).split(' — ')[0] + (d.counts[m] ? ' · ' + d.counts[m] : '') + (i === 0 ? ' ★' : '');
    b.title = monthBoth(m); b.onclick = () => load(m); mb.appendChild(b);
  });
  [['all','All'],['done','Done'],['miss','Miss']].forEach(p => $('#f' + p[1]).classList.toggle('on', p[0] === P.filter));
  renderList();
}

function renderList(){
  if(io) io.disconnect();
  io = new IntersectionObserver(es => es.forEach(e => {
    if(!e.isIntersecting) return;
    const b = e.target, f = document.createElement('iframe');
    f.src = 'https://drive.google.com/file/d/' + b.dataset.id + '/preview'; f.allow = 'autoplay; fullscreen'; f.allowFullscreen = true; f.title = b.dataset.title;
    b.appendChild(f); io.unobserve(b);
  }), { rootMargin:'400px' });
  const q = $('#pbSearch').value.trim().toLowerCase();
  const box = $('#dList'); box.innerHTML = '';
  const rows = P.data.circles.filter(c => (P.filter === 'all' || (P.filter === 'done') === c.done) &&
    (!q || (c.name + ' ' + c.halaqa + ' ' + c.jiha + ' ' + c.region).toLowerCase().indexOf(q) > -1));
  if(!rows.length){ box.innerHTML = '<div class="empty"></div>'; box.firstChild.textContent = t('dpNone'); return; }
  rows.sort((a, b) => (b.done - a.done) || (Number(a.serial) - Number(b.serial))); // من رفع التوثيق أولاً
  rows.forEach(c => box.appendChild(section(c)));
}

function section(c){
  const s = document.createElement('section'); s.className = 'dsec'; s.id = 't' + c.serial;
  const h = document.createElement('header');
  h.innerHTML = '<div><h3></h3><div class="meta m1"></div></div><div class="meta m2"></div>';
  h.querySelector('h3').textContent = c.name;
  h.querySelector('.m1').textContent = [c.halaqa && t('halaqa', c.halaqa), c.jiha, c.region].filter(Boolean).join(' — ');
  const st = h.querySelector('.m2'); st.style.fontWeight = '700'; st.style.color = c.done ? '#0b7a4f' : '#b42318';
  st.textContent = c.done ? t('pbDone', c.photos.length, c.videos.length) : t('pbNotDone');
  s.appendChild(h);
  if(!c.done){ s.style.opacity = '.75'; return s; }
  const d = document.createElement('p'); d.className = 'meta'; d.textContent = t('repDate', c.date + (c.dateH ? ' — ' + c.dateH : '')); s.appendChild(d);
  if(c.photos.length){
    const g = document.createElement('div'); g.className = 'mgrid';
    c.photos.forEach((id, i) => { const im = document.createElement('img'); im.loading = 'lazy'; im.alt = t('photoN', i + 1) + ' — ' + c.name; im.src = thumb(id, 520); im.onclick = () => openLb(c.photos, i); g.appendChild(im); });
    s.appendChild(g);
  }
  if(c.videos.length){
    const g = document.createElement('div'); g.className = 'vgrid';
    c.videos.forEach((id, i) => { const b = document.createElement('div'); b.className = 'vbox'; b.dataset.id = id; b.dataset.title = t('videoN', i + 1) + ' — ' + c.name; b.innerHTML = '<span class="ph">▶</span>'; g.appendChild(b); io.observe(b); });
    s.appendChild(g);
  }
  if(c.notes){ const n = document.createElement('p'); n.className = 'meta'; n.style.marginTop = '12px'; n.textContent = t('notes', c.notes); s.appendChild(n); }
  return s;
}

function showLb(){ const id = LB.list[LB.i]; $('#lbImg').src = thumb(id, 1800); $('#lbOpen').href = 'https://drive.google.com/file/d/' + id + '/view'; $('#lbN').textContent = (LB.i + 1) + ' / ' + LB.list.length; }
function openLb(list, i){ LB.list = list; LB.i = i; showLb(); $('#lb').classList.remove('hidden'); }
function stepLb(n){ LB.i = (LB.i + n + LB.list.length) % LB.list.length; showLb(); }
$('#lbPrev').onclick = e => { e.stopPropagation(); stepLb(-1); };
$('#lbNext').onclick = e => { e.stopPropagation(); stepLb(1); };
$('#lb').onclick = () => $('#lb').classList.add('hidden');
document.addEventListener('keydown', e => { if(e.key === 'Escape') $('#lb').classList.add('hidden'); });
$('#pbSearch').oninput = renderList;
$('#fAll').onclick = () => { P.filter = 'all'; render(); }; $('#fDone').onclick = () => { P.filter = 'done'; render(); }; $('#fMiss').onclick = () => { P.filter = 'miss'; render(); };

(async function(){
  P.key = new URLSearchParams(location.search).get('k') || '';
  try { const r = await api.loginKey(P.key); P.phone = r.phone; }
  catch(e){ $('#dList').innerHTML = '<div class="empty"></div>'; $('#dList').firstChild.textContent = err(e); return; }
  await load('');
})();
