/* الرسوم والتحليلات + التقرير الشهري الشامل (Excel / PDF) */
renderBrand(true);
const I = { phone:'', acc:null, d:null, month:'' };
window.onLangChange = () => { if(I.d) render(); };
applyLang();

const put = (id, el) => { const b = $('#' + id); b.innerHTML = ''; b.appendChild(el); };
const empty = id => { const b = $('#' + id); b.innerHTML = '<div class="empty"></div>'; b.firstChild.textContent = t('inNoData'); };
const mlab = m => new Date(+m.slice(0, 4), +m.slice(5) - 1, 1).toLocaleDateString(LOCALE[LANG], { month:'short' });

function render(){
  const d = I.d, T = d.totals;
  fillYM($('#iYear'), $('#iMonth'), d.month, d.years);
  $('#iExport').classList.toggle('hidden', !d.account.export);
  const k = $('#iKpi'); k.innerHTML = '';
  [['total', T.circles, ''], ['done', T.submitted, 'ok'], ['miss', T.missing, 'no'], ['inRate', T.rate + '%', 'blue'],
   ['abStudents', T.students, ''], ['photos', T.photos, 'ok'], ['videos', T.videos, 'blue'], ['dAtt', T.avgAtt, '']].forEach(x => {
    const c = document.createElement('div'); c.className = 'stat ' + x[2]; c.innerHTML = '<b></b><span></span>'; c.querySelector('b').textContent = x[1]; c.querySelector('span').textContent = t(x[0]); k.appendChild(c);
  });

  put('cStatus', donut([{ label:t('done'), value:T.submitted, color:CH.ok }, { label:t('miss'), value:T.missing, color:CH.err }], T.rate + '%', t('inRate')));
  const P = d.programs;
  if(P.total) put('cProgSrc', donut([{ label:t('pgByAdmin'), value:P.admin, color:CH.gold }, { label:t('pgByTeacher'), value:P.teacher, color:CH.blue }], P.total, t('abProgramsN'))); else empty('cProgSrc');
  put('cTrend', columns(d.trend.map(x => ({ label:mlab(x.month), value:x.reports, color:x.month === d.month ? CH.gold : CH.pri })), { line:true }));
  const mp = bdMap(d.districts, t('inMapLbl')); put('cMap', mp);
  $('#mapNote').textContent = mp._unmapped.length ? t('inMapUnk', mp._unmapped.map(u => u.name).join('، ')) : '';
  d.areas.length ? put('cAreas', hbars(d.areas.map(a => ({ label:a.name, value:a.students })))) : empty('cAreas');
  const juzL = ['0', '1–5', '6–10', '11–15', '16–20', '21–25', '26–30'], ageL = ['<10', '10–12', '13–15', '16–18', '19+'];
  put('cJuz', columns(d.juz.map((v, i) => ({ label:juzL[i], value:v, color:CH.pal[i % CH.pal.length] })), { h:220 }));
  put('cAge', columns(d.age.map((v, i) => ({ label:ageL[i], value:v, color:CH.pal[(i + 2) % CH.pal.length] })), { h:220 }));
  d.days.length ? put('cDaily', area(d.days.map(x => ({ label:x.date.slice(8), value:Math.round(x.att / x.n) })), { color:CH.blue })) : empty('cDaily');
  P.total ? put('cProgType', hbars([[t('pgProgram'), P.program, CH.pri], [t('pgActivity'), P.activity, CH.gold], [t('pgPlanned'), P.planned, CH.mute], [t('pgRunning'), P.running, CH.blue], [t('pgDone'), P.done, CH.ok]].map(x => ({ label:x[0], value:x[1], color:x[2] })), { lw:120 })) : empty('cProgType');
  d.top.length ? put('cTop', hbars(d.top.map(x => ({ label:x.name, value:x.days })))) : empty('cTop');
}

async function loadIns(month){
  try { I.d = await api.insightsData(I.phone, month || ''); I.month = I.d.month; render(); }
  catch(e){ toast(err(e), true); }
}
const go = () => loadIns($('#iYear').value + '-' + $('#iMonth').value);
$('#iYear').onchange = go; $('#iMonth').onchange = go;

$('#mrX').onclick = function(){ doExport(this, () => api.monthlyReportExcel(I.phone, LANG, I.month)); };
$('#mrP').onclick = function(){
  doExport(this, async () => {
    const ids = ['cStatus', 'cTrend', 'cMap', 'cAreas', 'cJuz', 'cDaily'];
    const charts = [];
    for(const id of ids){ const s = $('#' + id + ' svg'); if(s){ const p = await svgToPng(s, 660); if(p) charts.push(p); } }
    return api.monthlyReportPdf(I.phone, LANG, I.month, monthBoth(I.month), logoPng(), charts);
  });
};

(async function init(){
  const g = await adminGuard('insights', 'stats');
  if(!g) return;
  I.phone = g.phone; await loadIns('');
})();
