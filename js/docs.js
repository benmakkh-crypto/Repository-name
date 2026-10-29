/* صفحة التوثيق: صور ومقاطع كل الحلقات في صفحة واحدة */
renderBrand(true);
const D = { phone:'', data:null, filter:'all' };
const LB = { list:[], i:0 };
let io = null;
window.onLangChange = () => { if(D.data){ renderHead(); renderList(); } };
applyLang();

function renderHead(){
  const d = D.data;
  fillYM($('#dYear'), $('#dMonth'), d.month, d.years);
  const fill = (id, list) => { const b = $(id); b.innerHTML = ''; list.forEach(x => { const a = document.createElement('a'); a.className = 'chip'; a.textContent = x.name; a.title = x.halaqa || ''; a.href = '#t' + x.serial; b.appendChild(a); }); };
  fill('#rOk', d.done || []); fill('#rNo', d.missing || []); $('#rOkN').textContent = (d.done || []).length; $('#rNoN').textContent = (d.missing || []).length;
  $('#tReports').textContent = d.totals.reports; $('#tPhotos').textContent = d.totals.photos; $('#tVideos').textContent = d.totals.videos;
}

async function loadDocs(month){
  try { D.data = await api.docsData(D.phone, month || ''); renderHead(); renderList(); }
  catch(e){ toast(err(e), true); }
}

function setFilter(f){
  D.filter = f;
  [['all','All'],['photos','Photos'],['videos','Videos']].forEach(p => $('#f' + p[1]).classList.toggle('on', p[0] === f));
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

  const q = $('#dSearch').value.trim().toLowerCase();
  const box = $('#dList'); box.innerHTML = '';
  const rows = D.data.rows.filter(r => (D.filter === 'photos' ? r.photos.length : D.filter === 'videos' ? r.videos.length : true) &&
    (!q || (r.name + ' ' + r.halaqa + ' ' + r.jiha + ' ' + r.region).toLowerCase().indexOf(q) > -1));
  if(!rows.length){ box.innerHTML = '<div class="empty"></div>'; box.firstChild.textContent = t('dpNone'); return; }
  rows.forEach(r => box.appendChild(section(r)));
  if(location.hash){ const el = document.querySelector(location.hash); if(el) el.scrollIntoView(); }
}

function section(r){
  const s = document.createElement('section'); s.className = 'dsec'; s.id = 't' + r.serial;
  const h = document.createElement('header');
  h.innerHTML = '<div><h3></h3><div class="meta m1"></div></div><div class="meta m2"></div>';
  h.querySelector('h3').textContent = r.name;
  h.querySelector('.m1').textContent = [r.halaqa && t('halaqa', r.halaqa), r.jiha, r.region].filter(Boolean).join(' — ');
  h.querySelector('.m2').textContent = t('repDate', r.date + (r.dateH ? ' — ' + r.dateH : ''));
  const fl = document.createElement('a'); fl.href = 'file.html?s=' + r.serial; fl.textContent = t('fileTitle'); fl.className = 'linkbtn'; fl.style.cssText = 'display:inline-block;margin-top:6px;text-decoration:none'; h.querySelector('.m2').appendChild(document.createElement('br')); h.querySelector('.m2').appendChild(fl);
  s.appendChild(h);

  if(D.filter !== 'videos' && r.photos.length){
    const l = document.createElement('div'); l.className = 'mlabel'; l.textContent = t('photos') + ' (' + r.photos.length + ')'; s.appendChild(l);
    const g = document.createElement('div'); g.className = 'mgrid';
    r.photos.forEach((id, i) => {
      const im = document.createElement('img'); im.loading = 'lazy'; im.alt = t('photoN', i + 1) + ' — ' + r.name; im.src = thumb(id, 520);
      im.onclick = () => openLb(r.photos, i); g.appendChild(im);
    });
    s.appendChild(g);
  }
  if(D.filter !== 'photos' && r.videos.length){
    const l = document.createElement('div'); l.className = 'mlabel'; l.textContent = t('videos') + ' (' + r.videos.length + ')'; s.appendChild(l);
    const g = document.createElement('div'); g.className = 'vgrid';
    r.videos.forEach((id, i) => {
      const b = document.createElement('div'); b.className = 'vbox'; b.dataset.id = id; b.dataset.title = t('videoN', i + 1) + ' — ' + r.name;
      b.innerHTML = '<span class="ph">▶</span>'; g.appendChild(b); io.observe(b);
    });
    s.appendChild(g);
  }
  if(r.notes){ const n = document.createElement('p'); n.className = 'meta'; n.style.marginTop = '12px'; n.textContent = t('notes', r.notes); s.appendChild(n); }
  return s;
}

/* عارض الصور */
function showLb(){ const id = LB.list[LB.i]; $('#lbImg').src = thumb(id, 1800); $('#lbOpen').href = 'https://drive.google.com/file/d/' + id + '/view'; $('#lbN').textContent = (LB.i + 1) + ' / ' + LB.list.length; }
function openLb(list, i){ LB.list = list; LB.i = i; showLb(); $('#lb').classList.remove('hidden'); }
function stepLb(n){ LB.i = (LB.i + n + LB.list.length) % LB.list.length; showLb(); }
$('#lbPrev').onclick = e => { e.stopPropagation(); stepLb(-1); };
$('#lbNext').onclick = e => { e.stopPropagation(); stepLb(1); };
$('#lb').onclick = () => $('#lb').classList.add('hidden');
document.addEventListener('keydown', e => {
  if($('#lb').classList.contains('hidden')) return;
  if(e.key === 'Escape') $('#lb').classList.add('hidden');
  const rtl = document.documentElement.dir === 'rtl';
  if(e.key === 'ArrowRight') stepLb(rtl ? -1 : 1);
  if(e.key === 'ArrowLeft') stepLb(rtl ? 1 : -1);
});

const dGo = () => loadDocs($('#dYear').value + '-' + $('#dMonth').value);
$('#dYear').onchange = dGo; $('#dMonth').onchange = dGo;
$('#dSearch').oninput = renderList;
$('#fAll').onclick = () => setFilter('all'); $('#fPhotos').onclick = () => setFilter('photos'); $('#fVideos').onclick = () => setFilter('videos');

(async function init(){
  const g = await adminGuard('docs', 'media');
  if(!g) return;
  D.phone = g.phone;
  await loadDocs('');
})();
