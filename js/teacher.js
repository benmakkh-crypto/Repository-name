/* صفحة المعلم: الدخول، التقرير الشهري، الإنجاز اليومي، الطلاب، البيانات */
renderBrand(false);
const S = {};            // الجلسة
const F = {};            // الملفات المختارة
const PHOTOS = [1,2,3,4,5], VIDEOS = [1,2,3];
function show(id){ ['v-login','v-pick','v-app'].forEach(i => $('#'+i).classList.toggle('hidden', i !== id)); }
function updateHDate(){ const v = $('#rdate').value; $('#rdateH').textContent = v ? t('hijriDate', hijriFull(dOf(v))) : ''; }
window.onLangChange = () => { if(S.t){ renderHeader(); renderStatus(); updateHDate(); buildJuz(); renderStudents(); renderDaily(); updateDDate(); } };

/* ================= الدخول ================= */
async function doLogin(){
  const p = $('#phone').value.trim();
  if(p.replace(/\D/g,'').length < 8) return toast(t('enterPhone'), true);
  load($('#btnLogin'), true, t('verifying'));
  try {
    const r = await api.login(p);
    if(!r.ok) throw new Error(r.msg);
    if(r.admin){ const home = r.admin.stats ? 'admin.html' : 'docs.html'; store.set({ admin:true, phone:p, home:home }); location.href = home; return; }
    if(r.teachers.length === 1) await enter(r.teachers[0], p);
    else {
      const box = $('#pickList'); box.innerHTML = '';
      r.teachers.forEach(x => {
        const b = document.createElement('button'); b.className = 'pick';
        b.innerHTML = '<b></b><span></span>'; b.firstChild.textContent = x.name; b.lastChild.textContent = x.halaqa || x.jiha;
        b.onclick = () => enter(x, p).catch(e => toast(err(e), true));
        box.appendChild(b);
      });
      show('v-pick');
    }
  } catch(e){ toast(err(e), true); }
  finally { load($('#btnLogin'), false); }
}

async function enter(x, phone){
  const r = await api.bootstrap(x.row, phone);
  Object.assign(S, { row:x.row, phone:phone, t:r.teacher, w:r.window, reports:r.reports || {} });
  store.set({ row:x.row, phone:phone });
  renderApp(); show('v-app'); tab('r'); loadKpi();
}

function logout(){ store.clear(); Object.keys(F).forEach(k => delete F[k]); S.t = null; $('#phone').value = ''; show('v-login'); }  // خروج المعلم (يستبدل نسخة common.js)

/* ================= واجهة المعلم ================= */
function renderHeader(){
  const x = S.t;
  $('#tName').textContent = x.name;
  $('#tInfo').textContent = [x.halaqa && t('halaqa', x.halaqa), x.jiha, x.students && t('studentsN', x.students)].filter(Boolean).join(' — ');
}

function renderApp(){
  const x = S.t, w = S.w;
  renderHeader();
  $('#pName').value = x.name; $('#pPhone').value = x.phone; $('#pMail').value = x.email || '';
  buildSlots();
  const d = $('#rdate'); d.min = w.min; d.max = w.max; d.value = w.today;
  renderStatus(); updateHDate(); buildJuz(); initDaily();
}

function selMonth(){ const v = $('#rdate').value; return v ? v.slice(0, 7) : S.w.month; }
function renderStatus(){
  const st = $('#status'), m = selMonth(), rep = (S.reports || {})[m];
  $('#formBox').classList.remove('hidden');
  if(rep){ st.className = 'note good'; st.textContent = t('received', monthBoth(m), rep.submittedAt); }
  else { st.className = 'note info'; st.textContent = '🗓 ' + t('openNow', monthBoth(m)); }
}

function tab(k){
  ['r','d','s','g','p'].forEach(x => { const X = x.toUpperCase(); $('#pane' + X).classList.toggle('hidden', k !== x); $('#tab' + X).classList.toggle('on', k === x); });
  if(k === 's') loadStudents().catch(e => toast(err(e), true));
  if(k === 'g') loadPrograms().catch(e => toast(err(e), true));
  if(k === 'd') loadDaily().catch(e => toast(err(e), true));
}

