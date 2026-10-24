/**
 * نظام التقارير الشهرية لمعلمي حلقات القرآن الكريم - بنغلاديش
 * حلقات الشيخ عبد الرحمن البلاع | بتنفيذ شركة الأمة للخدمات الإنسانية
 *
 * يجب أن يكون السكربت "مرتبطاً" بملف الجدول (من الجدول: الإضافات > Apps Script)
 * الواجهة (HTML) مستضافة على GitHub Pages، وهذا السكربت هو الخادم (API) فقط.
 */

const CONFIG = {
  ROOT_FOLDER_NAME: 'تقارير حلقات القرآن - بنغلاديش', // مجلد جذر في Drive (يُنشأ تلقائياً)
  TEACHERS_SHEET: '',          // اتركه فارغاً = أول ورقة في الملف، أو اكتب اسم ورقة المعلمين
  REPORTS_SHEET: 'التقارير',   // ورقة تُنشأ تلقائياً لتسجيل التقارير
  STUDENTS_SHEET: 'الطلاب',    // ورقة تُنشأ تلقائياً لبيانات الطلاب
  DAILY_SHEET: 'الإنجاز اليومي', // ورقة تُنشأ تلقائياً للإنجازات اليومية
  CLOSE_DAY: 29,               // الرفع مفتوح من يوم 1 إلى يوم 29 من كل شهر (لتقرير الشهر الحالي)، ثم يُقفل ويفتح للشهر الجديد يوم 1
  START_YEAR: 2026,            // أول سنة في لوحة الإدارة
  YEARS_AHEAD: 10,             // ولوحة الإدارة تعرض حتى 10 سنوات قادمة (يتجدد تلقائياً كل سنة)
  TEST_MODE: false,            // true = الرفع مفتوح دائماً (للتجربة فقط)
  PHOTOS_COUNT: 5,
  MAX_PHOTO_MB: 25,
  MAX_VIDEO_MB: 500,
  TZ: 'Asia/Dhaka',
  // حسابات الإدارة (الدخول برقم الرمز في خانة الجوال)
  //  stats    = يرى إحصائية من رفع ومن لم يرفع
  //  contacts = يرى أرقام المعلمين وأزرار الاتصال/واتساب
  //  media    = يرى الصور والفيديوهات
  //  export   = يستخرج ملفات Excel و PDF
  ACCOUNTS: [
    { phone: '55551111', role: 'general',    name: 'المشرف العام',      stats: true,  contacts: true,  media: true,  export: true },
    { phone: '55667788', role: 'supervisor', name: 'المشرف المتابع',    stats: true,  contacts: true,  media: true,  export: false },
    { phone: '55552222', role: 'viewer',     name: 'حساب الاطلاع',      stats: false, contacts: false, media: true,  export: false }  // ← غيّر هذا الرقم
  ]
};

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const REPORT_HEADERS = ['وقت الإرسال', 'شهر التقرير', 'تاريخ التقرير', 'التسلسل', 'اسم المعلم', 'الجوال', 'الحلقة', 'الجهة', 'المنطقة',
  'صورة 1', 'صورة 2', 'صورة 3', 'صورة 4', 'صورة 5', 'فيديو 1 (إلزامي)', 'فيديو 2', 'فيديو 3', 'ملاحظات', 'مجلد المعلم', 'عدد مرات الإرسال', 'التاريخ الهجري'];

/* ================= أدوات ================= */
function clean_(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

// توحيد رقم الجوال: يقبل 01862 668028 أو 1862668028 أو +880 1862-668028 وأرقام عربية/بنغالية
function normPhone_(p) {
  let s = String(p || '');
  s = s.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));
  s = s.replace(/\D/g, '');
  if (s.indexOf('00') === 0) s = s.slice(2);
  if (s.indexOf('880') === 0) s = s.slice(3);
  return s.replace(/^0+/, '');
}

/** قراءة ورقة المعلمين: يكتشف صف العناوين والأعمدة تلقائياً من أسمائها */
function teachersInfo_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = CONFIG.TEACHERS_SHEET ? ss.getSheetByName(CONFIG.TEACHERS_SHEET) : ss.getSheets()[0];
  const vals = sh.getDataRange().getValues();
  let h = -1;
  for (let i = 0; i < Math.min(vals.length, 15); i++) {
    if (vals[i].some(c => clean_(c).indexOf('الجوال') > -1)) { h = i; break; }
  }
  if (h < 0) throw new Error('E_NOHEADER');

  const col = {};
  vals[h].forEach((c, i) => {
    const t = clean_(c);
    if (t === 'التسلسل') col.serial = i;
    else if (t === 'الاسم') col.name = i;
    else if (t === 'المنطقة') col.region = i;
    else if (t.indexOf('الجوال') > -1) col.phone = i;
    else if (t.indexOf('اسم الجهة') > -1) col.jiha = i;
    else if (t.indexOf('اسم الحلقة') > -1) col.halaqa = i;
    else if (t.indexOf('عدد الطلاب') > -1) col.students = i;
    else if (t.indexOf('البريد') > -1) col.email = i;
  });
  if (col.email === undefined) {               // إضافة عمود البريد تلقائياً
    col.email = vals[h].length;
    sh.getRange(h + 1, col.email + 1).setValue('البريد الإلكتروني');
  }

  const list = [];
  for (let i = h + 1; i < vals.length; i++) {
    const r = vals[i];
    const name = clean_(r[col.name]);
    const pn = normPhone_(r[col.phone]);
    if (!name || !pn) continue;
    if (clean_(r[col.jiha]).indexOf('المشرف') > -1) continue; // استثناء صف المشرف المتابع
    list.push({
      row: i + 1,
      serial: clean_(r[col.serial]) || String(i - h),
      name: name,
      phone: clean_(r[col.phone]),
      phoneN: pn,
      region: clean_(r[col.region]),
      jiha: clean_(r[col.jiha]),
      halaqa: clean_(r[col.halaqa]),
      students: clean_(r[col.students]),
      email: clean_(r[col.email])
    });
  }
  return { sh: sh, col: col, list: list };
}

