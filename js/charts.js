/* رسوم بيانية SVG خفيفة بلا مكتبات — تُحوَّل إلى PNG لإدراجها في تقرير PDF */
const CH = { pri:'#0d5c4b', gold:'#c9a24a', blue:'#1d44b8', ok:'#1a8a52', err:'#b3261e', mute:'#5d6b64', line:'#dde5e0', soft:'#eef4f0',
  pal:['#0d5c4b','#c9a24a','#1d44b8','#1a8a52','#7a5cc8','#d9622b','#2a9bb5','#a63d2f'] };
const NS = 'http://www.w3.org/2000/svg';
const FONT = "Tajawal,'Hind Siliguri',Arial,sans-serif";
function svgEl(w, h){ const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 ' + w + ' ' + h); s.setAttribute('width', '100%'); s.setAttribute('xmlns', NS); s.setAttribute('direction', 'ltr'); s.style.direction = 'ltr'; s.dataset.w = w; s.dataset.h = h; return s; }
function sx(p, a){ const e = document.createElementNS(NS, p); for(const k in a) e.setAttribute(k, a[k]); return e; }
function tx(s, x, y, text, o){ o = o || {}; const e = sx('text', { x:x, y:y, 'text-anchor':o.a || 'middle', 'font-size':o.s || 12, 'font-family':FONT, fill:o.c || CH.mute, 'font-weight':o.w || 400 }); e.textContent = text; s.appendChild(e); return e; }
function bg(s){ s.insertBefore(sx('rect', { x:0, y:0, width:s.dataset.w, height:s.dataset.h, fill:'#ffffff' }), s.firstChild); }
const nf = n => (+n).toLocaleString('en');

/* دائرة نسبية */
function donut(parts, center, sub){
  const W = 320, H = 230, s = svgEl(W, H), cx = 110, cy = 115, R = 80, r = 52;
  const tot = parts.reduce((a, p) => a + p.value, 0) || 1;
  let a0 = -Math.PI / 2;
  parts.filter(p => p.value > 0).forEach(p => {
    const a1 = a0 + (p.value / tot) * Math.PI * 2 - (parts.filter(q => q.value > 0).length > 1 ? 0.02 : 0);
    const big = a1 - a0 > Math.PI ? 1 : 0;
    const pt = (a, rr) => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
    const [x0, y0] = pt(a0, R), [x1, y1] = pt(a1, R), [x2, y2] = pt(a1, r), [x3, y3] = pt(a0, r);
    if(p.value >= tot){ s.appendChild(sx('circle', { cx:cx, cy:cy, r:(R + r) / 2, fill:'none', stroke:p.color, 'stroke-width':R - r })); }
    else s.appendChild(sx('path', { d:`M${x0},${y0} A${R},${R} 0 ${big} 1 ${x1},${y1} L${x2},${y2} A${r},${r} 0 ${big} 0 ${x3},${y3} Z`, fill:p.color }));
    a0 += (p.value / tot) * Math.PI * 2;
  });
  tx(s, cx, cy + 2, center, { s:30, c:CH.pri, w:700 }); tx(s, cx, cy + 22, sub || '', { s:11 });
  parts.forEach((p, i) => {
    s.appendChild(sx('rect', { x:215, y:60 + i * 30, width:12, height:12, rx:3, fill:p.color }));
    tx(s, 233, 71 + i * 30, p.label, { a:'start', s:12, c:'#17251f' }); tx(s, 233, 86 + i * 30, nf(p.value), { a:'start', s:11, w:700, c:p.color });
  });
  bg(s); return s;
}

/* أعمدة (مع خط اتجاه اختياري) */
function columns(items, o){
  o = o || {};
  const W = o.w || 520, H = o.h || 240, s = svgEl(W, H), L = 34, B = 40, T = 18, n = items.length;
  const max = Math.max(1, ...items.map(i => i.value)), step = Math.pow(10, Math.floor(Math.log10(max))), top = Math.ceil(max / step) * step;
  const iw = (W - L - 10) / n, bw = Math.min(34, iw * 0.6);
  for(let g = 0; g <= 4; g++){
    const y = T + (H - T - B) * (1 - g / 4);
    s.appendChild(sx('line', { x1:L, x2:W - 6, y1:y, y2:y, stroke:CH.line, 'stroke-width':1 }));
    tx(s, L - 6, y + 4, nf(Math.round(top * g / 4)), { a:'end', s:10 });
  }
  const pts = [];
  items.forEach((it, i) => {
    const x = L + iw * i + (iw - bw) / 2, h = (H - T - B) * it.value / top, y = H - B - h;
    s.appendChild(sx('rect', { x:x, y:y, width:bw, height:Math.max(h, it.value ? 2 : 0), rx:5, fill:it.color || o.color || CH.pri }));
    if(it.value) tx(s, x + bw / 2, y - 5, nf(it.value), { s:10, c:'#17251f', w:700 });
    tx(s, x + bw / 2, H - B + 16, it.label, { s:10 });
    pts.push([x + bw / 2, y]);
  });
  if(o.line && pts.length > 1){ s.appendChild(sx('polyline', { points:pts.map(p => p.join(',')).join(' '), fill:'none', stroke:CH.gold, 'stroke-width':2.5 })); pts.forEach(p => s.appendChild(sx('circle', { cx:p[0], cy:p[1], r:3.5, fill:'#fff', stroke:CH.gold, 'stroke-width':2 }))); }
  bg(s); return s;
}

/* خطوط (منطقة) */
function area(items, o){
  o = o || {};
  const W = o.w || 520, H = o.h || 220, s = svgEl(W, H), L = 34, B = 34, T = 14, n = items.length;
  const max = Math.max(1, ...items.map(i => i.value)), top = Math.ceil(max * 1.15);
  for(let g = 0; g <= 4; g++){
    const y = T + (H - T - B) * (1 - g / 4);
    s.appendChild(sx('line', { x1:L, x2:W - 8, y1:y, y2:y, stroke:CH.line }));
    tx(s, L - 6, y + 4, nf(Math.round(top * g / 4)), { a:'end', s:10 });
  }
  if(!n){ bg(s); return s; }
  const X = i => n === 1 ? (L + W - 8) / 2 : L + (W - L - 8) * i / (n - 1), Y = v => H - B - (H - T - B) * v / top;
  const pts = items.map((it, i) => [X(i), Y(it.value)]);
  s.appendChild(sx('path', { d:'M' + pts[0][0] + ',' + (H - B) + ' L' + pts.map(p => p.join(',')).join(' L') + ' L' + pts[n - 1][0] + ',' + (H - B) + ' Z', fill:o.color || CH.pri, 'fill-opacity':.14 }));
  s.appendChild(sx('polyline', { points:pts.map(p => p.join(',')).join(' '), fill:'none', stroke:o.color || CH.pri, 'stroke-width':2.5, 'stroke-linejoin':'round' }));
  pts.forEach((p, i) => { s.appendChild(sx('circle', { cx:p[0], cy:p[1], r:3, fill:'#fff', stroke:o.color || CH.pri, 'stroke-width':2 })); if(n <= 12 || i % Math.ceil(n / 10) === 0) tx(s, p[0], H - B + 16, items[i].label, { s:10 }); });
  bg(s); return s;
}

/* أشرطة أفقية */
function hbars(items, o){
  o = o || {};
  const rowH = 30, W = o.w || 520, H = Math.max(60, items.length * rowH + 14), s = svgEl(W, H);
  const max = Math.max(1, ...items.map(i => i.value)), LW = o.lw || 150, BW = W - LW - 60;
  items.forEach((it, i) => {
    const y = 8 + i * rowH, w = BW * it.value / max;
    s.appendChild(sx('rect', { x:LW, y:y, width:BW, height:16, rx:8, fill:CH.soft }));
    s.appendChild(sx('rect', { x:LW, y:y, width:Math.max(w, it.value ? 6 : 0), height:16, rx:8, fill:it.color || CH.pal[i % CH.pal.length] }));
    tx(s, LW - 8, y + 12, it.label.length > 22 ? it.label.slice(0, 21) + '…' : it.label, { a:'end', s:11.5, c:'#17251f' });
    tx(s, LW + Math.max(w, 6) + 6, y + 12, nf(it.value), { a:'start', s:11, w:700, c:CH.pri });
  });
  bg(s); return s;
}

/* خريطة تقريبية لبنغلاديش مع فقاعات للمناطق */
const BD_OUT = [[88.08,26.2],[88.45,26.55],[88.75,26.62],[88.93,26.25],[89.35,26.2],[89.75,26.1],[89.8,25.3],[90.4,25.2],[91.0,25.15],[91.6,25.15],[92.1,25.0],[92.3,24.6],[92.0,24.35],[91.95,24.1],[91.65,23.8],[91.4,23.6],[91.2,23.1],[91.55,22.9],[91.7,22.6],[92.3,22.7],[92.55,22.1],[92.65,21.9],[92.3,21.3],[92.33,20.75],[92.1,21.1],[91.98,21.45],[91.8,22.0],[91.85,22.3],[91.4,22.45],[91.0,22.55],[90.9,22.1],[90.5,21.85],[90.0,21.8],[89.6,21.78],[89.1,21.7],[88.9,21.6],[88.85,22.2],[88.7,22.7],[88.9,23.1],[88.6,23.35],[88.35,23.9],[88.1,24.3],[88.4,24.55],[88.0,24.7],[88.15,25.2],[88.5,25.25],[88.1,25.8],[88.4,26.05]];
const BD_PLACES = [['كوكسبازار',21.45,91.98,'Cox\'s Bazar'],['كوكس',21.45,91.98,''],['شيتاغونغ',22.34,91.83,'Chattogram'],['شيتاجونج',22.34,91.83,''],['تشيتاغونغ',22.34,91.83,''],['شيتاغونج',22.34,91.83,''],['دكا',23.81,90.41,'Dhaka'],['داكا',23.81,90.41,''],['سيلهت',24.9,91.87,'Sylhet'],['سلهت',24.9,91.87,''],['راجشاهي',24.37,88.6,'Rajshahi'],['خولنا',22.82,89.55,'Khulna'],['خلنا',22.82,89.55,''],['باريسال',22.7,90.37,'Barishal'],['رنغبور',25.74,89.25,'Rangpur'],['رانغبور',25.74,89.25,''],['ميمنسينغ',24.75,90.4,'Mymensingh'],['كومیلا',23.46,91.18,'Cumilla'],['كوميلا',23.46,91.18,''],['نواخالي',22.87,91.1,'Noakhali'],['بندربان',22.2,92.2,'Bandarban'],['رانغاماتي',22.65,92.17,'Rangamati']];
const bdNorm = x => String(x || '').replace(/[\sً-ْـ]/g, '').replace(/^ال/, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
function bdPlace(name){ const n = bdNorm(name); return BD_PLACES.find(p => n.indexOf(bdNorm(p[0])) > -1) || null; }
function bdMap(districts, label){
  const sc = 80, X = lon => (lon - 87.9) * 0.916 * sc + 12, Y = lat => (26.8 - lat) * sc + 12;
  const W = 400, H = 500, s = svgEl(W, H);
  s.appendChild(sx('polygon', { points:BD_OUT.map(p => X(p[0]) + ',' + Y(p[1])).join(' '), fill:'#e3efe9', stroke:CH.pri, 'stroke-width':2, 'stroke-linejoin':'round' }));
  const max = Math.max(1, ...districts.map(d => d.students)), unk = [];
  const placed = {};
  districts.forEach((d, i) => {
    const p = bdPlace(d.name); if(!p){ unk.push(d); return; }
    const key = p[1] + ',' + p[2]; if(placed[key]){ placed[key].students += d.students; placed[key].circles += d.circles; return; }
    placed[key] = { p:p, name:d.name, students:d.students, circles:d.circles, c:CH.pal[Object.keys(placed).length % CH.pal.length] };
  });
  Object.keys(placed).forEach(k => {
    const o = placed[k], x = X(o.p[2]), y = Y(o.p[1]), r = 9 + 17 * Math.sqrt(o.students / max);
    s.appendChild(sx('circle', { cx:x, cy:y, r:r, fill:o.c, 'fill-opacity':.28 }));
    s.appendChild(sx('circle', { cx:x, cy:y, r:r, fill:'none', stroke:o.c, 'stroke-width':2 }));
    s.appendChild(sx('circle', { cx:x, cy:y, r:4, fill:o.c }));
    const right = x < W - 130;
    tx(s, right ? x + r + 8 : x - r - 8, y - 2, o.name, { a:right ? 'start' : 'end', s:13, c:'#17251f', w:700 });
    tx(s, right ? x + r + 8 : x - r - 8, y + 14, o.circles + ' • ' + nf(o.students), { a:right ? 'start' : 'end', s:11, c:o.c, w:700 });
  });
  tx(s, W - 10, H - 8, label || '', { a:'end', s:10 });
  bg(s); s._unmapped = unk; return s;
}

/* تحويل SVG إلى PNG data URL (لتقرير PDF) */
function svgToPng(svg, w){
  return new Promise(res => {
    try {
      const W = +svg.dataset.w, H = +svg.dataset.h, k = (w || 700) / W;
      const c = svg.cloneNode(true); c.setAttribute('width', W); c.setAttribute('height', H);
      const data = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(c));
      const im = new Image();
      im.onload = () => { const cv = document.createElement('canvas'); cv.width = W * k; cv.height = H * k; const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(im, 0, 0, cv.width, cv.height); res(cv.toDataURL('image/png')); };
      im.onerror = () => res('');
      im.src = data;
    } catch(e){ res(''); }
  });
}
