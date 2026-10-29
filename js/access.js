/* الدخول عبر رابط خاص (الجهة الداعمة وغيرها) */
(async function(){
  const k = new URLSearchParams(location.search).get('k') || '';
  try {
    const r = await api.loginKey(k);
    const a = r.admin; if(a.role === 'donor'){ location.replace('report.html?k=' + encodeURIComponent(k)); return; }
    const home = a.stats ? 'admin.html' : (a.media ? 'docs.html' : 'index.html');
    store.set({ admin:true, phone:r.phone, home:home });
    location.replace(home);
  } catch(e){ applyLang(); $('#m').textContent = err(e); }
})();