function pub_(t) {
  return { row: t.row, serial: t.serial, name: t.name, phone: t.phone, region: t.region, jiha: t.jiha, halaqa: t.halaqa, students: t.students, email: t.email };
}

/** التحقق من الجلسة: رقم الصف + الجوال يجب أن يتطابقا مع الجدول */
function auth_(row, phone) {
  const info = teachersInfo_();
  const t = info.list.find(x => x.row === Number(row) && x.phoneN === normPhone_(phone));
  if (!t) throw new Error('E_SESSION');
  return { info: info, t: t };
}

/** نافذة الرفع: مفتوحة من يوم 1 إلى يوم CLOSE_DAY (29) لتقرير الشهر الحالي، وتتجدد تلقائياً كل شهر */
function window_() {
  const now = new Date();
  const f = p => +Utilities.formatDate(now, CONFIG.TZ, p);
  const y = f('yyyy'), m = f('M'), d = f('d');
  const p2 = n => ('0' + n).slice(-2);
  const last = new Date(y, m, 0).getDate();
  return {
    open: CONFIG.TEST_MODE || d <= CONFIG.CLOSE_DAY,
    month: y + '-' + p2(m),
    label: MONTHS_AR[m - 1] + ' ' + y,
    min: y + '-' + p2(m) + '-01',
    max: y + '-' + p2(m) + '-' + p2(last),
    today: Utilities.formatDate(now, CONFIG.TZ, 'yyyy-MM-dd'),
    closeDay: CONFIG.CLOSE_DAY,
    photos: CONFIG.PHOTOS_COUNT
  };
}

/* ================= ورقة التقارير ================= */
function reportsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG.REPORTS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.REPORTS_SHEET);
    sh.getRange('B:C').setNumberFormat('@'); // حتى لا يتحول 2026-10 إلى تاريخ
    sh.appendRow(REPORT_HEADERS);
    sh.setFrozenRows(1);
    sh.setRightToLeft(true);
    sh.getRange(1, 1, 1, REPORT_HEADERS.length).setFontWeight('bold').setBackground('#123c34').setFontColor('#ffffff');
  }
  const hc = REPORT_HEADERS.length;                    // إضافة عمود التاريخ الهجري للجداول القديمة
  if (!sh.getRange(1, hc).getValue()) sh.getRange(1, hc).setValue(REPORT_HEADERS[hc - 1]).setFontWeight('bold').setBackground('#123c34').setFontColor('#ffffff');
  return sh;
}

function findReport_(sh, serial, month) {
  const v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    if (String(v[i][3]) === String(serial) && String(v[i][1]) === month) return { row: i + 1, vals: v[i] };
  }
  return null;
}

/* ================= واجهات الصفحة ================= */
function account_(phone) {
  const n = normPhone_(phone);
  return CONFIG.ACCOUNTS.find(a => normPhone_(a.phone) === n) || null;
}

function login(phone) {
  const n = normPhone_(phone);
  const acc = account_(phone);
  if (acc) return { ok: true, admin: { role: acc.role, name: acc.name, stats: acc.stats, contacts: acc.contacts, media: acc.media, export: !!acc.export } };
  if (n.length < 9) return { ok: false, msg: 'E_PHONE' };
  const m = teachersInfo_().list.filter(x => x.phoneN === n);
  if (!m.length) return { ok: false, msg: 'E_NOTFOUND' };
  return { ok: true, teachers: m.map(pub_) };
}

function bootstrap(row, phone) {
  const a = auth_(row, phone);
  const w = window_();
  const rep = findReport_(reportsSheet_(), a.t.serial, w.month);
  return {
    teacher: pub_(a.t),
    window: w,
    report: rep ? { date: String(rep.vals[2]), submittedAt: String(rep.vals[0]), count: rep.vals[19] } : null
  };
}

function updateProfile(row, phone, data) {
  const a = auth_(row, phone);
  const name = clean_(data.name), newPhone = clean_(data.phone), email = clean_(data.email);
  if (name.length < 3) throw new Error('E_NAME');
  const pn = normPhone_(newPhone);
  if (pn.length < 9) throw new Error('E_PHONE');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E_EMAIL');
  if (a.info.list.some(x => x.row !== a.t.row && x.phoneN === pn)) throw new Error('E_DUP');

  const sh = a.info.sh, c = a.info.col;
  sh.getRange(a.t.row, c.name + 1).setValue(name);
  sh.getRange(a.t.row, c.phone + 1).setNumberFormat('@').setValue(newPhone);
  sh.getRange(a.t.row, c.email + 1).setValue(email);
  SpreadsheetApp.flush();
  return { ok: true, teacher: pub_(teachersInfo_().list.find(x => x.row === a.t.row)) };
}

/* ================= الرفع إلى Drive ================= */
function sub_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function teacherFolder_(t, month) {
  const it = DriveApp.getFoldersByName(CONFIG.ROOT_FOLDER_NAME);
  const root = it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.ROOT_FOLDER_NAME);
  return sub_(sub_(root, month), t.serial + ' - ' + t.name.replace(/[\/\\]/g, ' '));
}

/**
 * تجهيز جلسة رفع مباشرة من متصفح المعلم إلى Drive (Resumable Upload)
 * يتطلب تفعيل خدمة Drive API من Services في Apps Script
 */
