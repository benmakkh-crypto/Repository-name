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
  START_YEAR: 2024,            // أول سنة في لوحة الإدارة
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
  USERS_SHEET: 'المستخدمون',      // تُنشأ تلقائياً وتُدار من صفحة الإدارة (المشرف العام)
  PROGRAMS_SHEET: 'البرامج والأنشطة',
  ABOUT_SHEET: 'عن الحلقات',
  PERSONAL_FOLDER: 'ملفات المعلمين',
  SEED_ACCOUNTS: [
    { phone: '55551111', role: 'general',    name: 'المشرف العام',      stats: true,  contacts: true,  media: true,  export: true, manage: true },
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

/** ورقة المعلمين: بالاسم إن حُدد، وإلا أول ورقة (غير أوراق النظام) فيها عناوين «الاسم» و«الجوال» */
function teachersSheet_(ss) {
  if (CONFIG.TEACHERS_SHEET) { const x = ss.getSheetByName(CONFIG.TEACHERS_SHEET); if (x) return x; }
  const ours = [CONFIG.USERS_SHEET, CONFIG.REPORTS_SHEET, CONFIG.STUDENTS_SHEET, CONFIG.DAILY_SHEET, CONFIG.PROGRAMS_SHEET, CONFIG.ABOUT_SHEET];
  const all = ss.getSheets().filter(x => ours.indexOf(x.getName()) < 0);
  for (let k = 0; k < all.length; k++) {
    const v = all[k].getRange(1, 1, Math.min(15, Math.max(1, all[k].getLastRow())), Math.max(1, all[k].getLastColumn())).getValues();
    if (v.some(r => r.some(c => clean_(c).indexOf('الجوال') > -1) && r.some(c => clean_(c) === 'الاسم'))) return all[k];
  }
  return all[0] || ss.getSheets()[0];
}

/** قراءة ورقة المعلمين: يكتشف صف العناوين والأعمدة تلقائياً من أسمائها */
function teachersInfo_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = teachersSheet_(ss);
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
  const y = f('yyyy'), m = f('M');
  const p2 = n => ('0' + n).slice(-2);
  return {
    open: true,                                   // التسجيل مفتوح لكل الشهور: السابقة والحالية والقادمة
    month: y + '-' + p2(m),
    label: MONTHS_AR[m - 1] + ' ' + y,
    min: CONFIG.START_YEAR + '-01-01',
    max: (y + CONFIG.YEARS_AHEAD) + '-12-31',
    today: Utilities.formatDate(now, CONFIG.TZ, 'yyyy-MM-dd'),
    photos: CONFIG.PHOTOS_COUNT
  };
}

function dateOk_(d) {
  const w = window_();
  return /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) && d >= w.min && d <= w.max && new Date(d + 'T00:00:00Z').toISOString().slice(0, 10) === d;
}
function monthOk_(m) {
  const w = window_();
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(m || '')) && m >= w.min.slice(0, 7) && m <= w.max.slice(0, 7);
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
const USER_HEADERS = ['الرمز (الجوال)', 'الاسم', 'الدور', 'إحصائيات', 'أرقام المعلمين', 'الصور والفيديو', 'تصدير', 'إدارة', 'مفعّل', 'مفتاح الرابط', 'أضيف'];
const ROLE_PRESETS = {
  general:    { stats: true,  contacts: true,  media: true,  export: true,  manage: true },
  supervisor: { stats: true,  contacts: true,  media: true,  export: false, manage: false },
  viewer:     { stats: false, contacts: false, media: true,  export: false, manage: false },
  donor:      { stats: true,  contacts: false, media: true,  export: false, manage: false }
};
const yn_ = v => (v === true || v === 'نعم') ? 'نعم' : '';
const newKey_ = () => Utilities.getUuid().replace(/-/g, '').slice(0, 22);

function usersSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG.USERS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.USERS_SHEET);
    sh.getRange('A:A').setNumberFormat('@');
    sh.appendRow(USER_HEADERS);
    sh.setFrozenRows(1); sh.setRightToLeft(true);
    sh.getRange(1, 1, 1, USER_HEADERS.length).setFontWeight('bold').setBackground('#123c34').setFontColor('#ffffff');
    CONFIG.SEED_ACCOUNTS.forEach(a => {
      sh.appendRow([a.phone, a.name, a.role, yn_(a.stats), yn_(a.contacts), yn_(a.media), yn_(a.export), yn_(a.manage), 'نعم', newKey_(), Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd')]);
    });
  }
  const stray = sh.getRange(1, USER_HEADERS.length + 1);
  if (clean_(stray.getValue()) === 'البريد الإلكتروني') stray.clearContent();
  return sh;
}

function readUsers_() {
  const v = usersSheet_().getDataRange().getValues();
  const out = [];
  for (let i = 1; i < v.length; i++) {
    const r = v[i];
    if (!clean_(r[0])) continue;
    out.push({ sheetRow: i + 1, phone: clean_(r[0]), name: clean_(r[1]), role: clean_(r[2]) || 'viewer',
      stats: r[3] === 'نعم', contacts: r[4] === 'نعم', media: r[5] === 'نعم', export: r[6] === 'نعم', manage: r[7] === 'نعم',
      active: r[8] === 'نعم', key: clean_(r[9]), added: String(r[10] || '') });
  }
  return out;
}

function account_(phone) {
  const n = normPhone_(phone);
  if (!n) return null;
  return readUsers_().find(a => a.active && normPhone_(a.phone) === n) || null;
}

function adminOut_(acc) {
  return { role: acc.role, name: acc.name, stats: acc.stats, contacts: acc.contacts, media: acc.media, export: !!acc.export, manage: !!acc.manage };
}

function login(phone) {
  const n = normPhone_(phone);
  const acc = account_(phone);
  if (acc) return { ok: true, admin: adminOut_(acc) };
  if (n.length < 9) return { ok: false, msg: 'E_PHONE' };
  const m = teachersInfo_().list.filter(x => x.phoneN === n);
  if (!m.length) return { ok: false, msg: 'E_NOTFOUND' };
  return { ok: true, teachers: m.map(pub_) };
}

/** الدخول برابط خاص (مثل رابط الجهة الداعمة) */
function loginKey(key) {
  key = clean_(key);
  if (key.length < 12) throw new Error('E_AUTH');
  const acc = readUsers_().find(a => a.active && a.key === key);
  if (!acc) throw new Error('E_AUTH');
  return { ok: true, phone: acc.phone, admin: adminOut_(acc) };
}

