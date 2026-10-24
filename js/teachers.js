/* صفحة المعلمين وإنجازاتهم اليومية */
renderBrand(true);
const T = { phone:'', acc:null, data:null, filter:'all' };
window.onLangChange = () => { if(T.data){ renderHead(); renderList(); } };
applyLang();

function renderHead(){
  const d = T.data, sm = d.summary;
  fillYM($('#pYear'), $('#pMonth'), d.month, d.years);
  $('#kTotal').textContent = sm.total; $('#kToday').textContent = sm.loggedToday; $('#kNot').textContent = sm.total - sm.loggedToday; $('#kDays').textContent = sm.days;
}

async function loadTeachers(month){
  try { T.data = await api.teachersData(T.phone, month || ''); renderHead(); renderList(); }
  catch(e){ toast(err(e), true); }
}

function setFilter(f){
  T.filter = f;
  [['all','All'],['today','Today'],['not','Not']].forEach(p => $('#f' + p[1]).classList.toggle('on', p[0] === f));
  renderList();
}

function renderList(){
  const q = $('#pSearch').value.trim().toLowerCase();
  const box = $('#pList'); box.innerHTML = '';
  const rows = T.data.rows.filter(r => (T.filter === 'all' || (T.filter === 'today') === r.today) &&
    (!q || (r.name + ' ' + r.halaqa + ' ' + r.jiha + ' ' + r.region).toLowerCase().indexOf(q) > -1));
  if(!rows.length){ box.innerHTML = '<div class="empty"></div>'; box.firstChild.textContent = t('noResults'); return; }
  rows.forEach(r => box.appendChild(card(r)));
  if(location.hash){ const el = document.querySelector(location.hash); if(el){ el.open = true; el.scrollIntoView(); } }
}

function pill(text){ const s = document.createElement('span'); s.className = 'pill'; s.textContent = text; return s; }

function card(r){
  const d = document.createElement('details'); d.className = 'item'; d.id = 't' + r.serial;
  const sm = document.createElement('summary');
  const ti = document.createElement('div'); ti.innerHTML = '<b></b><small></small>';
  ti.firstChild.textContent = r.name;
  ti.lastChild.textContent = [r.halaqa && t('halaqa', r.halaqa), r.jiha, r.region].filter(Boolean).join(' — ');
  const b = document.createElement('span'); b.className = 'badge ' + (r.today ? 'ok' : 'no'); b.textContent = t(r.today ? 'badgeToday' : 'badgeNoToday');
  sm.append(ti, b); d.appendChild(sm);

  const body = document.createElement('div'); body.className = 'body'; d.appendChild(body);
  const pills = document.createElement('div'); pills.className = 'pills';
  pills.append(pill(t('daysN', r.daysLogged)), pill(t('avgAtt', r.avgAtt)), pill(t('regStudents', r.registered) + (r.students ? ' / ' + r.students : '')), pill(t('repState', t(r.reported ? 'badgeOk' : 'badgeNo'))));
  if(r.last) pills.appendChild(pill(t('lastEntry', r.last)));
  body.appendChild(pills);

  if(r.phone){
    const c = document.createElement('div'); c.className = 'contact';
    const a = document.createElement('a'); a.textContent = '📞 ' + r.phone; a.href = 'tel:+' + r.wa; a.dir = 'ltr';
    const w = document.createElement('a'); w.textContent = t('wa'); w.href = 'https://wa.me/' + r.wa; w.target = '_blank'; w.rel = 'noopener';
    c.append(a, w);
    if(T.acc.media && r.reported){ const k = document.createElement('a'); k.textContent = t('showDocs'); k.href = 'docs.html#t' + r.serial; c.appendChild(k); }
    body.appendChild(c);
  }

  const tl = document.createElement('div'); tl.className = 'tl';
  if(!r.entries.length){ const e = document.createElement('div'); e.className = 'empty'; e.textContent = t('noDaily'); tl.appendChild(e); }
  r.entries.forEach(e => {
    const x = document.createElement('div'); x.className = 'te';
    x.innerHTML = '<div class="top"><b></b><span class="pill"></span></div><div class="tx"></div>';
    x.querySelector('b').textContent = dateBoth(e.date);
    x.querySelector('.pill').textContent = t('dPresent', e.att);
    const tx = x.querySelector('.tx');
    [e.newH && t('dNewLbl', e.newH), e.rev && t('dRevLbl', e.rev), e.note && t('notes', e.note)].filter(Boolean).forEach(line => { const p = document.createElement('div'); p.textContent = line; tx.appendChild(p); });
    tl.appendChild(x);
  });
  body.appendChild(tl);
  return d;
}

const pGo = () => loadTeachers($('#pYear').value + '-' + $('#pMonth').value);
$('#pYear').onchange = pGo; $('#pMonth').onchange = pGo;
$('#pSearch').oninput = renderList;
$('#fAll').onclick = () => setFilter('all'); $('#fToday').onclick = () => setFilter('today'); $('#fNot').onclick = () => setFilter('not');

(async function init(){
  const g = await adminGuard('teachers', 'contacts');
  if(!g) return;
  T.phone = g.phone; T.acc = g.acc;
  await loadTeachers('');
})();