function startUpload(row, phone, month, kind, fileName, mime, size, origin) {
  const a = auth_(row, phone);
  const w = window_();
  if (!w.open) throw new Error('E_CLOSED');
  if (month !== w.month) throw new Error('E_MONTH');
  const m = /^(photo|video)([1-5])$/.exec(kind);
  if (!m) throw new Error('E_KIND');
  const isPhoto = m[1] === 'photo';
  if (isPhoto && Number(m[2]) > CONFIG.PHOTOS_COUNT) throw new Error('E_KIND');
  if (!isPhoto && Number(m[2]) > 3) throw new Error('E_KIND');
  mime = String(mime || '');
  if (mime.indexOf(isPhoto ? 'image/' : 'video/') !== 0) throw new Error(isPhoto ? 'E_NOTIMG' : 'E_NOTVID');
  size = Number(size);
  const maxMB = isPhoto ? CONFIG.MAX_PHOTO_MB : CONFIG.MAX_VIDEO_MB;
  if (!(size > 0) || size > maxMB * 1024 * 1024) throw new Error('E_SIZE|' + maxMB);

  const ext = (String(fileName).match(/\.([A-Za-z0-9]{2,5})$/) || [, isPhoto ? 'jpg' : 'mp4'])[1].toLowerCase();
  const stored = kind + '_' + Date.now() + '_' + Math.floor(Math.random() * 1e5) + '.' + ext;
  const folder = teacherFolder_(a.t, month);

  // الأصل (Origin) مطلوب لتسمح Google للمتصفح بقراءة رد الرفع من صفحة على نطاق آخر (GitHub Pages)
  const init = withOrigin => {
    const headers = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(size) };
    if (withOrigin) headers.Origin = origin;
    return UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true', {
      method: 'post', contentType: 'application/json; charset=UTF-8', headers: headers,
      payload: JSON.stringify({ name: stored, parents: [folder.getId()] }), muteHttpExceptions: true
    });
  };
  const okOrigin = /^https?:\/\/[A-Za-z0-9.\-]+(:\d+)?$/.test(String(origin || ''));
  let res;
  try { res = init(okOrigin); } catch (e) { res = null; }
  if (!res || res.getResponseCode() !== 200) res = init(false);
  if (res.getResponseCode() !== 200) throw new Error('E_PREP|' + res.getResponseCode());
  const hd = res.getAllHeaders();
  const key = Object.keys(hd).find(k => k.toLowerCase() === 'location');
  return { url: hd[key], name: stored };
}

/** يتأكد أن الملف اكتمل رفعه (يُستخدم إذا منع المتصفح قراءة رد Drive رغم نجاح الرفع) */
function checkUpload(row, phone, month, name, size) {
  const a = auth_(row, phone);
  if (!/^(photo|video)[1-5]_\d+_\d+\.[a-z0-9]{2,5}$/.test(String(name))) throw new Error('E_BAD');
  const it = teacherFolder_(a.t, String(month)).getFilesByName(String(name));
  return { exists: it.hasNext() && it.next().getSize() === Number(size) };
}

/** حفظ التقرير بعد اكتمال رفع كل الملفات */
function submitReport(row, phone, data) {
  const a = auth_(row, phone);
  const w = window_();
  if (!w.open) throw new Error('E_CLOSED');
  if (data.month !== w.month) throw new Error('E_MONTH');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || data.date.indexOf(w.month) !== 0) throw new Error('E_DATE');

  const safe = n => !n || /^(photo|video)[1-5]_\d+_\d+\.[a-z0-9]{2,5}$/.test(n);
  const photos = (data.photos || []).slice(0, CONFIG.PHOTOS_COUNT);
  const videos = (data.videos || []).slice(0, 3);
  if (photos.length !== CONFIG.PHOTOS_COUNT || photos.some(n => !n)) throw new Error('E_PHOTOS');
  if (!videos[0]) throw new Error('E_VIDEO1');
  if (!photos.concat(videos).every(safe)) throw new Error('E_BAD');

  const folder = teacherFolder_(a.t, w.month);
  const link = n => {
    if (!n) return '';
    const it = folder.getFilesByName(n);
    if (!it.hasNext()) throw new Error('E_INCOMPLETE');
    const f = it.next();
    try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {} // للمعاينة داخل لوحة الإدارة
    return f.getUrl();
  };
  const urls = photos.map(link).concat([0, 1, 2].map(i => link(videos[i])));

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = reportsSheet_();
    const old = findReport_(sh, a.t.serial, w.month);
    const now = Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm');
    const rowVals = [now, w.month, data.date, a.t.serial, a.t.name, a.t.phone, a.t.halaqa, a.t.jiha, a.t.region]
      .concat(urls, [clean_(data.notes).slice(0, 1000), folder.getUrl(), old ? (Number(old.vals[19]) || 1) + 1 : 1, clean_(data.dateH).slice(0, 60)]);
    if (old) { sh.getRange(old.row, 21).setNumberFormat('@'); sh.getRange(old.row, 1, 1, rowVals.length).setValues([rowVals]); }
    else { const r = sh.getLastRow() + 1; sh.getRange(r, 2, 1, 2).setNumberFormat('@'); sh.getRange(r, 21).setNumberFormat('@'); sh.getRange(r, 1, 1, rowVals.length).setValues([rowVals]); }
  } finally { lock.releaseLock(); }
  return { ok: true, submittedAt: Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm') };
}

/* ================= لوحة الإدارة ================= */
function idOf_(url) { const m = /\/d\/([^\/?]+)/.exec(String(url || '')); return m ? m[1] : ''; }