function buildSlots(){
  Object.keys(F).forEach(k => delete F[k]);
  const pg = $('#photoGrid'); pg.innerHTML = '';
  PHOTOS.forEach(i => pg.appendChild(makeSlot('photo' + i, 'photoN', i, true)));
  const vl = $('#videoList'); vl.innerHTML = '';
  VIDEOS.forEach(i => vl.appendChild(makeSlot('video' + i, 'videoN', i, i === 1)));
}

function makeSlot(kind, labelKey, n, req){
  const isV = kind.indexOf('video') === 0;
  const hintKey = req ? 'hintReq' : 'hintOpt';
  const el = document.createElement('label');
  el.className = isV ? 'vrow' : 'slot';
  el.innerHTML = isV
    ? '<span class="ic">🎬</span><span class="t"><b data-i18n="' + labelKey + '" data-a="' + n + '"></b><span data-i18n="' + hintKey + '"></span></span><button type="button" class="x"></button>'
    : '<span class="plus"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg></span><b data-i18n="' + labelKey + '" data-a="' + n + '"></b><small data-i18n="' + (req ? 'req' : 'opt') + '"></small><span class="tick">✔</span><button type="button" class="x"></button>';
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = isV ? 'video/*' : 'image/*'; inp.hidden = true;
  el.prepend(inp);                                   // يجب أن يكون أول عنصر داخل label
  const hint = isV ? el.querySelector('.t span') : null;
  const xb = el.querySelector('.x'); xb.setAttribute('aria-label', t('remove'));
  el.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = t(e.dataset.i18n, ...(e.dataset.a ? e.dataset.a.split(',') : [])); });

  inp.onchange = () => {
    const f = inp.files[0]; if(!f) return;
    const lim = (isV ? 500 : 25);
    if(f.size > lim * 1048576){ inp.value = ''; return toast(t('tooBig', lim), true); }
    F[kind] = f; el.classList.add('has');
    if(isV){ hint.removeAttribute('data-i18n'); hint.textContent = f.name + ' (' + mb(f.size) + ')'; }
    else el.style.backgroundImage = 'url(' + URL.createObjectURL(f) + ')';
  };
  xb.onclick = e => {
    e.preventDefault(); e.stopPropagation();
    delete F[kind]; inp.value = ''; el.classList.remove('has'); el.style.backgroundImage = '';
    if(isV){ hint.setAttribute('data-i18n', hintKey); hint.textContent = t(hintKey); }
  };
  return el;
}

/* ضغط الصور قبل الرفع لتوفير الإنترنت */
async function compress(file){
  try {
    const bmp = await createImageBitmap(file, { imageOrientation:'from-image' });
    const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.82));
    return (b && b.size < file.size) ? b : file;
  } catch(e){ return file; }
}

/* الرفع المباشر إلى Drive */
function put(url, blob, onp){
  return new Promise((ok, no) => {
    const x = new XMLHttpRequest(); x.open('PUT', url);
    x.upload.onprogress = e => { if(e.lengthComputable) onp(e.loaded); };
    x.onload = () => (x.status >= 200 && x.status < 300) ? ok() : no(new Error('HTTP ' + x.status));
    x.onerror = () => no(new Error(t('netcut')));
    x.send(blob.slice(0, blob.size, ''));   // بدون Content-Type لتجنب مشاكل CORS
  });
}

async function uploadOne(it, onp){
  let last;
  for(let a = 0; a < 3; a++){
    try {
      const s = await api.startUpload(S.row, S.phone, selMonth(), it.k, it.name, it.mime, it.blob.size, location.origin);
      try { await put(s.url, it.blob, onp); }
      catch(e){
        // قد يمنع المتصفح قراءة رد Drive رغم نجاح الرفع، فنتحقق من الخادم قبل اعتباره فشلاً
        await sleep(1500);
        let c = { exists:false };
        try { c = await api.checkUpload(S.row, S.phone, selMonth(), s.name, it.blob.size); } catch(_){}
        if(!c.exists) throw e;
      }
      return s.name;
    } catch(e){ last = e; onp(0); await sleep(1500 * (a + 1)); }
  }
  throw new Error(t('failUpload', it.label, err(last)));
}

function busy(on, title){ $('#busy').classList.toggle('hidden', !on); if(title) $('#busyTitle').textContent = title; }
function prog(p, txt){ $('#busyBar').style.width = Math.min(100, Math.round(p * 100)) + '%'; if(txt !== undefined) $('#busyTxt').textContent = txt; }