function bootstrap(row, phone) {
  const a = auth_(row, phone);
  const w = window_();
  const reports = {};
  reportsSheet_().getDataRange().getValues().slice(1).forEach(r => { if (String(r[3]) === String(a.t.serial)) reports[String(r[1])] = { date: String(r[2]), submittedAt: String(r[0]), count: r[19] }; });
  return { teacher: pub_(a.t), window: w, reports: reports };
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

function rootFolder_() {
  const it = DriveApp.getFoldersByName(CONFIG.ROOT_FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.ROOT_FOLDER_NAME);
}

/** مجلد المعلم الخاص: الجذر / ملفات المعلمين / «التسلسل - الاسم» (فيه مجلد لكل شهر) */
function teacherHome_(t) {
  return sub_(sub_(rootFolder_(), CONFIG.PERSONAL_FOLDER), t.serial + ' - ' + t.name.replace(/[\/\\]/g, ' '));
}

/** مجلد شهر المعلم: صور وفيديوهات الشهر + ملف تقريره */
function teacherFolder_(t, month) {
  return sub_(teacherHome_(t), month);
}

/**
 * تجهيز جلسة رفع مباشرة من متصفح المعلم إلى Drive (Resumable Upload)
 * يتطلب تفعيل خدمة Drive API من Services في Apps Script
 */
function startUpload(row, phone, month, kind, fileName, mime, size, origin) {
  const a = auth_(row, phone);
  if (!monthOk_(month)) throw new Error('E_MONTH');
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
  if (!dateOk_(data.date)) throw new Error('E_DATE');
  const month = data.date.slice(0, 7);
  if (data.month && data.month !== month) throw new Error('E_MONTH');

  const safe = n => !n || /^(photo|video)[1-5]_\d+_\d+\.[a-z0-9]{2,5}$/.test(n);
  const photos = (data.photos || []).slice(0, CONFIG.PHOTOS_COUNT);
  const videos = (data.videos || []).slice(0, 3);
  if (photos.length !== CONFIG.PHOTOS_COUNT || photos.some(n => !n)) throw new Error('E_PHOTOS');
  if (!videos[0]) throw new Error('E_VIDEO1');
  if (!photos.concat(videos).every(safe)) throw new Error('E_BAD');

  const folder = teacherFolder_(a.t, month);
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
    const old = findReport_(sh, a.t.serial, month);
    const now = Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm');
    const rowVals = [now, month, data.date, a.t.serial, a.t.name, a.t.phone, a.t.halaqa, a.t.jiha, a.t.region]
      .concat(urls, [clean_(data.notes).slice(0, 1000), folder.getUrl(), old ? (Number(old.vals[19]) || 1) + 1 : 1, clean_(data.dateH).slice(0, 60)]);
    if (old) { sh.getRange(old.row, 21).setNumberFormat('@'); sh.getRange(old.row, 1, 1, rowVals.length).setValues([rowVals]); }
    else { const r = sh.getLastRow() + 1; sh.getRange(r, 2, 1, 2).setNumberFormat('@'); sh.getRange(r, 21).setNumberFormat('@'); sh.getRange(r, 1, 1, rowVals.length).setValues([rowVals]); }
  } finally { lock.releaseLock(); }
  try { // ملف تقرير نصي منفصل للمعلم داخل مجلد الشهر
    const nm = 'تقرير-' + month + '.txt';
    const old2 = folder.getFilesByName(nm); while (old2.hasNext()) old2.next().setTrashed(true);
    folder.createFile(nm, ['تقرير شهر ' + month, 'المعلم: ' + a.t.name, 'الحلقة: ' + a.t.halaqa, 'الجهة: ' + a.t.jiha + ' — ' + a.t.region,
      'تاريخ التقرير: ' + data.date + (data.dateH ? ' (' + clean_(data.dateH) + ')' : ''), 'الصور: ' + photos.length + ' | الفيديوهات: ' + videos.filter(Boolean).length,
      'ملاحظات: ' + clean_(data.notes).slice(0, 1000)].join('\n'), MimeType.PLAIN_TEXT);
  } catch (e) {}
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
    account: adminOut_(acc),
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
  return { entries: readDaily_().filter(d => d.serial === String(a.t.serial)).sort(byDateDesc_).slice(0, 400).map(pubDaily_) };
}

