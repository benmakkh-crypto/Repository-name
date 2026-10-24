/* ملف الحلقة: كل صور ومقاطع التقارير الشهرية لمعلم واحد */
renderBrand(true);
const FL = { data:null }, LB = { list:[], i:0 };
window.onLangChange = () => { if(FL.data) render(); };
applyLang();

function render(){
  const d = FL.data;
  $('#fName').textContent = d.teacher.name;
  $('#fInfo').textContent = [d.teacher.halaqa && t('halaqa', d.teacher.halaqa), d.teacher.jiha, d.teacher.region].filter(Boolean).join(' — ');
  $('#fR').textContent = d.totals.reports; $('#fP').textContent = d.totals.photos; $('#fV').textContent = d.totals.videos;
  const a = $('#fDrive'); if(d.folderUrl){ a.href = d.folderUrl; a.classList.remove('hidden'); } else a.classList.add('hidden');
  const box = $('#fList'); box.innerHTML = '';
  if(!d.reports.length){ box.innerHTML = '<div class="empty"></div>'; box.firstChild.textContent = t('fileNone'); return; }
  d.reports.forEach(r => {
    const s = document.createElement('section'); s.className = 'dsec';
    const h = document.createElement('header'); h.innerHTML = '<div><h3></h3></div><div class="meta m2"></div>';
    h.querySelector('h3').textContent = monthBoth(r.month);
    h.querySelector('.m2').textContent = t('repDate', r.date + (r.dateH ? ' — ' + r.dateH : ''));
    s.appendChild(h);
    if(r.photos.length){
      const g = document.createElement('div'); g.className = 'mgrid';
      r.photos.forEach((id, i) => { const im = document.createElement('img'); im.loading = 'lazy'; im.alt = t('photoN', i + 1); im.src = thumb(id, 520); im.onclick = () => openLb(r.photos, i); g.appendChild(im); });
      s.appendChild(g);
    }
    if(r.videos.length){
      const g = document.createElement('div'); g.className = 'vgrid';
      r.videos.forEach((id, i) => {
        const b = document.createElement('div'); b.className = 'vbox';
        const f = document.createElement('iframe'); f.loading = 'lazy'; f.src = 'https://drive.google.com/file/d/' + id + '/preview'; f.allow = 'autoplay; fullscreen'; f.allowFullscreen = true; f.title = t('videoN', i + 1);
        b.appendChild(f); g.appendChild(b);
      });
      s.appendChild(g);
    }
    if(r.notes){ const n = document.createElement('p'); n.className = 'meta'; n.style.marginTop = '12px'; n.textContent = t('notes', r.notes); s.appendChild(n); }
    box.appendChild(s);
  });
}
function showLb(){ const id = LB.list[LB.i]; $('#lbImg').src = thumb(id, 1800); $('#lbOpen').href = 'https://drive.google.com/file/d/' + id + '/view'; $('#lbN').textContent = (LB.i + 1) + ' / ' + LB.list.length; }
function openLb(list, i){ LB.list = list; LB.i = i; showLb(); $('#lb').classList.remove('hidden'); }
function stepLb(n){ LB.i = (LB.i + n + LB.list.length) % LB.list.length; showLb(); }
$('#lbPrev').onclick = e => { e.stopPropagation(); stepLb(-1); };
$('#lbNext').onclick = e => { e.stopPropagation(); stepLb(1); };
$('#lb').onclick = () => $('#lb').classList.add('hidden');
document.addEventListener('keydown', e => { if(e.key === 'Escape') $('#lb').classList.add('hidden'); });

(async function init(){
  const s = store.get();
  if(!s){ location.replace('index.html'); return; }
  try {
    if(s.admin){
      const r = await api.login(s.phone);
      if(!r.ok || !r.admin || !r.admin.media){ location.replace('index.html'); return; }
      renderNav('file', r.admin);
      const ser = new URLSearchParams(location.search).get('s') || '';
      $('#fBack').href = r.admin.contacts ? 'teachers.html' : 'docs.html';
      FL.data = await api.teacherFileAdmin(s.phone, ser);
    } else {
      $('#topnav').classList.add('hidden');
      $('#fBack').href = 'index.html';
      FL.data = await api.myFile(s.row, s.phone);
    }
    render();
  } catch(e){ toast(err(e), true); }
})();