async function sendReport(){
  for(const i of PHOTOS) if(!F['photo' + i]) return toast(t('pickAllPhotos'), true);
  if(!F.video1) return toast(t('video1Req'), true);
  const date = $('#rdate').value, month = date.slice(0, 7), ml = monthLabel(month);
  if(!date || date < S.w.min || date > S.w.max) return toast(t('dateRange', ml), true);
  if(!confirm(t('confirm', ml))) return;

  busy(true, t('preparing')); prog(0, '');
  try {
    const items = [];
    for(const k of Object.keys(F).sort()){
      const f = F[k], isP = k.indexOf('photo') === 0;
      let blob = f, name = f.name, mime = f.type;
      if(isP){ blob = await compress(f); if(blob !== f){ name = name.replace(/\.[^.]+$/, '') + '.jpg'; mime = 'image/jpeg'; } }
      if(!mime) mime = isP ? 'image/jpeg' : 'video/mp4';
      items.push({ k, blob, name, mime, label: t(isP ? 'photoN' : 'videoN', k.slice(5)) });
    }
    const total = items.reduce((a, i) => a + i.blob.size, 0);
    let done = 0; const stored = {};
    for(let n = 0; n < items.length; n++){
      const it = items[n];
      busy(true, t('uploading', it.label, n + 1, items.length));
      stored[it.k] = await uploadOne(it, loaded => prog((done + loaded) / total, t('ofN', mb(done + loaded), mb(total))));
      done += it.blob.size;
    }
    busy(true, t('saving')); prog(1, '');
    const r = await api.submitReport(S.row, S.phone, {
      month, date, dateH:hijriFull(dOf(date), 'ar'), notes:$('#notes').value,
      photos:PHOTOS.map(i => stored['photo' + i]),
      videos:VIDEOS.map(i => stored['video' + i] || '')
    });
    (S.reports = S.reports || {})[month] = { submittedAt:r.submittedAt, date };
    buildSlots(); $('#notes').value = ''; renderStatus(); window.scrollTo({ top:0, behavior:'smooth' });
    toast(t('sent'));
  } catch(e){ toast(err(e), true); }
  finally { busy(false); }
}

async function saveProfile(){
  const b = $('#btnSave'); load(b, true, t('saving2'));
  try {
    const r = await api.updateProfile(S.row, S.phone, { name:$('#pName').value, phone:$('#pPhone').value, email:$('#pMail').value });
    S.t = r.teacher; S.phone = r.teacher.phone; store.set({ row:S.row, phone:S.phone });
    renderApp(); tab('p'); toast(t('saved'));
  } catch(e){ toast(err(e), true); }
  finally { load(b, false); }
}

/* ================= الطلاب ================= */
const ST = { list:[], declared:'', editing:null };

function buildJuz(){
  const sel = $('#sJuz'); const cur = sel.value; sel.innerHTML = '';
  for(let i = 0; i <= 30; i++){ const o = document.createElement('option'); o.value = i; o.textContent = i === 0 ? t('juzNone') : t('juzN', i); sel.appendChild(o); }
  sel.value = cur || '1';
}

async function loadStudents(){
  const r = await api.listStudents(S.row, S.phone);
  ST.list = r.students; ST.declared = r.declared; renderStudents();
}

function renderStudents(){
  $('#stuCount').textContent = t('stuCount', ST.list.length, ST.declared || '—');
  const box = $('#stuList'); box.innerHTML = '';
  if(!ST.list.length){ box.innerHTML = '<div class="empty"></div>'; box.firstChild.textContent = t('noStudents'); return; }
  ST.list.forEach(s => {
    const d = document.createElement('div'); d.className = 'stu';
    d.innerHTML = '<div><b></b><small></small></div><div class="act"><button></button><button class="dl"></button></div>';
    d.querySelector('b').textContent = s.name;
    d.querySelector('small').textContent = [t('ageN', s.age), s.phone, Number(s.juz) === 0 ? t('juzNone') : t('juzN', s.juz)].filter(Boolean).join(' — ');
    const bs = d.querySelectorAll('button'); bs[0].textContent = t('edit'); bs[1].textContent = t('del');
    bs[0].onclick = () => openStuForm(s);
    bs[1].onclick = () => delStu(s);
    box.appendChild(d);
  });
}