/** تسجيل/تعديل إنجاز يوم (يوم واحد لكل معلم؛ إعادة التسجيل لنفس التاريخ تستبدل السابق) */
function saveDaily(row, phone, d) {
  const a = auth_(row, phone);
  const date = String(d.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('E_DDATE');
  if (!dateOk_(date)) throw new Error('E_DDATE');
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

/* ================= الإدارة: المستخدمون والمعلمون (المشرف العام فقط) ================= */
function manageAcc_(phone) {
  const a = account_(phone);
  if (!a || !a.manage) throw new Error('E_AUTH');
  return a;
}

function usersList(phone) {
  manageAcc_(phone);
  return readUsers_().map(u => ({ phone: u.phone, name: u.name, role: u.role, stats: u.stats, contacts: u.contacts, media: u.media, export: u.export, manage: u.manage, active: u.active, key: u.key, added: u.added }));
}

function userSave(phone, d) {
  manageAcc_(phone);
  const code = clean_(d.phone), name = clean_(d.name), role = ROLE_PRESETS[d.role] ? d.role : 'viewer';
  if (normPhone_(code).length < 5) throw new Error('E_PHONE');
  if (name.length < 2) throw new Error('E_NAME');
  const pr = ROLE_PRESETS[role];
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    if (teachersInfo_().list.some(t => t.phoneN === normPhone_(code))) throw new Error('E_DUP');
    const sh = usersSheet_();
    const all = readUsers_();
    const old = d.orig ? all.find(u => normPhone_(u.phone) === normPhone_(d.orig)) : null;
    if (all.some(u => (!old || u.sheetRow !== old.sheetRow) && normPhone_(u.phone) === normPhone_(code))) throw new Error('E_DUP');
    const active = d.active === false ? '' : 'نعم';
    if (old) {
      if (normPhone_(old.phone) === normPhone_(phone) && (!active || role !== 'general')) throw new Error('E_SELF');
      sh.getRange(old.sheetRow, 1, 1, 9).setNumberFormat('@').setValues([[code, name, role, yn_(pr.stats), yn_(pr.contacts), yn_(pr.media), yn_(pr.export), yn_(pr.manage), active]]);
      if (d.renewKey) sh.getRange(old.sheetRow, 10).setValue(newKey_());
    } else {
      sh.appendRow([code, name, role, yn_(pr.stats), yn_(pr.contacts), yn_(pr.media), yn_(pr.export), yn_(pr.manage), active, newKey_(), Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd')]);
      sh.getRange(sh.getLastRow(), 1).setNumberFormat('@').setValue(code);
    }
  } finally { lock.releaseLock(); }
  return usersList(phone);
}

function teacherAdd(phone, d) {
  manageAcc_(phone);
  const name = clean_(d.name), tel = clean_(d.phone), email = clean_(d.email);
  if (name.length < 3) throw new Error('E_NAME');
  const pn = normPhone_(tel);
  if (pn.length < 9) throw new Error('E_PHONE');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E_EMAIL');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const info = teachersInfo_();
    if (info.list.some(t => t.phoneN === pn)) throw new Error('E_DUP');
    if (readUsers_().some(u => normPhone_(u.phone) === pn)) throw new Error('E_DUP');
    const serial = info.list.reduce((m, t) => Math.max(m, Number(t.serial) || 0), 0) + 1;
    const c = info.col, sh = info.sh;
    const width = Math.max(sh.getLastColumn(), c.email + 1);
    const row = new Array(width).fill('');
    const put = (k, v) => { if (c[k] !== undefined) row[c[k]] = v; };
    put('serial', serial); put('name', name); put('phone', tel); put('email', email);
    put('region', clean_(d.region)); put('jiha', clean_(d.jiha)); put('halaqa', clean_(d.halaqa)); put('students', clean_(d.students));
    const r = sh.getLastRow() + 1;
    sh.getRange(r, 1, 1, width).setNumberFormat('@').setValues([row]);
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
  return { ok: true, count: teachersInfo_().list.length };
}

/* ================= ملف خاص لكل معلم (Drive + صفحة) ================= */
function personalFolder_(t) {
  const f = teacherHome_(t);
  try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  return f.getUrl();
}

function fileData_(t) {
  const v = reportsSheet_().getDataRange().getValues();
  const reps = [];
  for (let i = 1; i < v.length; i++) {
    const r = v[i];
    if (String(r[3]) !== String(t.serial)) continue;
    reps.push({ month: String(r[1]), date: String(r[2]), dateH: String(r[20] || ''), notes: String(r[17] || ''), folder: String(r[18] || ''),
      photos: [9, 10, 11, 12, 13].map(k => idOf_(r[k])).filter(Boolean), videos: [14, 15, 16].map(k => idOf_(r[k])).filter(Boolean) });
  }
  reps.sort((a, b) => a.month < b.month ? 1 : -1);
  let link = '';
  try { link = personalFolder_(t); } catch (e) {}
  return { teacher: { serial: t.serial, name: t.name, halaqa: t.halaqa, jiha: t.jiha, region: t.region }, folderUrl: link,
    reports: reps.map(r => ({ month: r.month, date: r.date, dateH: r.dateH, notes: r.notes, photos: r.photos, videos: r.videos })),
    totals: { reports: reps.length, photos: reps.reduce((n, r) => n + r.photos.length, 0), videos: reps.reduce((n, r) => n + r.videos.length, 0) } };
}

function myFile(row, phone) { return fileData_(auth_(row, phone).t); }

function teacherFileAdmin(phone, serial) {
  const acc = account_(phone);
  if (!acc || !acc.media) throw new Error('E_AUTH');
  const t = teachersInfo_().list.find(x => String(x.serial) === String(serial));
  if (!t) throw new Error('E_NOTFOUND');
  return fileData_(t);
}

/** رسالة نصية إلى بريد كل معلم برابط ملفه في Drive (المشرف العام فقط) */
function emailLinks(phone, serials, siteUrl) {
  manageAcc_(phone);
  const want = Array.isArray(serials) ? serials.map(String) : [];
  const list = teachersInfo_().list.filter(t => !want.length || want.indexOf(String(t.serial)) > -1);
  const site = /^https:\/\//.test(String(siteUrl || '')) ? String(siteUrl) : '';
  const out = { sent: 0, noEmail: [], failed: [] };
  list.forEach(t => {
    if (!t.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t.email)) { out.noEmail.push(t.name); return; }
    try {
      const link = fileData_(t).folderUrl;
      const body = 'السلام عليكم ورحمة الله وبركاته\n\nالأخ الفاضل ' + t.name + '،\nهذا رابط ملف حلقتكم (' + t.halaqa + ') في Drive، وفيه صور ومقاطع تقاريركم الشهرية:\n' + link +
        (site ? '\n\nلرفع التقرير الشهري والإنجاز اليومي: ' + site : '') +
        '\n\nجزاكم الله خيراً\nحلقات الشيخ عبد الرحمن البلاع — شركة الأمة للخدمات الإنسانية\n\n----\n' +
        'Dear ' + t.name + ', this is the Drive folder link of your circle (photos and videos of your monthly reports): ' + link + '\n\n----\n' +
        'প্রিয় ' + t.name + ', আপনার হালাকার মাসিক প্রতিবেদনের ছবি ও ভিডিওর ড্রাইভ লিংক: ' + link;
      MailApp.sendEmail({ to: t.email, subject: 'ملف حلقتكم في Drive | Your circle folder | আপনার হালাকার ফোল্ডার', body: body, name: 'حلقات الشيخ عبد الرحمن البلاع' });
      out.sent++;
    } catch (e) { out.failed.push(t.name); }
  });
  return out;
}

/** تشغيل مرة واحدة من المحرر لمنح صلاحية إرسال البريد */
function authorize() {
  const f = rootFolder_(); f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); // يتطلب صلاحية Drive الكاملة
  ScriptApp.getOAuthToken();
  UrlFetchApp.getRequest('https://www.googleapis.com/drive/v3/about');
  SpreadsheetApp.getActiveSpreadsheet();
  return MailApp.getRemainingDailyQuota();
}

/** روابط المشاركة: رابط Drive العام + رابط مجلد كل حلقة + رابط صفحة الحلقة (لمن له صلاحية الوسائط) */
function shareLinks(phone, siteUrl) {
  const acc = account_(phone);
  if (!acc || !acc.media) throw new Error('E_AUTH');
  const site = /^https:\/\//.test(String(siteUrl || '')) ? String(siteUrl).replace(/[^\/]*$/, '') : '';
  const root = sub_(rootFolder_(), 'حسب الشهر'); // الرابط العام يفتح على مجلد الأشهر (شهر بشهر)
  try { root.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  const list = teachersInfo_().list.map(t => {
    let url = '';
    try { url = personalFolder_(t); } catch (e) {}
    return { serial: t.serial, name: t.name, halaqa: t.halaqa, jiha: t.jiha, region: t.region, folder: url, page: site ? site + 'file.html?s=' + t.serial : '' };
  });
  return { root: root.getUrl(), teachers: list };
}

/** مجلد «حسب الشهر / YYYY-MM» لكل الحلقات: اختصارات إلى مجلد كل معلم لذلك الشهر — رابط واحد للجهة الداعمة */
function monthShare(phone, month) {
  const acc = account_(phone);
  if (!acc || !acc.media) throw new Error('E_AUTH');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) throw new Error('E_MONTH');
  const mf = sub_(sub_(rootFolder_(), 'حسب الشهر'), month);
  const have = {};
  const it = mf.getFiles(); while (it.hasNext()) have[it.next().getName()] = 1;
  const tok = ScriptApp.getOAuthToken();
  let n = 0;
  teachersInfo_().list.forEach(t => {
    const home = teacherHome_(t);
    const q = home.getFoldersByName(month);
    if (!q.hasNext()) return;
    const tf = q.next();
    try { home.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    const nm = t.serial + ' - ' + t.name.replace(/[\/\\]/g, ' ') + ' - ' + (t.halaqa || '');
    n++;
    if (have[nm]) return;
    UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
      method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + tok }, muteHttpExceptions: true,
      payload: JSON.stringify({ name: nm, mimeType: 'application/vnd.google-apps.shortcut', parents: [mf.getId()], shortcutDetails: { targetId: tf.getId() } })
    });
  });
  try { mf.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  return { month: month, url: mf.getUrl(), count: n };
}

