/* عامل الخدمة: يجعل الموقع قابلاً للتثبيت كتطبيق ويعمل واجهته بلا اتصال؛ بيانات الخادم لا تُخزَّن */
const CACHE = 'hq-v2';
const SHELL = ['./','index.html','admin.html','docs.html','teachers.html','insights.html','programs.html','manage.html','links.html','file.html','about.html','access.html',
  'css/style.css','js/i18n.js','js/i18n2.js','js/common.js','js/charts.js','js/teacher.js','js/admin.js','js/docs.js','js/teachers.js','js/insights.js','js/programs.js','js/manage.js','js/file.js','js/about.js','js/access.js',
  'assets/logo.webp','assets/icons/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if(r.method !== 'GET' || u.origin !== location.origin) return;            // الخادم (Apps Script) والخطوط خارج التخزين
  e.respondWith(fetch(r).then(res => { const cp = res.clone(); if(res.ok) caches.open(CACHE).then(c => c.put(r, cp)); return res; })
    .catch(() => caches.match(r, { ignoreSearch:true }).then(m => m || caches.match('index.html'))));
});
