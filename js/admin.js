/* لوحة المتابعة: إحصائية من رفع ومن لم يرفع + تصدير Excel/PDF */
renderBrand(true);
const A = { phone:'', acc:null, data:null, filter:'all' };
window.onLangChange = () => { if(A.data){ renderHead(); renderList(); } };
applyLang();

function renderHead(){
  const d = A.data;
  $('#aName').textContent = t('role_' + d.account.role);
  fillYM($('#aYear'), $('#aMonth'), d.month, d.years);
}

async function loadAdmin(month){
  try {
    const d = await api.adminData(A.phone, month || '');
    A.data = d;
    $('#aStats').classList.toggle('hidden', !d.stats);
    $('#aExport').classList.toggle('hidden', !d.account.export);
    if(d.stats){
      $('#sTotal').textContent = d.stats.total; $('#sDone').textContent = d.stats.submitted; $('#sMiss').textContent = d.stats.missing;
      $('#sBar').style.width = (d.stats.total ? d.stats.submitted / d.stats.total * 100 : 0) + '%';
    }
    renderHead(); renderList();
  } catch(e){ toast(err(e), true); }
}

function aFilter(f){
  A.filter = f;
  [['all','All'],['done','Done'],['miss','Miss']].forEach(p => $('#f' + p[1]).classList.toggle('on', p[0] === f));
  renderList();
}

function renderList(){
  const q = $('#aSearch').value.trim().toLowerCase();
  const box = $('#aList'); box.innerHTML = '';
  const rows = A.data.rows.filter(r =>
    (A.filter === 'all' || (A.filter === 'done') === r.submitted) &&
    (!q || (r.name + ' ' + r.halaqa + ' ' + r.jiha).toLowerCase().indexOf(q) > -1));
  if(!rows.length){ box.innerHTML = '<div class="empty"></div>'; box.firstChild.textContent = t('noResults'); return; }
  rows.forEach(r => box.appendChild(card(r)));
}

function btn(text, fn){ const b = document.createElement('button'); b.textContent = text; b.onclick = fn; return b; }
function link(text, href, ext){ const a = document.createElement('a'); a.textContent = text; a.href = href; if(ext){ a.target = '_blank'; a.rel = 'noopener'; } return a; }

function card(r){
  const acc = A.data.account;
  const d = document.createElement('details'); d.className = 'item'; d.id = 't' + r.serial;
  const sm = document.createElement('summary');
  const ti = document.createElement('div'); ti.innerHTML = '<b></b><small></small>';
  ti.firstChild.textContent = r.name;
  ti.lastChild.textContent = [r.halaqa && t('halaqa', r.halaqa), r.jiha].filter(Boolean).join(' — ');
  const b = document.createElement('span'); b.className = 'badge ' + (r.submitted ? 'ok' : 'no'); b.textContent = t(r.submitted ? 'badgeOk' : 'badgeNo');
  sm.append(ti, b); d.appendChild(sm);

  const body = document.createElement('div'); body.className = 'body'; d.appendChild(body);
  const info = document.createElement('p'); info.className = 'sub'; info.style.margin = '10px 0 0';
  info.textContent = [r.region, r.students && t('studentsN', r.students), t('regStudents', r.registered),
    r.submitted && t('repDate', r.date + (r.dateH ? ' — ' + r.dateH : '')), r.submitted && t('sentAt', r.submittedAt)].filter(Boolean).join(' — ');
  body.appendChild(info);
  if(r.notes){ const n = document.createElement('p'); n.textContent = t('notes', r.notes); body.appendChild(n); }

  if(r.phone){
    const c = document.createElement('div'); c.className = 'contact';
    const call = link('📞 ' + r.phone, 'tel:+' + r.wa); call.dir = 'ltr';
    c.append(call, link(t('wa'), 'https://wa.me/' + r.wa, true));
    body.appendChild(c);
  }
  const ac = document.createElement('div'); ac.className = 'contact';
  if(r.submitted && acc.media) ac.appendChild(link(t('showDocs'), 'docs.html#t' + r.serial));
  if(acc.contacts) ac.appendChild(link(t('showDaily'), 'teachers.html#t' + r.serial));
  if(r.phone){
    ac.appendChild(btn(t('viewStudents'), async () => {
      let sl = body.querySelector('.slist');
      if(sl){ sl.remove(); return; }
      try {
        const res = await api.adminStudents(A.phone, r.serial);
        sl = document.createElement('div'); sl.className = 'slist';
        if(!res.students.length) sl.textContent = t('noStudents');
        res.students.forEach(s => { const li = document.createElement('div'); li.textContent = [s.name, t('ageN', s.age), s.phone, Number(s.juz) === 0 ? t('juzNone') : t('juzN', s.juz)].filter(Boolean).join(' — '); sl.appendChild(li); });
        body.appendChild(sl);
      } catch(e){ toast(err(e), true); }
    }));
  }
  if(acc.export){
    const eb = btn(t('exOne'), () => doExport(eb, () => api.exportStudents(A.phone, LANG, r.serial))); ac.appendChild(eb);
    if(r.submitted){ const pb = btn(t('exPdf'), () => doExport(pb, () => api.exportReportPdf(A.phone, LANG, A.data.month, r.serial, monthBoth(A.data.month), logoPng()))); ac.appendChild(pb); }
  }
  if(ac.children.length) body.appendChild(ac);
  return d;
}

const aGo = () => loadAdmin($('#aYear').value + '-' + $('#aMonth').value);
$('#aYear').onchange = aGo; $('#aMonth').onchange = aGo;
$('#aSearch').oninput = renderList;
$('#fAll').onclick = () => aFilter('all'); $('#fDone').onclick = () => aFilter('done'); $('#fMiss').onclick = () => aFilter('miss');
$('#exAll').onclick = () => doExport($('#exAll'), () => api.exportStudents(A.phone, LANG, 'all'));
$('#exRep').onclick = () => doExport($('#exRep'), () => api.exportReportsExcel(A.phone, LANG, A.data.month));

(async function init(){
  const g = await adminGuard('dash', 'stats');
  if(!g) return;
  A.phone = g.phone; A.acc = g.acc;
  await loadAdmin('');
  if(location.hash){ const el = document.querySelector(location.hash); if(el){ el.open = true; el.scrollIntoView(); } }
})();