/** بيانات صفحة الروابط (سريعة: من الجداول فقط): 12 شهراً من الشهر الماضي + حالة رفع كل حلقة */
function shareInit(phone) {
  const acc = account_(phone);
  if (!acc || !acc.media) throw new Error('E_AUTH');
  const d = new Date(), months = [];
  for (let k = -1; k < 11; k++) months.push(Utilities.formatDate(new Date(d.getFullYear(), d.getMonth() + k, 1), CONFIG.TZ, 'yyyy-MM'));
  const done = {};
  const v = reportsSheet_().getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    const r = v[i];
    const p = [9, 10, 11, 12, 13].filter(k => r[k]).length, vd = [14, 15, 16].filter(k => r[k]).length;
    (done[String(r[3])] = done[String(r[3])] || {})[String(r[1])] = { p: p, v: vd };
  }
  return { months: months, teachers: teachersInfo_().list.map(t => ({ serial: t.serial, name: t.name, halaqa: t.halaqa, jiha: t.jiha, region: t.region, done: done[String(t.serial)] || {} })) };
}

/** رابط Drive الرئيسي (مجلد «حسب الشهر») */
function rootLink(phone) {
  const acc = account_(phone);
  if (!acc || !acc.media) throw new Error('E_AUTH');
  const root = sub_(rootFolder_(), 'حسب الشهر');
  try { root.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  return { url: root.getUrl() };
}

/** رابط حلقة واحدة: مجلد شهرها إن وُجد (month) وإلا مجلدها الكامل */
function teacherLink(phone, serial, month) {
  const acc = account_(phone);
  if (!acc || !acc.media) throw new Error('E_AUTH');
  const t = teachersInfo_().list.find(x => String(x.serial) === String(serial));
  if (!t) throw new Error('E_NOTFOUND');
  const home = teacherHome_(t);
  try { home.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  if (/^\d{4}-\d{2}$/.test(month || '')) { const q = home.getFoldersByName(month); if (q.hasNext()) return { url: q.next().getUrl(), month: month }; return { url: '', month: month }; }
  return { url: home.getUrl() };
}

/* ================= البرامج والأنشطة والجوائز ================= */
const PROGRAM_HEADERS = ['المعرف', 'النوع', 'العنوان', 'الوصف', 'التاريخ', 'تسلسل المعلم', 'اسم المعلم', 'الحلقة', 'الجائزة', 'الفائزون', 'الحالة', 'أضيف', 'آخر تعديل', 'المصدر'];

function programsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG.PROGRAMS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.PROGRAMS_SHEET);
    sh.getRange('E:F').setNumberFormat('@'); sh.getRange('L:M').setNumberFormat('@');
    sh.appendRow(PROGRAM_HEADERS);
    sh.setFrozenRows(1); sh.setRightToLeft(true);
    sh.getRange(1, 1, 1, PROGRAM_HEADERS.length).setFontWeight('bold').setBackground('#123c34').setFontColor('#ffffff');
  }
  if (!sh.getRange(1, 14).getValue()) sh.getRange(1, 14).setValue('المصدر').setFontWeight('bold').setBackground('#123c34').setFontColor('#ffffff');
  return sh;
}

function readPrograms_() {
  const v = programsSheet_().getDataRange().getValues();
  const out = [];
  for (let i = 1; i < v.length; i++) {
    const r = v[i];
    if (!r[0]) continue;
    out.push({ sheetRow: i + 1, id: String(r[0]), type: String(r[1]), title: clean_(r[2]), desc: String(r[3] || ''), date: String(r[4] || ''),
      serial: String(r[5]), teacher: String(r[6] || ''), halaqa: String(r[7] || ''), prize: String(r[8] || ''), winners: String(r[9] || ''), status: String(r[10] || 'planned'), added: String(r[11] || ''), by: String(r[13] || (String(r[5]) === '*' ? 'admin' : 'teacher')) });
  }
  return out;
}

const pubProgram_ = p => ({ id: p.id, type: p.type, title: p.title, desc: p.desc, date: p.date, serial: p.serial, teacher: p.teacher, halaqa: p.halaqa, prize: p.prize, winners: p.winners, status: p.status, by: p.by });

