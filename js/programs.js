/* البرامج والأنشطة الخاصة والجوائز (عرض للجميع، وتحرير للمشرف العام) */
renderBrand(true);
const G = { phone:'', data:null, edit:null };
window.onLangChange = () => { if(G.data){ fillCircles(); render(); } };
applyLang();

function fillCircles(){
  const s = $('#gCircle'), cur = s.value; s.innerHTML = '';
  const a = document.createElement('option'); a.value = '*'; a.textContent = t('pgAll'); s.appendChild(a);
  G.data.teachers.forEach(x => { const o = document.createElement('option'); o.value = x.serial; o.textContent = (x.halaqa || x.name) + ' — ' + x.name; s.appendChild(o); });
  s.value = cur || '*';
}
function render(){
  const box = $('#gList'); box.innerHTML = '';
  const ps = G.data.programs.slice().sort((a, b) => (b.date || '') < (a.date || '') ? -1 : 1);
  if(!ps.length){ box.innerHTML = '<div class="empty"></div>'; box.firstChild.textContent = t('pgNone'); return; }
  const grid = document.createElement('div'); grid.className = 'pgrid';
  ps.forEach(p => {
    const c = progCard(p, true);
    if(G.data.canEdit){
      const r = document.createElement('div'); r.className = 'acts';
      const e = document.createElement('button'); e.className = 'linkbtn'; e.textContent = t('edit'); e.onclick = () => startEdit(p);
      const d = document.createElement('button'); d.className = 'linkbtn danger'; d.textContent = t('del');
      d.onclick = async () => { if(!confirm(t('pgConfirmDel', p.title))) return; try { G.data = await api.programDeleteAdmin(G.phone, p.id); render(); toast(t('pgDeleted')); } catch(x){ toast(err(x), true); } };
      r.append(e, d); c.appendChild(r);
    }
    grid.appendChild(c);
  });
  box.appendChild(grid);
}
function startEdit(p){
  G.edit = p; $('#gType').value = p.type; $('#gStatus').value = p.status; $('#gDate').value = p.date; $('#gTitle').value = p.title;
  $('#gCircle').value = p.serial; $('#gDesc').value = p.desc; $('#gPrize').value = p.prize; $('#gWinners').value = p.winners;
  $('#btnProgCancel').classList.remove('hidden'); window.scrollTo({ top:0, behavior:'smooth' });
}
function resetForm(){ G.edit = null; ['gTitle','gDate','gDesc','gPrize','gWinners'].forEach(i => $('#' + i).value = ''); $('#btnProgCancel').classList.add('hidden'); }
$('#btnProgCancel').onclick = resetForm;
$('#btnProg').onclick = async function(){
  const b = this; load(b, true);
  try {
    G.data = await api.programSaveAdmin(G.phone, { id:G.edit ? G.edit.id : '', type:$('#gType').value, status:$('#gStatus').value, date:$('#gDate').value, title:$('#gTitle').value, serial:$('#gCircle').value, desc:$('#gDesc').value, prize:$('#gPrize').value, winners:$('#gWinners').value });
    resetForm(); render(); toast(t('pgSaved'));
  } catch(e){ toast(err(e), true); } finally { load(b, false); }
};

(async function init(){
  const g = await adminGuard('programs', null);
  if(!g) return;
  G.phone = g.phone;
  try {
    G.data = await api.programsAdmin(G.phone);
    $('#pgForm').classList.toggle('hidden', !G.data.canEdit);
    if(G.data.canEdit) fillCircles();
    render();
  } catch(e){ toast(err(e), true); }
})();