function openStuForm(s){
  ST.editing = s ? s.id : null;
  $('#stuFormTitle').textContent = t(s ? 'editStudent' : 'addStudent');
  $('#sName').value = s ? s.name : ''; $('#sAge').value = s ? s.age : ''; $('#sPhone').value = s ? s.phone : '';
  buildJuz(); $('#sJuz').value = s ? s.juz : 1;
  $('#stuForm').classList.remove('hidden'); $('#stuForm').scrollIntoView({ behavior:'smooth', block:'start' });
}
function closeStuForm(){ $('#stuForm').classList.add('hidden'); ST.editing = null; }

async function saveStu(){
  const b = $('#btnSaveStu'); load(b, true, t('saving2'));
  try {
    const r = await api.saveStudent(S.row, S.phone, { id:ST.editing, name:$('#sName').value, age:$('#sAge').value, phone:$('#sPhone').value, juz:$('#sJuz').value });
    ST.list = r.students; ST.declared = r.declared; renderStudents(); closeStuForm(); toast(t('stuSaved'));
  } catch(e){ toast(err(e), true); }
  finally { load(b, false); }
}

async function delStu(s){
  if(!confirm(t('confirmDel', s.name))) return;
  try { const r = await api.deleteStudent(S.row, S.phone, s.id); ST.list = r.students; ST.declared = r.declared; renderStudents(); toast(t('stuDeleted')); }
  catch(e){ toast(err(e), true); }
}


/* ================= الإنجاز اليومي ================= */
const DY = { list:[] };

function initDaily(){
  const d = $('#dDate'); d.min = S.w.min; d.max = S.w.max; d.value = S.w.today; fillDaily();
}
function updateDDate(){ const v = $('#dDate').value; $('#dDateH').textContent = v ? t('hijriDate', hijriFull(dOf(v))) : ''; }
// عند اختيار يوم سبق تسجيله تُعبّأ الحقول لتعديله
function fillDaily(){
  const e = DY.list.find(x => x.date === $('#dDate').value);
  $('#dAtt').value = e ? e.att : ''; $('#dNew').value = e ? e.newH : ''; $('#dRev').value = e ? e.rev : ''; $('#dNote').value = e ? e.note : '';
  updateDDate();
}
async function loadDaily(){ const r = await api.listDaily(S.row, S.phone); DY.list = r.entries; renderDaily(); fillDaily(); }

function renderDaily(){
  const box = $('#dList'); box.innerHTML = '';
  if(!DY.list.length){ box.innerHTML = '<div class="empty"></div>'; box.firstChild.textContent = t('dNone'); return; }
  DY.list.forEach(e => {
    const d = document.createElement('div'); d.className = 'stu';
    d.innerHTML = '<div><b></b><small></small></div><div class="act"><button></button><button class="dl"></button></div>';
    d.querySelector('b').textContent = dateBoth(e.date);
    d.querySelector('small').textContent = [t('dPresent', e.att), e.newH && t('dNewLbl', e.newH), e.rev && t('dRevLbl', e.rev), e.note].filter(Boolean).join(' • ');
    const bs = d.querySelectorAll('button'); bs[0].textContent = t('edit'); bs[1].textContent = t('del');
    bs[0].onclick = () => { $('#dDate').value = e.date; fillDaily(); $('#dDate').scrollIntoView({ behavior:'smooth', block:'center' }); };
    bs[1].onclick = async () => {
      if(!confirm(t('confirmDelDay', e.date))) return;
      try { const r = await api.deleteDaily(S.row, S.phone, e.date); DY.list = r.entries; renderDaily(); fillDaily(); toast(t('dDeleted')); } catch(x){ toast(err(x), true); }
    };
    box.appendChild(d);
  });
}

async function saveDay(){
  const b = $('#btnSaveDay'); load(b, true, t('saving2'));
  try {
    const r = await api.saveDaily(S.row, S.phone, { date:$('#dDate').value, att:$('#dAtt').value, newH:$('#dNew').value, rev:$('#dRev').value, note:$('#dNote').value });
    DY.list = r.entries; renderDaily(); toast(t('dSaved'));
  } catch(e){ toast(err(e), true); }
  finally { load(b, false); }
}