function saveProgram_(d, serial, tname, halaqa, canEditAll) {
  const title = clean_(d.title);
  if (title.length < 3) throw new Error('E_PTITLE');
  const type = d.type === 'activity' ? 'activity' : 'program';
  const status = ['planned', 'running', 'done'].indexOf(d.status) > -1 ? d.status : 'planned';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(d.date || '')) ? d.date : '';
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const sh = programsSheet_();
    const now = Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm');
    const vals = (id, added) => [[id, type, title, String(d.desc || '').slice(0, 2000), date, serial, tname, halaqa, String(d.prize || '').slice(0, 300), String(d.winners || '').slice(0, 600), status, added, now, canEditAll ? 'admin' : 'teacher']];
    if (d.id) {
      const p = readPrograms_().find(x => x.id === String(d.id));
      if (!p || (!canEditAll && (p.serial !== String(serial) || p.by === 'admin'))) throw new Error('E_SNOTFOUND');
      sh.getRange(p.sheetRow, 1, 1, 14).setNumberFormat('@').setValues(vals(p.id, p.added));
    } else {
      const r = sh.getLastRow() + 1;
      sh.getRange(r, 1, 1, 14).setNumberFormat('@').setValues(vals(Utilities.getUuid().slice(0, 8), now));
    }
  } finally { lock.releaseLock(); }
}

function deleteProgram_(id, serial, canEditAll) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const p = readPrograms_().find(x => x.id === String(id));
    if (!p || (!canEditAll && (p.serial !== String(serial) || p.by === 'admin'))) throw new Error('E_SNOTFOUND');
    programsSheet_().deleteRow(p.sheetRow);
  } finally { lock.releaseLock(); }
}

function listPrograms(row, phone) {
  const a = auth_(row, phone);
  const s = String(a.t.serial);
  return readPrograms_().filter(p => p.serial === s || p.serial === '*').map(p => Object.assign(pubProgram_(p), { mine: p.serial === s && p.by === 'teacher' }));
}
function saveProgram(row, phone, d) { const a = auth_(row, phone); saveProgram_(d, String(a.t.serial), a.t.name, a.t.halaqa, false); return listPrograms(row, phone); }
function deleteProgram(row, phone, id) { const a = auth_(row, phone); deleteProgram_(id, String(a.t.serial), false); return listPrograms(row, phone); }

function programsAdmin(phone) {
  const acc = account_(phone);
  if (!acc || !(acc.media || acc.stats || acc.manage)) throw new Error('E_AUTH');
  const teachers = acc.manage ? teachersInfo_().list.map(t => ({ serial: t.serial, name: t.name, halaqa: t.halaqa })) : [];
  return { programs: readPrograms_().map(pubProgram_), teachers: teachers, canEdit: !!acc.manage };
}
function programSaveAdmin(phone, d) {
  manageAcc_(phone);
  const s = clean_(d.serial);
  const t = s && s !== '*' ? teachersInfo_().list.find(x => String(x.serial) === s) : null;
  saveProgram_(d, t ? String(t.serial) : '*', t ? t.name : '', t ? t.halaqa : '', true);
  return programsAdmin(phone);
}
function programDeleteAdmin(phone, id) { manageAcc_(phone); deleteProgram_(id, '', true); return programsAdmin(phone); }

/* ================= صفحة «عن الحلقات» (عامة) ================= */
function aboutSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG.ABOUT_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.ABOUT_SHEET);
    sh.appendRow(['المفتاح', 'العربية', 'English', 'বাংলা']);
    sh.setFrozenRows(1); sh.setRightToLeft(true);
    sh.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#123c34').setFontColor('#ffffff');
  }
  return sh;
}

function aboutGet() {
  const teachers = teachersInfo_().list;
  const rv = reportsSheet_().getDataRange().getValues().slice(1);
  let photos = 0, videos = 0;
  rv.forEach(r => { photos += [9, 10, 11, 12, 13].filter(k => r[k]).length; videos += [14, 15, 16].filter(k => r[k]).length; });
  const regions = {}; teachers.forEach(t => { if (t.region) regions[t.region] = 1; });
  const students = readStudents_().length;
  const days = readDaily_().length;
  const programs = readPrograms_();
  const texts = {};
  aboutSheet_().getDataRange().getValues().slice(1).forEach(r => { if (r[0]) texts[String(r[0])] = { ar: String(r[1] || ''), en: String(r[2] || ''), bn: String(r[3] || '') }; });
  return {
    stats: { circles: teachers.length, teachers: teachers.length, students: students, regions: Object.keys(regions).length, reports: rv.length, photos: photos, videos: videos, dailyLogs: days, programs: programs.length },
    programs: programs.sort((a, b) => a.added < b.added ? 1 : -1).slice(0, 24).map(p => ({ by: p.by, serial: p.serial, type: p.type, title: p.title, desc: p.desc, date: p.date, halaqa: p.halaqa, prize: p.prize, winners: p.winners, status: p.status })),
    texts: texts
  };
}

function aboutSave(phone, key, texts) {
  manageAcc_(phone);
  key = clean_(key);
  if (!/^[a-zA-Z0-9_]{2,30}$/.test(key)) throw new Error('E_BAD');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const sh = aboutSheet_();
    const v = sh.getDataRange().getValues();
    const vals = [[key, String(texts.ar || '').slice(0, 4000), String(texts.en || '').slice(0, 4000), String(texts.bn || '').slice(0, 4000)]];
    let row = 0;
    for (let i = 1; i < v.length; i++) if (String(v[i][0]) === key) { row = i + 1; break; }
    sh.getRange(row || sh.getLastRow() + 1, 1, 1, 4).setValues(vals);
  } finally { lock.releaseLock(); }
  return aboutGet().texts;
}

/* ================= الرسوم والتحليلات + التقرير الشهري الشامل ================= */
const num_ = v => { const n = parseFloat(String(v == null ? '' : v).replace(/[^\d.]/g, '')); return isNaN(n) ? 0 : n; };
const areaParts_ = region => { const p = String(region || '').split(/[،,\-\.]/).map(x => x.trim()).filter(Boolean); return { area: p[0] || '', district: p.length > 1 ? p[p.length - 1] : (p[0] || '') }; };
const bucket_ = (v, edges) => { for (let i = 0; i < edges.length; i++) if (v <= edges[i]) return i; return edges.length; };

function monthShift_(month, k) {
  const y = +month.slice(0, 4), m = +month.slice(5) - 1 + k;
  const d = new Date(y, m, 1);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
}

