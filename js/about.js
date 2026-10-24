/* صفحة «عن حلقات القرآن الكريم»: عامة، وأرقامها حيّة من بيانات النظام */
renderBrand(true);
const AB = { data:null };
window.onLangChange = () => { if(AB.data) render(); };
applyLang();

const SECTIONS = [['goals','abGoals','list','🎯'],['message','abMessage','p','✉️'],['vision','abVision','p','🔭'],['origin','abOrigin','p','🌱'],
  ['dawah','abDawah','p','🕌'],['values','abValues','list','💎'],['expect','abExpect','p','✅'],['impact','abImpact','p','🌟']];

function textOf(k){
  const o = AB.data.texts[k];
  return (o && o[LANG]) || t('abt_' + k);
}
function render(){
  const st = AB.data.stats;
  const tiles = [['circles','abCircles'],['teachers','abTeachers'],['students','abStudents'],['regions','abRegions'],['reports','abReports'],['photos','abPhotos'],['videos','abVideos'],['dailyLogs','abDays'],['programs','abProgramsN']];
  const sb = $('#abStatsBox'); sb.innerHTML = '';
  tiles.forEach((x, i) => {
    const d = document.createElement('div'); d.className = 'stat' + (i % 3 === 1 ? ' ok' : '');
    d.innerHTML = '<b></b><span></span>'; d.querySelector('b').textContent = st[x[0]]; d.querySelector('span').textContent = t(x[1]); sb.appendChild(d);
  });
  const box = $('#abSections'); box.innerHTML = '';
  SECTIONS.forEach(s => {
    const c = document.createElement('section'); c.className = 'card ab-sec';
    const h = document.createElement('h3'); h.textContent = s[3] + ' ' + t(s[1]); c.appendChild(h);
    const txt = textOf(s[0]);
    if(s[2] === 'list'){
      const ul = document.createElement('ul'); txt.split('\n').filter(Boolean).forEach(l => { const li = document.createElement('li'); li.textContent = l; ul.appendChild(li); }); c.appendChild(ul);
    } else { const p = document.createElement('p'); p.textContent = txt; c.appendChild(p); }
    box.appendChild(c);
  });
  const pb = $('#abProgs'); pb.innerHTML = '';
  if(!AB.data.programs.length){ pb.innerHTML = '<div class="empty"></div>'; pb.firstChild.textContent = t('abNoProg'); }
  else { const g = document.createElement('div'); g.className = 'pgrid'; AB.data.programs.forEach(p => g.appendChild(progCard(p, true))); pb.appendChild(g); }
}

(async function init(){
  const s = store.get();
  if(!s){ location.replace('index.html'); return; }
  if(s && s.admin){ try { const r = await api.login(s.phone); if(r.ok && r.admin) renderNav('about', r.admin); else $('#topnav').classList.add('hidden'); } catch(e){ $('#topnav').classList.add('hidden'); } }
  else $('#topnav').classList.add('hidden');
  try { AB.data = await api.aboutGet(); render(); } catch(e){ toast(err(e), true); }
})();