function adminData(phone, month) {
  const acc = account_(phone);
  if (!acc) throw new Error('E_AUTH');
  const w = window_();
  const yTo = +w.month.slice(0, 4) + CONFIG.YEARS_AHEAD;
  const my = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month || '');
  month = (my && +my[1] >= CONFIG.START_YEAR && +my[1] <= yTo) ? month : w.month;

  const v = reportsSheet_().getDataRange().getValues();
  const byKey = {};
  for (let i = 1; i < v.length; i++) {
    if (String(v[i][1]) === month) byKey[String(v[i][3])] = v[i];
  }

  const list = teachersInfo_().list;
  const regCount = {};
  readStudents_().forEach(s => { regCount[s.serial] = (regCount[s.serial] || 0) + 1; });
  let rows = list.map(t => {
    const r = byKey[String(t.serial)];
    const o = { serial: t.serial, name: t.name, halaqa: t.halaqa, jiha: t.jiha, region: t.region, students: t.students, registered: regCount[String(t.serial)] || 0, submitted: !!r };
    if (acc.contacts) { o.phone = t.phone; o.email = t.email; o.wa = '880' + t.phoneN; }
    if (r) {
      o.date = String(r[2]); o.submittedAt = String(r[0]); o.count = r[19]; o.notes = String(r[17] || ''); o.dateH = String(r[20] || '');
      if (acc.media) {
        o.photos = [9, 10, 11, 12, 13].map(k => idOf_(r[k])).filter(Boolean);
        o.videos = [14, 15, 16].map(k => idOf_(r[k])).filter(Boolean);
      }
    }
    return o;
  });
  if (!acc.stats) rows = rows.filter(o => o.submitted);   // حساب الاطلاع يرى الحلقات المرفوعة فقط

  const done = list.filter(t => byKey[String(t.serial)]).length;
  return {
    account: { role: acc.role, name: acc.name, stats: acc.stats, contacts: acc.contacts, export: !!acc.export },
    month: month,
    years: { from: CONFIG.START_YEAR, to: yTo },
    stats: acc.stats ? { total: list.length, submitted: done, missing: list.length - done } : null,
    rows: rows
  };
}

/* ================= الطلاب (لكل حلقة على حدة) ================= */
const STUDENT_HEADERS = ['المعرف', 'تسلسل المعلم', 'اسم المعلم', 'الحلقة', 'اسم الطالب', 'العمر', 'الجوال', 'جزء الحفظ', 'تاريخ الإضافة', 'آخر تعديل'];

function studentsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG.STUDENTS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.STUDENTS_SHEET);
    ['B:B', 'G:G', 'I:J'].forEach(r => sh.getRange(r).setNumberFormat('@'));
    sh.appendRow(STUDENT_HEADERS);
    sh.setFrozenRows(1);
    sh.setRightToLeft(true);
    sh.getRange(1, 1, 1, STUDENT_HEADERS.length).setFontWeight('bold').setBackground('#123c34').setFontColor('#ffffff');
  }
  return sh;
}

function readStudents_() {
  const v = studentsSheet_().getDataRange().getValues();
  const out = [];
  for (let i = 1; i < v.length; i++) {
    const r = v[i];
    if (!r[0]) continue;
    out.push({ sheetRow: i + 1, id: String(r[0]), serial: String(r[1]), name: clean_(r[4]), age: r[5], phone: clean_(r[6]), juz: r[7], added: String(r[8]) });
  }
  return out;
}

function pubStudent_(s) { return { id: s.id, name: s.name, age: s.age, phone: s.phone, juz: s.juz }; }

function listStudents(row, phone) {
  const a = auth_(row, phone);
  return { students: readStudents_().filter(s => s.serial === String(a.t.serial)).map(pubStudent_), declared: a.t.students };
}

function saveStudent(row, phone, d) {
  const a = auth_(row, phone);
  const name = clean_(d.name), sphone = clean_(d.phone);
  const age = Number(d.age), juz = Number(d.juz);
  if (name.length < 3) throw new Error('E_SNAME');
  if (!(age >= 3 && age <= 90) || Math.floor(age) !== age) throw new Error('E_SAGE');
  if (sphone && !/^[\d\s+\-]{7,20}$/.test(sphone)) throw new Error('E_SPHONE');
  if (!(juz >= 0 && juz <= 30) || Math.floor(juz) !== juz) throw new Error('E_SJUZ');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = studentsSheet_();
    const now = Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm');
    if (d.id) {
      const s = readStudents_().find(x => x.id === String(d.id) && x.serial === String(a.t.serial));
      if (!s) throw new Error('E_SNOTFOUND');
      sh.getRange(s.sheetRow, 1, 1, 10).setValues([[s.id, a.t.serial, a.t.name, a.t.halaqa, name, age, sphone, juz, s.added, now]]);
    } else {
      const id = Utilities.getUuid().slice(0, 8);
      const r = sh.getLastRow() + 1;
      sh.getRange(r, 1, 1, 10).setValues([[id, a.t.serial, a.t.name, a.t.halaqa, name, age, sphone, juz, now, now]]);
    }
  } finally { lock.releaseLock(); }
  return listStudents(row, phone);
}

function deleteStudent(row, phone, id) {
  const a = auth_(row, phone);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const s = readStudents_().find(x => x.id === String(id) && x.serial === String(a.t.serial));
    if (!s) throw new Error('E_SNOTFOUND');
    studentsSheet_().deleteRow(s.sheetRow);
  } finally { lock.releaseLock(); }
  return listStudents(row, phone);
}