/** ملخص شهر كامل: يُستخدم في الرسوم وفي ملفات Excel/PDF */
function monthSummary_(month) {
  const teachers = teachersInfo_().list;
  const rv = reportsSheet_().getDataRange().getValues().slice(1);
  const students = readStudents_();
  const daily = readDaily_().filter(d => d.date.indexOf(month) === 0);
  const programs = readPrograms_();

  const repBy = {};
  rv.forEach(r => { if (String(r[1]) === month) repBy[String(r[3])] = r; });
  const regCount = {}; students.forEach(x => { regCount[x.serial] = (regCount[x.serial] || 0) + 1; });
  const dBy = {}; daily.forEach(d => { (dBy[d.serial] = dBy[d.serial] || []).push(d); });

  const circles = teachers.map(t => {
    const r = repBy[String(t.serial)], ds = dBy[String(t.serial)] || [];
    const ap = areaParts_(t.region);
    return { serial: t.serial, name: t.name, halaqa: t.halaqa, jiha: t.jiha, region: t.region, area: ap.area, district: ap.district, phone: t.phone,
      declared: num_(t.students), registered: regCount[String(t.serial)] || 0, submitted: !!r, date: r ? String(r[2]) : '', dateH: r ? String(r[20] || '') : '',
      photos: r ? [9, 10, 11, 12, 13].filter(k => r[k]).length : 0, videos: r ? [14, 15, 16].filter(k => r[k]).length : 0,
      days: ds.length, avgAtt: ds.length ? Math.round(ds.reduce((a, d) => a + d.att, 0) / ds.length) : 0 };
  });

  const trend = [];
  for (let i = 11; i >= 0; i--) {
    const m = monthShift_(month, -i);
    let rep = 0, ph = 0, vi = 0;
    rv.forEach(r => { if (String(r[1]) === m) { rep++; ph += [9, 10, 11, 12, 13].filter(k => r[k]).length; vi += [14, 15, 16].filter(k => r[k]).length; } });
    trend.push({ month: m, reports: rep, photos: ph, videos: vi });
  }

  const byDistrict = {}, byArea = {};
  circles.forEach(c => {
    [[byDistrict, c.district], [byArea, c.area]].forEach(p => {
      const k = p[1] || '-'; const o = p[0][k] = p[0][k] || { name: k, circles: 0, students: 0, submitted: 0 };
      o.circles++; o.students += c.registered || c.declared; if (c.submitted) o.submitted++;
    });
  });
  const list = o => Object.keys(o).map(k => o[k]).sort((a, b) => b.students - a.students);

  const juzE = [0, 5, 10, 15, 20, 25], ageE = [9, 12, 15, 18];
  const juz = new Array(7).fill(0), age = new Array(5).fill(0);
  students.forEach(x => { juz[bucket_(num_(x.juz), juzE)]++; age[bucket_(num_(x.age), ageE)]++; });

  const dayMap = {};
  daily.forEach(d => { const o = dayMap[d.date] = dayMap[d.date] || { date: d.date, att: 0, n: 0 }; o.att += d.att; o.n++; });
  const days = Object.keys(dayMap).sort().map(k => dayMap[k]);

  const prog = { total: programs.length, program: 0, activity: 0, admin: 0, teacher: 0, planned: 0, running: 0, done: 0 };
  programs.forEach(p => { prog[p.type === 'activity' ? 'activity' : 'program']++; prog[p.by === 'admin' ? 'admin' : 'teacher']++; if (prog[p.status] !== undefined) prog[p.status]++; });

  const submitted = circles.filter(c => c.submitted).length;
  const withDaily = circles.filter(c => c.days > 0);
  return {
    month: month, circles: circles, trend: trend, districts: list(byDistrict), areas: list(byArea).slice(0, 12),
    juz: juz, age: age, days: days, programs: prog, programList: programs,
    top: circles.slice().sort((a, b) => b.days - a.days).filter(c => c.days > 0).slice(0, 10).map(c => ({ name: c.halaqa || c.name, teacher: c.name, days: c.days, avgAtt: c.avgAtt })),
    totals: { circles: circles.length, submitted: submitted, missing: circles.length - submitted,
      rate: circles.length ? Math.round(submitted / circles.length * 100) : 0,
      students: students.length, declared: circles.reduce((a, c) => a + c.declared, 0),
      photos: circles.reduce((a, c) => a + c.photos, 0), videos: circles.reduce((a, c) => a + c.videos, 0),
      dailyLogs: daily.length, avgAtt: daily.length ? Math.round(daily.reduce((a, d) => a + d.att, 0) / daily.length) : 0, activeDaily: withDaily.length }
  };
}

function insightsData(phone, month) {
  const acc = account_(phone);
  if (!acc || !acc.stats) throw new Error('E_AUTH');
  const mp = monthParam_(month, window_());
  const sm = monthSummary_(mp.month);
  sm.circles = sm.circles.map(c => ({ serial: c.serial, name: c.name, halaqa: c.halaqa, district: c.district, area: c.area, submitted: c.submitted, days: c.days }));
  delete sm.programList;
  sm.years = mp.years;
  sm.account = adminOut_(acc);
  return sm;
}