/* ================= تشغيل ================= */
$('#btnLogin').onclick = doLogin;
$('#phone').addEventListener('keydown', e => { if(e.key === 'Enter') doLogin(); });
$('#btnSend').onclick = sendReport;
$('#btnSave').onclick = saveProfile;
$('#btnAddStu').onclick = () => openStuForm(null);
$('#btnSaveStu').onclick = saveStu;
$('#btnSaveDay').onclick = saveDay;
$('#rdate').onchange = () => { updateHDate(); renderStatus(); };
$('#dDate').onchange = fillDaily;
applyLang();
if(!API_URL) $('#setup').classList.remove('hidden');
(async function init(){
  const s = store.get();
  if(!s) return;
  if(s.admin){ location.replace(s.home || 'docs.html'); return; }
  try { await enter({ row:s.row }, s.phone); } catch(e){ store.clear(); show('v-login'); }
})();


/* ---------- البرامج والأنشطة الخاصة بالحلقة ---------- */
const PG = { list:[], editing:null };
async function loadPrograms(){ PG.list = await api.listPrograms(S.row, S.phone); renderPrograms(); }
function renderPrograms(){
  const box = $('#gList'); box.innerHTML = '';
  if(!PG.list.length){ box.innerHTML = '<div class="empty"></div>'; box.firstChild.textContent = t('pgNone'); return; }
  const grid = document.createElement('div'); grid.className = 'pgrid';
  PG.list.slice().sort((a, b) => (b.date || '') < (a.date || '') ? -1 : 1).forEach(p => {
    const c = progCard(p, false);
    if(!p.mine){ const m = document.createElement('div'); m.className = 'meta'; m.textContent = t('pgGlobal'); c.appendChild(m); }
    else {
      const r = document.createElement('div'); r.className = 'acts';
      const e = document.createElement('button'); e.className = 'linkbtn'; e.textContent = t('edit');
      e.onclick = () => { PG.editing = p; $('#gType').value = p.type; $('#gStatus').value = p.status; $('#gDate').value = p.date; $('#gTitle').value = p.title; $('#gDesc').value = p.desc; $('#gPrize').value = p.prize; $('#gWinners').value = p.winners; $('#btnProgCancel').classList.remove('hidden'); window.scrollTo({ top:0, behavior:'smooth' }); };
      const d = document.createElement('button'); d.className = 'linkbtn danger'; d.textContent = t('del');
      d.onclick = async () => { if(!confirm(t('pgConfirmDel', p.title))) return; try { PG.list = await api.deleteProgram(S.row, S.phone, p.id); renderPrograms(); toast(t('pgDeleted')); } catch(x){ toast(err(x), true); } };
      r.append(e, d); c.appendChild(r);
    }
    grid.appendChild(c);
  });
  box.appendChild(grid);
}
function resetProg(){ PG.editing = null; ['gTitle','gDate','gDesc','gPrize','gWinners'].forEach(i => $('#' + i).value = ''); $('#btnProgCancel').classList.add('hidden'); }
$('#btnProgCancel').onclick = resetProg;
$('#btnProg').onclick = async function(){
  const b = this; load(b, true);
  try {
    PG.list = await api.saveProgram(S.row, S.phone, { id:PG.editing ? PG.editing.id : '', type:$('#gType').value, status:$('#gStatus').value, date:$('#gDate').value, title:$('#gTitle').value, desc:$('#gDesc').value, prize:$('#gPrize').value, winners:$('#gWinners').value });
    resetProg(); renderPrograms(); toast(t('pgSaved'));
  } catch(e){ toast(err(e), true); } finally { load(b, false); }
};


/* أرقام لوحة المعلم */
async function loadKpi(){
  const m = S.w.month, rep = (S.reports || {})[m];
  $('#kRep').textContent = rep ? '✔' : '✖'; $('#kRep').parentNode.className = 'stat ' + (rep ? 'ok' : 'no');
  $('#kStu').textContent = S.t.students || '0';
  try { const r = await api.listStudents(S.row, S.phone); $('#kStu').textContent = r.students.length; } catch(e){}
  try { const r = await api.listDaily(S.row, S.phone); $('#kDays').textContent = r.entries.filter(e => e.date.indexOf(m) === 0).length; } catch(e){}
  try { const r = await api.listPrograms(S.row, S.phone); $('#kProg').textContent = r.length; } catch(e){}
}
