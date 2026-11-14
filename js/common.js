/* أدوات مشتركة بين كل الصفحات */
var FL = (function () {
  var CLASSES = [
    { id: 0, ar: 'تي شيرت',     en: 'T-shirt/top', group: 'top',    emoji: '👕' },
    { id: 1, ar: 'بنطلون',      en: 'Trouser',     group: 'bottom', emoji: '👖' },
    { id: 2, ar: 'بلوفر',       en: 'Pullover',    group: 'top',    emoji: '🧶' },
    { id: 3, ar: 'فستان',       en: 'Dress',       group: 'dress',  emoji: '👗' },
    { id: 4, ar: 'معطف',        en: 'Coat',        group: 'outer',  emoji: '🧥' },
    { id: 5, ar: 'صندل',        en: 'Sandal',      group: 'shoes',  emoji: '🩴' },
    { id: 6, ar: 'قميص',        en: 'Shirt',       group: 'top',    emoji: '👔' },
    { id: 7, ar: 'حذاء رياضي',  en: 'Sneaker',     group: 'shoes',  emoji: '👟' },
    { id: 8, ar: 'حقيبة',       en: 'Bag',         group: 'acc',    emoji: '👜' },
    { id: 9, ar: 'بوت',         en: 'Ankle boot',  group: 'shoes',  emoji: '🥾' }
  ];
  var GROUPS = {
    top:    { ar: 'ملابس علوية', color: '#b8a4ff' },
    bottom: { ar: 'ملابس سفلية', color: '#7ef0d0' },
    dress:  { ar: 'فساتين',      color: '#ff9cc0' },
    outer:  { ar: 'معاطف',       color: '#ffd08a' },
    shoes:  { ar: 'أحذية',       color: '#86c8ff' },
    acc:    { ar: 'حقائب',       color: '#ffb392' }
  };
  CLASSES.forEach(function (c) { c.color = GROUPS[c.group].color; });

  var NAV = [
    ['index.html', 'الرئيسية'],
    ['donate.html', 'فرز التبرعات'],
    ['wardrobe.html', 'خزانتي'],
    ['challenge.html', 'تحدَّ النموذج'],
    ['lab.html', 'مختبر النموذج']
  ];

  function renderChrome(active) {
    var bg = document.createElement('div');
    bg.className = 'bg'; bg.innerHTML = '<i></i><b></b>';
    document.body.prepend(bg);
    var h = document.getElementById('nav');
    if (h) {
      h.className = 'topbar';
      h.innerHTML = '<nav class="nav glass" aria-label="التنقل الرئيسي"><a class="brand" href="index.html"><span class="dot"></span>مختبر الأزياء</a>' +
        NAV.map(function (n) {
          return '<a class="link" href="' + n[0] + '"' + (n[0] === active ? ' aria-current="page"' : '') + '>' + n[1] + '</a>';
        }).join('') + '</nav>';
    }
    var t = document.createElement('div');
    t.className = 'toast glass'; t.id = 'toast'; t.setAttribute('role', 'status');
    document.body.appendChild(t);
  }

  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  /* تحميل النموذج مرة واحدة */
  var modelPromise = null;
  function loadModel() {
    if (!modelPromise) {
      modelPromise = fetch('data/model.json').then(function (r) {
        if (!r.ok) throw new Error('تعذّر تحميل data/model.json');
        return r.json();
      }).then(function (j) { return { net: Engine.create(j), raw: j }; });
    }
    return modelPromise;
  }
  var labPromise = null;
  function loadLab() {
    if (!labPromise) labPromise = fetch('data/lab.json').then(function (r) {
      if (!r.ok) throw new Error('تعذّر تحميل data/lab.json');
      return r.json();
    });
    return labPromise;
  }

  function ranking(probs) {
    return Array.prototype.map.call(probs, function (p, i) { return { id: i, p: p }; })
      .sort(function (a, b) { return b.p - a.p; });
  }

  /* رسم مصفوفة 28×28 على كانفاس بتكبير */
  function drawTensor(canvas, x, scale) {
    var s = scale || 1; canvas.width = 28 * s; canvas.height = 28 * s;
    var ctx = canvas.getContext('2d'), im = ctx.createImageData(28, 28);
    for (var i = 0; i < 784; i++) {
      var v = Math.round(Math.min(1, Math.max(0, x[i])) * 255);
      im.data[i * 4] = v; im.data[i * 4 + 1] = v; im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255;
    }
    if (s === 1) { ctx.putImageData(im, 0, 0); return; }
    var tmp = document.createElement('canvas'); tmp.width = 28; tmp.height = 28;
    tmp.getContext('2d').putImageData(im, 0, 0);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(tmp, 0, 0, 28 * s, 28 * s);
  }

  /* أشرطة الاحتمالات */
  function renderBars(el, probs, opts) {
    opts = opts || {};
    var rank = ranking(probs), n = opts.top || 10, hi = opts.highlight;
    el.classList.add('bars');
    el.innerHTML = rank.slice(0, n).map(function (r, i) {
      var c = CLASSES[r.id];
      return '<div class="bar' + (i === 0 ? ' top' : '') + '"><span class="lbl">' + (hi === r.id ? '🎯 ' : '') + c.ar +
        '</span><div class="track"><div class="fill" style="width:' + (r.p * 100).toFixed(1) + '%;background:' + c.color + '"></div></div>' +
        '<span class="pct">' + (r.p * 100).toFixed(1) + '%</span></div>';
    }).join('');
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('تعذّر فتح الصورة: ' + file.name)); };
      img.src = url;
    });
  }

  /* مصغّرة مربعة (قص من المنتصف) كنص dataURL */
  function thumb(img, size) {
    size = size || 112;
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, s = Math.min(w, h);
    var c = document.createElement('canvas'); c.width = c.height = size;
    var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, size, size);
    return c.toDataURL('image/jpeg', 0.72);
  }

  function optionsHtml(selected) {
    return CLASSES.map(function (c) {
      return '<option value="' + c.id + '"' + (c.id === selected ? ' selected' : '') + '>' + c.emoji + ' ' + c.ar + '</option>';
    }).join('');
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }

  function download(name, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  return {
    CLASSES: CLASSES, GROUPS: GROUPS, renderChrome: renderChrome, toast: toast,
    loadModel: loadModel, loadLab: loadLab, ranking: ranking, drawTensor: drawTensor,
    renderBars: renderBars, loadImage: loadImage, thumb: thumb, optionsHtml: optionsHtml, esc: esc, download: download
  };
})();