const MR_ = {
  ar: { dir: 'rtl', title: 'التقرير الشهري الشامل لحلقات القرآن الكريم', sum: 'الملخص', circles: 'الحلقات', daily: 'الإنجاز اليومي', progs: 'البرامج والأنشطة', regions: 'المناطق',
    kT: 'عدد الحلقات', kS: 'رفعت التقرير', kM: 'لم ترفع', kR: 'نسبة الرفع %', kSt: 'الطلاب المسجلون', kD: 'الطلاب (حسب الجدول)', kPh: 'الصور', kV: 'الفيديوهات', kDl: 'أيام الإنجاز المسجلة', kAt: 'متوسط الحضور اليومي', kPr: 'البرامج والأنشطة',
    n: 'م', teacher: 'المعلم', halaqa: 'الحلقة', jiha: 'الجهة', region: 'المنطقة', status: 'الحالة', yes: 'رفع', no: 'لم يرفع', repG: 'تاريخ التقرير', repH: 'التاريخ الهجري', stu: 'الطلاب المسجلون', dcl: 'الطلاب (الجدول)', days: 'أيام الإنجاز', avg: 'متوسط الحضور',
    date: 'التاريخ', att: 'الحضور', newH: 'الجديد', rev: 'المراجعة', note: 'ملاحظة', type: 'النوع', ttl: 'العنوان', circ: 'الحلقة', prize: 'الجائزة', win: 'الفائزون', src: 'المصدر', prog: 'برنامج', act: 'نشاط خاص', admin: 'الإدارة العليا', tch: 'معلم', all: 'كل الحلقات',
    pl: 'مخطط', rn: 'جارٍ', dn: 'منتهٍ', file: 'التقرير الشهري', month: 'الشهر', issued: 'تاريخ الإصدار', charts: 'الرسوم البيانية', sheikh: 'حلقات الشيخ عبد الرحمن البلاع', sup: 'بإشراف الشيخ أبي محمد', co: 'بتنفيذ شركة الأمة للخدمات الإنسانية' },
  en: { dir: 'ltr', title: 'Comprehensive Monthly Report — Quran Circles', sum: 'Summary', circles: 'Circles', daily: 'Daily achievements', progs: 'Programs & activities', regions: 'Regions',
    kT: 'Circles', kS: 'Submitted', kM: 'Not submitted', kR: 'Submission rate %', kSt: 'Registered students', kD: 'Students (per sheet)', kPh: 'Photos', kV: 'Videos', kDl: 'Daily logs', kAt: 'Avg daily attendance', kPr: 'Programs & activities',
    n: '#', teacher: 'Teacher', halaqa: 'Circle', jiha: 'Organization', region: 'Region', status: 'Status', yes: 'Submitted', no: 'Not submitted', repG: 'Report date', repH: 'Hijri date', stu: 'Registered students', dcl: 'Students (sheet)', days: 'Days logged', avg: 'Avg attendance',
    date: 'Date', att: 'Attendance', newH: 'New', rev: 'Revision', note: 'Note', type: 'Type', ttl: 'Title', circ: 'Circle', prize: 'Prize', win: 'Winners', src: 'Source', prog: 'Program', act: 'Special activity', admin: 'Top management', tch: 'Teacher', all: 'All circles',
    pl: 'Planned', rn: 'Running', dn: 'Completed', file: 'Monthly report', month: 'Month', issued: 'Issued', charts: 'Charts', sheikh: 'Sheikh Abdulrahman Al-Balaa Circles', sup: 'Supervised by Sheikh Abu Muhammad', co: 'Implemented by Al-Ummah Company for Humanitarian Services' },
  bn: { dir: 'ltr', title: 'কুরআন হালাকার সমন্বিত মাসিক প্রতিবেদন', sum: 'সারসংক্ষেপ', circles: 'হালাকা', daily: 'দৈনিক অর্জন', progs: 'কর্মসূচি ও কার্যক্রম', regions: 'এলাকা',
    kT: 'হালাকা সংখ্যা', kS: 'জমা দিয়েছে', kM: 'জমা দেয়নি', kR: 'জমার হার %', kSt: 'নিবন্ধিত ছাত্র', kD: 'ছাত্র (তালিকা অনুযায়ী)', kPh: 'ছবি', kV: 'ভিডিও', kDl: 'দৈনিক এন্ট্রি', kAt: 'গড় দৈনিক উপস্থিতি', kPr: 'কর্মসূচি ও কার্যক্রম',
    n: 'ক্র.', teacher: 'শিক্ষক', halaqa: 'হালাকা', jiha: 'প্রতিষ্ঠান', region: 'এলাকা', status: 'অবস্থা', yes: 'জমা হয়েছে', no: 'জমা হয়নি', repG: 'প্রতিবেদনের তারিখ', repH: 'হিজরি তারিখ', stu: 'নিবন্ধিত ছাত্র', dcl: 'ছাত্র (তালিকা)', days: 'লিখিত দিন', avg: 'গড় উপস্থিতি',
    date: 'তারিখ', att: 'উপস্থিতি', newH: 'নতুন', rev: 'পুনরাবৃত্তি', note: 'মন্তব্য', type: 'ধরন', ttl: 'শিরোনাম', circ: 'হালাকা', prize: 'পুরস্কার', win: 'বিজয়ীরা', src: 'উৎস', prog: 'কর্মসূচি', act: 'বিশেষ কার্যক্রম', admin: 'উচ্চ প্রশাসন', tch: 'শিক্ষক', all: 'সব হালাকা',
    pl: 'পরিকল্পিত', rn: 'চলমান', dn: 'সমাপ্ত', file: 'মাসিক প্রতিবেদন', month: 'মাস', issued: 'প্রকাশের তারিখ', charts: 'চার্ট', sheikh: 'শায়খ আব্দুর রহমান আল-বাল্লা হালাকা', sup: 'তত্ত্বাবধানে শায়খ আবু মুহাম্মাদ', co: 'বাস্তবায়নে আল-উম্মাহ মানবিক সেবা কোম্পানি' }
};

function monthPrograms_(sm) {
  return sm.programList.filter(p => !p.date || p.date.indexOf(sm.month) === 0);
}

function monthlyReportExcel(phone, lang, month) {
  exportAcc_(phone);
  const L = MR_[lang] || MR_.ar;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) throw new Error('E_MONTH');
  const sm = monthSummary_(month), T = sm.totals;
  const st = { planned: L.pl, running: L.rn, done: L.dn };
  const sheets = [
    { title: L.sum, header: [L.month + ': ' + month, ''], rows: [[L.kT, T.circles], [L.kS, T.submitted], [L.kM, T.missing], [L.kR, T.rate], [L.kSt, T.students], [L.kD, T.declared], [L.kPh, T.photos], [L.kV, T.videos], [L.kDl, T.dailyLogs], [L.kAt, T.avgAtt], [L.kPr, sm.programs.total]] },
    { title: L.circles, header: [L.n, L.teacher, L.halaqa, L.jiha, L.region, L.status, L.repG, L.repH, L.stu, L.dcl, L.kPh, L.kV, L.days, L.avg],
      rows: sm.circles.map((c, i) => [i + 1, c.name, c.halaqa, c.jiha, c.region, c.submitted ? L.yes : L.no, c.date, c.dateH, c.registered, c.declared, c.photos, c.videos, c.days, c.avgAtt]), textCols: [2, 3] },
    { title: L.regions, header: [L.region, L.kT, L.kS, L.kSt], rows: sm.districts.map(d => [d.name, d.circles, d.submitted, d.students]) },
    { title: L.daily, header: [L.date, L.teacher, L.halaqa, L.att, L.newH, L.rev, L.note],
      rows: readDaily_().filter(d => d.date.indexOf(month) === 0).sort((a, b) => a.date < b.date ? -1 : 1).map(d => { const c = sm.circles.find(x => String(x.serial) === d.serial) || {}; return [d.date, c.name || '', c.halaqa || '', d.att, d.newH, d.rev, d.note]; }), textCols: [1] },
    { title: L.progs, header: [L.type, L.ttl, L.date, L.circ, L.prize, L.win, L.status, L.src],
      rows: monthPrograms_(sm).map(p => [p.type === 'activity' ? L.act : L.prog, p.title, p.date, p.serial === '*' ? L.all : (p.halaqa || p.teacher), p.prize, p.winners, st[p.status] || '', p.by === 'admin' ? L.admin : L.tch]) }
  ];
  return xlsx_(L.file + ' ' + month, sheets, L.dir === 'rtl');
}

