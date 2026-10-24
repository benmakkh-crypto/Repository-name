/* إدارة النظام: إضافة معلمين، مستخدمين، رسائل البريد، محتوى صفحة عن الحلقات */
renderBrand(true);
const M = { phone:'', users:[], edit:null, about:{} };
const ABOUT_KEYS = ['goals','message','vision','origin','dawah','values','expect','impact'];
const ABOUT_LBL = { goals:'abGoals', message:'abMessage', vision:'abVision', origin:'abOrigin', dawah:'abDawah', values:'abValues', expect:'abExpect', impact:'abImpact' };
const ROLE_LBL = { general:'roleGeneral', supervisor:'roleSupervisor', donor:'roleDonor', viewer:'roleViewer' };
window.onLangChange = () => { fillRoles(); fillAboutKeys(); renderUsers(); };
applyLang();

function showTab(k){
  [['T','mT'],['U','mU'],['A','mA']].forEach(p => { $('#p' + p[0]).classList.toggle('hidden', p[0] !== k); $('#' + p[1]).classList.toggle('on', p[0] === k); });
  if(k === 'U') loadUsers();
  if(k === 'A') loadAbout();
}
$('#mT').onclick = () => showTab('T'); $('#mU').onclick = () => showTab('U'); $('#mA').onclick = () => showTab('A');

/* ----- معلمون ----- */
$('#btnTeacher').onclick = async function(){
  const b = this; load(b, true);
  try {
    const r = await api.teacherAdd(M.phone, { name:$('#tName').value, phone:$('#tPhone').value, email:$('#tMail').value, region:$('#tRegion').value, jiha:$('#tJiha').value, halaqa:$('#tHalaqa').value, students:$('#tStudents').value });
    toast(t('teacherAdded', r.count));
    ['tName','tPhone','tMail','tRegion','tJiha','tHalaqa','tStudents'].forEach(i => $('#' + i).value = '');
  } catch(e){ toast(err(e), true); } finally { load(b, false); }
};
$('#btnMail').onclick = async function(){
  if(!confirm(t('mailConfirm'))) return;
  const b = this; load(b, true);
  try {
    const base = location.href.replace(/[^\/]*$/, '');
    const r = await api.emailLinks(M.phone, [], base);
    $('#mailRes').textContent = t('mailResult', r.sent, r.noEmail.length, r.failed.length) + (r.noEmail.length ? ' — ' + r.noEmail.join('، ') : '');
  } catch(e){ toast(err(e), true); } finally { load(b, false); }
};

/* ----- مستخدمون ----- */
function fillRoles(){
  const s = $('#uRole'), cur = s.value; s.innerHTML = '';
  Object.keys(ROLE_LBL).forEach(r => { const o = document.createElement('option'); o.value = r; o.textContent = t(ROLE_LBL[r]); s.appendChild(o); });
  s.value = cur || 'donor';
}
async function loadUsers(){ try { M.users = await api.usersList(M.phone); renderUsers(); } catch(e){ toast(err(e), true); } }
function accessLink(u){ return location.href.replace(/[^\/]*$/, '') + 'access.html?k=' + u.key; }
function renderUsers(){
  const box = $('#uList'); box.innerHTML = '';
  M.users.forEach(u => {
    const c = document.createElement('div'); c.className = 'card urow';
    const h = document.createElement('div'); h.innerHTML = '<h3></h3><div class="meta"></div>';
    h.querySelector('h3').textContent = u.name;
    h.querySelector('.meta').textContent = u.phone + ' — ' + t(ROLE_LBL[u.role] || 'roleViewer').split(' — ')[0] + ' — ' + t(u.active ? 'userActive' : 'userOff');
    c.appendChild(h);
    const row = document.createElement('div'); row.className = 'acts';
    const mk = (txt, fn) => { const b = document.createElement('button'); b.className = 'linkbtn'; b.textContent = txt; b.onclick = fn; row.appendChild(b); };
    mk(t('userCopy'), async () => { try { await navigator.clipboard.writeText(accessLink(u)); toast(t('linkCopied')); } catch(e){ prompt('', accessLink(u)); } });
    mk(t('userEdit'), () => { M.edit = u; $('#uCode').value = u.phone; $('#uName').value = u.name; $('#uRole').value = u.role; window.scrollTo({ top:0, behavior:'smooth' }); });
    mk(t('userToggle'), () => saveUser({ orig:u.phone, phone:u.phone, name:u.name, role:u.role, active:!u.active }));
    mk(t('userRenew'), () => saveUser({ orig:u.phone, phone:u.phone, name:u.name, role:u.role, active:u.active, renewKey:true }));
    c.appendChild(row); box.appendChild(c);
  });
}
async function saveUser(d){
  try { M.users = await api.userSave(M.phone, d); M.edit = null; renderUsers(); toast(t('userSaved')); } catch(e){ toast(err(e), true); }
}
$('#btnUser').onclick = async function(){
  const b = this; load(b, true);
  await saveUser({ orig:M.edit ? M.edit.phone : '', phone:$('#uCode').value, name:$('#uName').value, role:$('#uRole').value, active:M.edit ? M.edit.active : true });
  $('#uCode').value = ''; $('#uName').value = ''; load(b, false);
};

/* ----- محتوى عن الحلقات ----- */
function fillAboutKeys(){
  const s = $('#abKey'), cur = s.value; s.innerHTML = '';
  ABOUT_KEYS.forEach(k => { const o = document.createElement('option'); o.value = k; o.textContent = t(ABOUT_LBL[k]); s.appendChild(o); });
  s.value = cur || ABOUT_KEYS[0];
}
function showAboutKey(){
  const k = $('#abKey').value, o = M.about[k] || {};
  $('#abAr').value = o.ar || I18N.ar['abt_' + k] || ''; $('#abEn').value = o.en || I18N.en['abt_' + k] || ''; $('#abBn').value = o.bn || I18N.bn['abt_' + k] || '';
}
async function loadAbout(){ try { M.about = (await api.aboutGet()).texts; fillAboutKeys(); showAboutKey(); } catch(e){ toast(err(e), true); } }
$('#abKey').onchange = showAboutKey;
$('#btnAbout').onclick = async function(){
  const b = this; load(b, true);
  try { M.about = await api.aboutSave(M.phone, $('#abKey').value, { ar:$('#abAr').value, en:$('#abEn').value, bn:$('#abBn').value }); toast(t('textSaved')); }
  catch(e){ toast(err(e), true); } finally { load(b, false); }
};

(async function init(){
  const g = await adminGuard('manage', 'manage');
  if(!g) return;
  M.phone = g.phone; fillRoles(); fillAboutKeys();
})();