/** عرض طلاب معلم للإدارة (للحسابات التي تملك صلاحية contacts) */
function adminStudents(phone, serial) {
  const acc = account_(phone);
  if (!acc || !acc.contacts) throw new Error('E_AUTH');
  return { students: readStudents_().filter(s => s.serial === String(serial)).map(pubStudent_) };
}

/* ================= التصدير: Excel و PDF (للحسابات التي لها export) ================= */
const L_ = {
  ar: { dir: 'rtl', title: 'تقرير حلقات القرآن الكريم', sheikh: 'حلقات الشيخ عبد الرحمن البلاع حفظه الله تعالى', sup: 'بإشراف الشيخ أبو محمد حفظه الله تعالى', co: 'بتنفيذ شركة الأمة للخدمات الإنسانية',
    num: 'م', teacher: 'المعلم', phone: 'الجوال', email: 'البريد الإلكتروني', halaqa: 'الحلقة', jiha: 'الجهة', region: 'المنطقة',
    declared: 'عدد الطلاب (حسب الكشف)', registered: 'الطلاب المسجلون', student: 'اسم الطالب', age: 'العمر', juz: 'جزء الحفظ',
    sSummary: 'ملخص المعلمين', sStudents: 'الطلاب', sReports: 'التقارير', fSummary: 'عدد الطلاب لكل معلم', fReports: 'تقارير الحلقات',
    month: 'الشهر', status: 'الحالة', yes: 'تم الرفع', no: 'لم يرفع', repG: 'تاريخ التقرير (ميلادي)', repH: 'تاريخ التقرير (هجري)', sentAt: 'وقت الإرسال',
    notes: 'ملاحظات', photo: 'صورة', video: 'فيديو', photos: 'الصور', videos: 'المقاطع', report: 'تقرير شهر', teacherData: 'بيانات المعلم', repData: 'بيانات التقرير', issued: 'تاريخ الإصدار' },
  en: { dir: 'ltr', title: 'Holy Quran Circles Report', sheikh: 'Circles of Sheikh Abdulrahman Al-Balaa, may Allah preserve him', sup: 'Supervised by Sheikh Abu Muhammad, may Allah preserve him', co: 'Implemented by Al-Ummah Company for Humanitarian Services',
    num: '#', teacher: 'Teacher', phone: 'Mobile', email: 'Email', halaqa: 'Circle', jiha: 'Institution', region: 'Area',
    declared: 'Students (per list)', registered: 'Registered students', student: 'Student name', age: 'Age', juz: 'Memorization (juz)',
    sSummary: 'Teachers summary', sStudents: 'Students', sReports: 'Reports', fSummary: 'Students per teacher', fReports: 'Circles reports',
    month: 'Month', status: 'Status', yes: 'Submitted', no: 'Not submitted', repG: 'Report date (Gregorian)', repH: 'Report date (Hijri)', sentAt: 'Sent at',
    notes: 'Notes', photo: 'Photo', video: 'Video', photos: 'Photos', videos: 'Videos', report: 'Report for', teacherData: 'Teacher details', repData: 'Report details', issued: 'Issued on' },
  bn: { dir: 'ltr', title: 'কুরআন হালাকা মাসিক প্রতিবেদন', sheikh: 'শাইখ আব্দুর রহমান আল-বাল্লা (হাফিযাহুল্লাহ)-এর হালাকাসমূহ', sup: 'তত্ত্বাবধানে: শাইখ আবু মুহাম্মাদ (হাফিযাহুল্লাহ)', co: 'বাস্তবায়নে: আল-উম্মাহ মানবিক সেবা কোম্পানি',
    num: 'নং', teacher: 'শিক্ষক', phone: 'মোবাইল', email: 'ইমেইল', halaqa: 'হালাকা', jiha: 'প্রতিষ্ঠান', region: 'এলাকা',
    declared: 'ছাত্র সংখ্যা (তালিকা অনুযায়ী)', registered: 'নিবন্ধিত ছাত্র', student: 'ছাত্রের নাম', age: 'বয়স', juz: 'হিফজের পারা',
    sSummary: 'শিক্ষকদের সারসংক্ষেপ', sStudents: 'ছাত্রগণ', sReports: 'প্রতিবেদন', fSummary: 'শিক্ষকভিত্তিক ছাত্র সংখ্যা', fReports: 'হালাকার প্রতিবেদন',
    month: 'মাস', status: 'অবস্থা', yes: 'জমা হয়েছে', no: 'জমা হয়নি', repG: 'প্রতিবেদনের তারিখ (ইংরেজি)', repH: 'প্রতিবেদনের তারিখ (হিজরি)', sentAt: 'পাঠানোর সময়',
    notes: 'মন্তব্য', photo: 'ছবি', video: 'ভিডিও', photos: 'ছবিসমূহ', videos: 'ভিডিওসমূহ', report: 'প্রতিবেদন:', teacherData: 'শিক্ষকের তথ্য', repData: 'প্রতিবেদনের তথ্য', issued: 'প্রকাশের তারিখ' }
};

function exportAcc_(phone) {
  const a = account_(phone);
  if (!a || !a.export) throw new Error('E_AUTH');
  return a;
}