function monthlyReportPdf(phone, lang, month, monthLabel, logoPng, charts) {
  exportAcc_(phone);
  const L = MR_[lang] || MR_.ar;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) throw new Error('E_MONTH');
  const sm = monthSummary_(month), T = sm.totals;
  const st = { planned: L.pl, running: L.rn, done: L.dn };
  const logo = /^data:image\/png;base64,[A-Za-z0-9+\/=]+$/.test(logoPng || '') && logoPng.length < 500000 ? logoPng : '';
  const align = L.dir === 'rtl' ? 'right' : 'left';
  const th = 'background:#123c34;color:#fff;padding:5px;border:1px solid #c9d4cc;font-size:11px';
  const td = 'padding:4px;border:1px solid #c9d4cc;font-size:11px';
  const kpi = (k, v, c) => '<td style="width:25%;text-align:center;border:1px solid #c9d4cc;padding:8px;background:#f4f8f5"><div style="font-size:22px;font-weight:bold;color:' + c + '">' + esc_(v) + '</div><div style="font-size:11px;color:#5d6b64">' + esc_(k) + '</div></td>';

  let h = '<html dir="' + L.dir + '"><body style="font-family:Arial,sans-serif;text-align:' + align + ';color:#17251f">';
  h += '<div style="text-align:center">' + (logo ? '<img src="' + logo + '" width="130"><br>' : '') + '<h2 style="margin:6px 0;color:#123c34">' + esc_(L.title) + '</h2><div style="font-size:12px">' + esc_(L.sheikh) + ' — ' + esc_(L.sup) + '<br>' + esc_(L.co) + '</div><h3 style="color:#c9a24a;margin:8px 0">' + esc_(monthLabel || month) + '</h3></div><hr>';
  h += '<table style="width:100%;border-collapse:collapse"><tr>' + kpi(L.kT, T.circles, '#1d44b8') + kpi(L.kS, T.submitted, '#1a8a52') + kpi(L.kM, T.missing, '#b3261e') + kpi(L.kR, T.rate + '%', '#0d5c4b') + '</tr><tr>' +
    kpi(L.kSt, T.students, '#1d44b8') + kpi(L.kPh, T.photos, '#1a8a52') + kpi(L.kV, T.videos, '#1a8a52') + kpi(L.kAt, T.avgAtt, '#0d5c4b') + '</tr></table>';
  const imgs = (Array.isArray(charts) ? charts : []).filter(c => /^data:image\/png;base64,[A-Za-z0-9+\/=]+$/.test(c || '') && c.length < 900000).slice(0, 6);
  if (imgs.length) {
    h += '<h3 style="color:#123c34">' + esc_(L.charts) + '</h3><table style="width:100%"><tr>';
    imgs.forEach((c, i) => { h += '<td style="width:50%;padding:4px;text-align:center"><img src="' + c + '" width="330"></td>'; if (i % 2 === 1 && i < imgs.length - 1) h += '</tr><tr>'; });
    h += '</tr></table>';
  }
  h += '<h3 style="color:#123c34">' + esc_(L.circles) + '</h3><table style="width:100%;border-collapse:collapse"><tr>' + [L.n, L.teacher, L.halaqa, L.region, L.status, L.stu, L.days, L.avg].map(x => '<td style="' + th + '">' + esc_(x) + '</td>').join('') + '</tr>';
  sm.circles.forEach((c, i) => {
    h += '<tr>' + [i + 1, c.name, c.halaqa, c.region, c.submitted ? L.yes : L.no, c.registered, c.days, c.avgAtt].map((x, k) => '<td style="' + td + (k === 4 ? ';color:' + (c.submitted ? '#1a8a52' : '#b3261e') + ';font-weight:bold' : '') + '">' + esc_(x) + '</td>').join('') + '</tr>';
  });
  h += '</table>';
  const pl = monthPrograms_(sm);
  if (pl.length) {
    h += '<h3 style="color:#123c34">' + esc_(L.progs) + '</h3><table style="width:100%;border-collapse:collapse"><tr>' + [L.type, L.ttl, L.circ, L.prize, L.win, L.status, L.src].map(x => '<td style="' + th + '">' + esc_(x) + '</td>').join('') + '</tr>';
    pl.forEach(p => { h += '<tr>' + [p.type === 'activity' ? L.act : L.prog, p.title, p.serial === '*' ? L.all : (p.halaqa || p.teacher), p.prize, p.winners, st[p.status] || '', p.by === 'admin' ? L.admin : L.tch].map(x => '<td style="' + td + '">' + esc_(x) + '</td>').join('') + '</tr>'; });
    h += '</table>';
  }
  h += '<p style="font-size:10px;color:#5d6b64;margin-top:14px">' + esc_(L.issued) + ': ' + Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm') + '</p></body></html>';
  const pdf = Utilities.newBlob(h, 'text/html', 'report.html').getAs('application/pdf');
  return { name: L.file + ' ' + month + '.pdf', mime: 'application/pdf', b64: Utilities.base64Encode(pdf.getBytes()) };
}

/* ================= واجهة API (تُستدعى من صفحات GitHub Pages) ================= */
const API_ = {
  login: login, loginKey: loginKey, bootstrap: bootstrap, updateProfile: updateProfile,
  startUpload: startUpload, checkUpload: checkUpload, submitReport: submitReport,
  listStudents: listStudents, saveStudent: saveStudent, deleteStudent: deleteStudent,
  listDaily: listDaily, saveDaily: saveDaily, deleteDaily: deleteDaily,
  adminData: adminData, adminStudents: adminStudents, teachersData: teachersData, docsData: docsData,
  usersList: usersList, userSave: userSave, teacherAdd: teacherAdd, myFile: myFile, teacherFileAdmin: teacherFileAdmin, emailLinks: emailLinks, shareLinks: shareLinks, monthShare: monthShare, shareInit: shareInit, rootLink: rootLink, teacherLink: teacherLink,
  listPrograms: listPrograms, saveProgram: saveProgram, deleteProgram: deleteProgram, programsAdmin: programsAdmin, programSaveAdmin: programSaveAdmin, programDeleteAdmin: programDeleteAdmin,
  aboutGet: aboutGet, aboutSave: aboutSave, insightsData: insightsData, monthlyReportExcel: monthlyReportExcel, monthlyReportPdf: monthlyReportPdf,
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
    return json_({ ok: false, error: 'E_SERVER', detail: m.slice(0, 160) });
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
