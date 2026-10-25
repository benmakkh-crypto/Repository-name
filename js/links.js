/* روابط الحلقات: نسخ رابط Drive العام ورابط كل حلقة لإرساله للجهة الداعمة */
renderBrand(true);
const LK = { phone:'', data:null };
window.onLangChange = () => { if(LK.data) render(); };
applyLang();

async function copy(txt){
  try { await navigator.clipboard.writeText(txt); toast(t('lkCopied')); }
  catch(e){ prompt('', txt); }
}

function render(){
  $('#lkRootUrl').value = LK.data.root;
  const q = $('#lkSearch').value.trim().toLowerCase();
  const box = $('#lkList'); box.innerHTML = '';
  LK.data.teachers.filter(x => !q || (x.name + ' ' + x.halaqa + ' ' + x.jiha + ' ' + x.region).toLowerCase().indexOf(q) > -1).forEach(x => {
    const c = document.createElement('div'); c.className = 'card';
    const h = document.createElement('h3'); h.textContent = x.name; c.appendChild(h);
    const m = document.createElement('p'); m.className = 'sub'; m.textContent = [x.halaqa && t('halaqa', x.halaqa), x.jiha, x.region].filter(Boolean).join(' — '); c.appendChild(m);
    const row = document.createElement('div'); row.className = 'fbar';
    const mk = (label, fn, ghost) => { const b = document.createElement('button'); b.className = 'btn' + (ghost ? ' ghost' : ''); b.textContent = label; b.onclick = fn; row.appendChild(b); };
    if(x.folder){
      mk(t('lkCopyFolder'), () => copy(x.folder));
      mk(t('lkOpen'), () => window.open(x.folder, '_blank', 'noopener'), true);
    }
    if(x.page) mk(t('lkCopyPage'), () => copy(x.page), true);
    c.appendChild(row); box.appendChild(c);
  });
}

(async () => {
  const g = await adminGuard('links', 'media'); if(!g) return;
  LK.phone = g.phone;
  try { LK.data = await api.shareLinks(g.phone, location.href); render(); }
  catch(e){ toast(err(e), true); }
  $('#lkRootCopy').onclick = () => copy(LK.data.root);
  $('#lkSearch').oninput = render;
})();