/** ينشئ ملف Excel (xlsx) عبر جدول مؤقت ثم يحذفه، ويعيده base64 */
function xlsx_(fileName, sheets, rtl) {
  const ss = SpreadsheetApp.create(fileName);
  try {
    sheets.forEach((s, i) => {
      const sh = i === 0 ? ss.getSheets()[0].setName(s.title) : ss.insertSheet(s.title);
      const n = s.header.length;
      (s.textCols || []).forEach(c => sh.getRange(1, c, s.rows.length + 1, 1).setNumberFormat('@'));
      sh.getRange(1, 1, s.rows.length + 1, n).setValues([s.header].concat(s.rows));
      sh.setRightToLeft(rtl);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, n).setFontWeight('bold').setBackground('#123c34').setFontColor('#ffffff');
      sh.autoResizeColumns(1, n);
      if (s.narrowFrom) for (let c = s.narrowFrom; c <= n; c++) sh.setColumnWidth(c, 110);
    });
    SpreadsheetApp.flush();
    const res = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx', {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) throw new Error('E_EXPORT');
    return { name: fileName + '.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', b64: Utilities.base64Encode(res.getBlob().getBytes()) };
  } finally {
    try { DriveApp.getFileById(ss.getId()).setTrashed(true); } catch (e) {}
  }
}

/** Excel الطلاب: serial = رقم معلم، أو 'all' لكل المعلمين (ملخص العدد + بيانات الطلاب) */
function exportStudents(phone, lang, serial) {
  exportAcc_(phone);
  const L = L_[lang] || L_.ar;
  let teachers = teachersInfo_().list;
  if (serial !== 'all') {
    teachers = teachers.filter(t => String(t.serial) === String(serial));
    if (!teachers.length) throw new Error('E_NOTEACHER');
  }
  const all = readStudents_();
  const sumRows = [], stuRows = [];
  teachers.forEach((t, i) => {
    const mine = all.filter(s => s.serial === String(t.serial));
    sumRows.push([i + 1, t.name, t.phone, t.halaqa, t.jiha, t.region, Number(t.students) || 0, mine.length]);
    mine.forEach((s, j) => stuRows.push([j + 1, t.name, t.halaqa, s.name, s.age, s.phone, s.juz]));
  });
  const name = serial === 'all' ? L.fSummary : L.sStudents + ' - ' + teachers[0].name;
  return xlsx_(name, [
    { title: L.sSummary, header: [L.num, L.teacher, L.phone, L.halaqa, L.jiha, L.region, L.declared, L.registered], rows: sumRows, textCols: [3] },
    { title: L.sStudents, header: [L.num, L.teacher, L.halaqa, L.student, L.age, L.phone, L.juz], rows: stuRows, textCols: [6] }
  ], L.dir === 'rtl');
}

/** Excel تقارير شهر معين لكل المعلمين (الحالة + التواريخ + الروابط) */
function exportReportsExcel(phone, lang, month) {
  exportAcc_(phone);
  const L = L_[lang] || L_.ar;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) throw new Error('E_MONTH');
  const v = reportsSheet_().getDataRange().getValues();
  const byKey = {};
  for (let i = 1; i < v.length; i++) if (String(v[i][1]) === month) byKey[String(v[i][3])] = v[i];
  const header = [L.num, L.month, L.teacher, L.phone, L.halaqa, L.jiha, L.region, L.status, L.repG, L.repH, L.sentAt, L.notes]
    .concat([1, 2, 3, 4, 5].map(i => L.photo + ' ' + i), [1, 2, 3].map(i => L.video + ' ' + i));
  const rows = teachersInfo_().list.map((t, i) => {
    const r = byKey[String(t.serial)];
    const base = [i + 1, month, t.name, t.phone, t.halaqa, t.jiha, t.region, r ? L.yes : L.no];
    if (!r) return base.concat(['', '', '', ''], new Array(8).fill(''));
    return base.concat([String(r[2]), String(r[20] || ''), String(r[0]), String(r[17] || '')], [9, 10, 11, 12, 13, 14, 15, 16].map(k => String(r[k] || '')));
  });
  return xlsx_(L.fReports + ' ' + month, [{ title: L.sReports, header: header, rows: rows, textCols: [2, 4], narrowFrom: 13 }], L.dir === 'rtl');
}

function esc_(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

/** PDF تقرير معلم لشهر معين: بيانات المعلم + بيانات التقرير + الصور + روابط الفيديو */
function exportReportPdf(phone, lang, month, serial, monthLabel, logoPng) {
  exportAcc_(phone);
  const L = L_[lang] || L_.ar;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) throw new Error('E_MONTH');
  const t = teachersInfo_().list.find(x => String(x.serial) === String(serial));
  if (!t) throw new Error('E_NOTEACHER');
  const rep = findReport_(reportsSheet_(), t.serial, month);
  if (!rep) throw new Error('E_NOREPORT');
  const r = rep.vals;
  const registered = readStudents_().filter(s => s.serial === String(t.serial)).length;

  const imgs = [9, 10, 11, 12, 13].map(k => idOf_(r[k])).filter(Boolean).map(id => {
    const b = DriveApp.getFileById(id).getBlob();
    return 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes());
  });
  const vids = [14, 15, 16].map(k => String(r[k] || '')).filter(Boolean);
  const logo = /^data:image\/png;base64,[A-Za-z0-9+\/=]+$/.test(logoPng || '') && logoPng.length < 500000 ? logoPng : '';
  const align = L.dir === 'rtl' ? 'right' : 'left';
  const row = (k, v) => '<tr><td style="width:34%;background:#eef3ef;font-weight:bold;padding:6px 8px;border:1px solid #c9d4cc">' + esc_(k) + '</td><td style="padding:6px 8px;border:1px solid #c9d4cc">' + esc_(v) + '</td></tr>';

  let html = '<html dir="' + L.dir + '"><body style="font-family:Arial,sans-serif;text-align:' + align + ';color:#17251f">';
  html += '<div style="text-align:center">' + (logo ? '<img src="' + logo + '" width="150"><br>' : '') +
    '<h2 style="margin:6px 0;color:#123c34">' + esc_(L.title) + '</h2>' +
    '<div style="font-size:13px">' + esc_(L.sheikh) + '<br>' + esc_(L.sup) + '<br>' + esc_(L.co) + '</div></div><hr>';
  html += '<h3 style="color:#123c34">' + esc_(L.report) + ' ' + esc_(monthLabel || month) + '</h3>';
  html += '<h4>' + esc_(L.teacherData) + '</h4><table style="width:100%;border-collapse:collapse">' +
    row(L.teacher, t.name) + row(L.phone, t.phone) + row(L.email, t.email || '-') + row(L.halaqa, t.halaqa) + row(L.jiha, t.jiha) + row(L.region, t.region) +
    row(L.declared, t.students) + row(L.registered, registered) + '</table>';
  html += '<h4>' + esc_(L.repData) + '</h4><table style="width:100%;border-collapse:collapse">' +
    row(L.repG, r[2]) + row(L.repH, r[20] || '-') + row(L.sentAt, r[0]) + row(L.notes, r[17] || '-') + '</table>';
  html += '<h4>' + esc_(L.photos) + '</h4><table style="width:100%"><tr>';
  imgs.forEach((src, i) => {
    html += '<td style="width:50%;padding:4px;text-align:center"><img src="' + src + '" width="300"></td>';
    if (i % 2 === 1 && i < imgs.length - 1) html += '</tr><tr>';
  });
  html += '</tr></table>';
  if (vids.length) {
    html += '<h4>' + esc_(L.videos) + '</h4>';
    vids.forEach((u, i) => { html += '<div style="font-size:12px;margin:3px 0">' + esc_(L.video) + ' ' + (i + 1) + ': <a href="' + esc_(u) + '">' + esc_(u) + '</a></div>'; });
  }
  html += '<p style="font-size:11px;color:#5d6b64;margin-top:18px">' + esc_(L.issued) + ': ' + Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm') + '</p></body></html>';

  const pdf = Utilities.newBlob(html, 'text/html', 'report.html').getAs('application/pdf');
  return { name: L.report + ' ' + month + ' - ' + t.name + '.pdf', mime: 'application/pdf', b64: Utilities.base64Encode(pdf.getBytes()) };
}

/* ================= الإنجاز اليومي للمعلمين ================= */
const DAILY_HEADERS = ['التاريخ', 'تسلسل المعلم', 'اسم المعلم', 'الحلقة', 'عدد الحاضرين', 'الجديد (الحفظ)', 'المراجعة', 'ملاحظة', 'وقت التسجيل'];

function dailySheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG.DAILY_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.DAILY_SHEET);
    sh.getRange('A:B').setNumberFormat('@');
    sh.getRange('I:I').setNumberFormat('@');
    sh.appendRow(DAILY_HEADERS);
    sh.setFrozenRows(1);
    sh.setRightToLeft(true);
    sh.getRange(1, 1, 1, DAILY_HEADERS.length).setFontWeight('bold').setBackground('#123c34').setFontColor('#ffffff');
  }
  return sh;
}

function readDaily_() {
  const v = dailySheet_().getDataRange().getValues();
  const out = [];
  for (let i = 1; i < v.length; i++) {
    const r = v[i];
    if (!r[0]) continue;
    out.push({ sheetRow: i + 1, date: String(r[0]), serial: String(r[1]), att: Number(r[4]) || 0, newH: String(r[5] || ''), rev: String(r[6] || ''), note: String(r[7] || ''), at: String(r[8] || '') });
  }
  return out;
}

function pubDaily_(d) { return { date: d.date, att: d.att, newH: d.newH, rev: d.rev, note: d.note }; }
const byDateDesc_ = (a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0;

function listDaily(row, phone) {
  const a = auth_(row, phone);
  return { entries: readDaily_().filter(d => d.serial === String(a.t.serial)).sort(byDateDesc_).slice(0, 40).map(pubDaily_) };
}

/** تسجيل/تعديل إنجاز يوم (يوم واحد لكل معلم؛ إعادة التسجيل لنفس التاريخ تستبدل السابق) */
function saveDaily(row, phone, d) {
  const a = auth_(row, phone);
  const date = String(d.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('E_DDATE');
  const today = Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd');
  const min = Utilities.formatDate(new Date(Date.now() - 45 * 86400000), CONFIG.TZ, 'yyyy-MM-dd');
  if (date > today || date < min) throw new Error('E_DDATE');
  const att = Number(d.att);
  if (!Number.isInteger(att) || att < 0 || att > 500) throw new Error('E_DATT');
  const newH = clean_(d.newH).slice(0, 200), rev = clean_(d.rev).slice(0, 200), note = clean_(d.note).slice(0, 500);
  if (!newH && !rev) throw new Error('E_DEMPTY');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = dailySheet_();
    const old = readDaily_().find(x => x.serial === String(a.t.serial) && x.date === date);
    const now = Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm');
    const r = old ? old.sheetRow : sh.getLastRow() + 1;
    sh.getRange(r, 1, 1, 2).setNumberFormat('@'); sh.getRange(r, 9).setNumberFormat('@');
    sh.getRange(r, 1, 1, 9).setValues([[date, a.t.serial, a.t.name, a.t.halaqa, att, newH, rev, note, now]]);
  } finally { lock.releaseLock(); }
  return listDaily(row, phone);
}

function deleteDaily(row, phone, date) {
  const a = auth_(row, phone);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const old = readDaily_().find(x => x.serial === String(a.t.serial) && x.date === String(date));
    if (old) dailySheet_().deleteRow(old.sheetRow);
  } finally { lock.releaseLock(); }
  return listDaily(row, phone);
}

/* ================= صفحة المعلمين وإنجازاتهم اليومية ================= */
function monthParam_(month, w) {
  const yTo = +w.month.slice(0, 4) + CONFIG.YEARS_AHEAD;
  const my = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month || '');
  return {
    month: (my && +my[1] >= CONFIG.START_YEAR && +my[1] <= yTo) ? month : w.month,
    years: { from: CONFIG.START_YEAR, to: yTo }
  };
}

function teachersData(phone, month) {
  const acc = account_(phone);
  if (!acc || !acc.contacts) throw new Error('E_AUTH');
  const w = window_();
  const mp = monthParam_(month, w);
  const today = Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd');

  const list = teachersInfo_().list;
  const reports = {};
  reportsSheet_().getDataRange().getValues().slice(1).forEach(r => { if (String(r[1]) === mp.month) reports[String(r[3])] = true; });
  const reg = {};
  readStudents_().forEach(s => { reg[s.serial] = (reg[s.serial] || 0) + 1; });
  const daily = {};
  readDaily_().filter(d => d.date.indexOf(mp.month) === 0).forEach(d => { (daily[d.serial] = daily[d.serial] || []).push(d); });

  let loggedToday = 0, days = 0;
  const rows = list.map(t => {
    const mine = (daily[String(t.serial)] || []).sort(byDateDesc_);
    const todayDone = mine.some(d => d.date === today);
    if (todayDone) loggedToday++;
    days += mine.length;
    return {
      serial: t.serial, name: t.name, halaqa: t.halaqa, jiha: t.jiha, region: t.region, students: t.students,
      registered: reg[String(t.serial)] || 0, phone: t.phone, wa: '880' + t.phoneN,
      reported: !!reports[String(t.serial)], today: todayDone, daysLogged: mine.length,
      avgAtt: mine.length ? Math.round(mine.reduce((s, d) => s + d.att, 0) / mine.length) : 0,
      last: mine.length ? mine[0].date : '', entries: mine.slice(0, 31).map(pubDaily_)
    };
  });
  return {
    account: { role: acc.role, name: acc.name },
    month: mp.month, years: mp.years, today: today, rows: rows,
    summary: { total: list.length, loggedToday: loggedToday, days: days, reported: Object.keys(reports).length }
  };
}

/* ================= صفحة التوثيق (الصور والمقاطع) ================= */
function docsData(phone, month) {
  const acc = account_(phone);
  if (!acc || !acc.media) throw new Error('E_AUTH');
  const w = window_();
  const mp = monthParam_(month, w);
  const v = reportsSheet_().getDataRange().getValues();
  const rows = [];
  let photos = 0, videos = 0;
  for (let i = 1; i < v.length; i++) {
    const r = v[i];
    if (String(r[1]) !== mp.month) continue;
    const ph = [9, 10, 11, 12, 13].map(k => idOf_(r[k])).filter(Boolean);
    const vi = [14, 15, 16].map(k => idOf_(r[k])).filter(Boolean);
    photos += ph.length; videos += vi.length;
    rows.push({ serial: String(r[3]), name: String(r[4]), halaqa: String(r[6]), jiha: String(r[7]), region: String(r[8]),
      date: String(r[2]), dateH: String(r[20] || ''), submittedAt: String(r[0]), notes: String(r[17] || ''), photos: ph, videos: vi });
  }
  rows.sort((a, b) => Number(a.serial) - Number(b.serial));
  return { account: { role: acc.role, name: acc.name }, month: mp.month, years: mp.years, rows: rows, totals: { reports: rows.length, photos: photos, videos: videos } };
}

/* ================= واجهة API (تُستدعى من صفحات GitHub Pages) ================= */
const API_ = {
  login: login, bootstrap: bootstrap, updateProfile: updateProfile,
  startUpload: startUpload, checkUpload: checkUpload, submitReport: submitReport,
  listStudents: listStudents, saveStudent: saveStudent, deleteStudent: deleteStudent,
  listDaily: listDaily, saveDaily: saveDaily, deleteDaily: deleteDaily,
  adminData: adminData, adminStudents: adminStudents, teachersData: teachersData, docsData: docsData,
  exportStudents: exportStudents, exportReportsExcel: exportReportsExcel, exportReportPdf: exportReportPdf
};

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doGet() { return json_({ ok: true, service: 'quran-halaqat-reports' }); }

function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const fn = Object.prototype.hasOwnProperty.call(API_, req.fn) ? API_[req.fn] : null;
    if (!fn) return json_({ ok: false, error: 'E_BAD' });
    const args = Array.isArray(req.args) ? req.args : [];
    return json_({ ok: true, data: fn.apply(null, args) });
  } catch (err) {
    const m = String(err && err.message || err);
    if (/^E_[A-Z0-9]+/.test(m)) return json_({ ok: false, error: m });
    console.error(m);
    return json_({ ok: false, error: 'E_SERVER' });
  }
}

/* ================= قائمة للإدارة داخل الجدول ================= */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('📖 تقارير الحلقات')
    .addItem('من لم يرسل تقرير الشهر', 'listMissing')
    .addToUi();
}

function listMissing() {
  const w = window_();
  const list = teachersInfo_().list;
  const v = reportsSheet_().getDataRange().getValues();
  const done = new Set(v.slice(1).filter(r => String(r[1]) === w.month).map(r => String(r[3])));
  const miss = list.filter(t => !done.has(String(t.serial)));
  SpreadsheetApp.getUi().alert('تقارير شهر ' + w.label +
    '\nأرسل: ' + (list.length - miss.length) + ' من ' + list.length +
    '\n\nلم يرسلوا بعد:\n' + (miss.map(t => '• ' + t.name + ' — ' + t.phone).join('\n') || 'الجميع أرسل ✔'));
}
