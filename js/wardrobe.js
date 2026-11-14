FL.renderChrome('wardrobe.html');

(function () {
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'fashionlab.wardrobe.v1';
  var TARGETS = { top: 5, bottom: 3, dress: 1, outer: 1, shoes: 3, acc: 1 };
  var items = [], filter = 'all', net = null, mode = 'auto';

  /* ----- التخزين ----- */
  function load() {
    try { var s = localStorage.getItem(KEY); items = s ? JSON.parse(s) : []; } catch (e) { items = []; }
    if (!Array.isArray(items)) items = [];
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(items)); return true; }
    catch (e) { FL.toast('تعذّر الحفظ: مساحة المتصفح ممتلئة'); return false; }
  }

  function ready() { return net ? Promise.resolve() : FL.loadModel().then(function (m) { net = m.net; }); }
  function tick() { return new Promise(function (r) { setTimeout(r, 0); }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function group(it) { return FL.CLASSES[it.cls].group; }

  function addFiles(files) {
    var list = Array.prototype.filter.call(files, function (f) { return /^image\//.test(f.type); });
    if (!list.length) { FL.toast('اختر ملفات صور فقط'); return; }
    ready().then(function () {
      var chain = Promise.resolve(), done = 0;
      list.forEach(function (f) {
        chain = chain.then(function () { return FL.loadImage(f); }).then(function (img) {
          var p = net.predict(Prep.fromImage(img, mode)), r = FL.ranking(p);
          items.push({ id: uid(), cls: r[0].id, conf: Math.round(r[0].p * 100) / 100, thumb: FL.thumb(img), t: Date.now(), manual: false });
          done++; return tick();
        }).catch(function () {});
      });
      return chain.then(function () { save(); render(); FL.toast('أُضيفت ' + done + ' قطعة'); });
    }).catch(function () { FL.toast('تعذّر تحميل النموذج'); });
  }

  function addDemo() {
    ready().then(FL.loadLab).then(function (lab) {
      lab.samples.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 14).forEach(function (s) {
        var x = Float32Array.from(s.img, function (v) { return v / 255; });
        var c = document.createElement('canvas'); FL.drawTensor(c, x, 4);
        var r = FL.ranking(net.predict(x));
        items.push({ id: uid(), cls: r[0].id, conf: Math.round(r[0].p * 100) / 100, thumb: c.toDataURL('image/png'), t: Date.now(), manual: false });
      });
      save(); render(); FL.toast('أُضيفت 14 عيّنة تجريبية');
    });
  }

  /* ----- العرض ----- */
  function render() {
    var gcount = { all: items.length };
    Object.keys(FL.GROUPS).forEach(function (g) { gcount[g] = 0; });
    items.forEach(function (it) { gcount[group(it)]++; });

    $('filters').innerHTML = [['all', 'الكل']].concat(Object.keys(FL.GROUPS).map(function (g) { return [g, FL.GROUPS[g].ar]; }))
      .map(function (f) { return '<button class="chip" type="button" data-f="' + f[0] + '" aria-pressed="' + (filter === f[0]) + '">' + f[1] + ' (' + gcount[f[0]] + ')</button>'; }).join('');

    var shown = items.filter(function (it) { return filter === 'all' || group(it) === filter; });
    $('empty').style.display = items.length ? 'none' : '';
    $('items').innerHTML = shown.map(function (it) {
      var c = FL.CLASSES[it.cls];
      return '<div class="item glass" data-id="' + it.id + '"><div class="ph"><img alt="' + c.ar + '" src="' + it.thumb + '">' +
        '<button class="x" type="button" data-act="del" aria-label="حذف">×</button></div>' +
        '<select data-act="set" aria-label="الفئة">' + FL.optionsHtml(it.cls) + '</select>' +
        '<div class="conf"><i style="width:' + Math.round(it.conf * 100) + '%;background:' + c.color + '"></i></div>' +
        '<div class="small muted">' + (it.manual ? '<span class="tag">صُحّحت يدوياً</span>' : 'ثقة ' + Math.round(it.conf * 100) + '%') + '</div></div>';
    }).join('');

    needs(gcount);
    ['export', 'clear'].forEach(function (id) { $(id).disabled = !items.length; });
  }

  function needs(gcount) {
    $('needs').innerHTML = Object.keys(FL.GROUPS).map(function (g) {
      var have = gcount[g], t = TARGETS[g], ok = have >= t, pct = Math.min(100, have / t * 100);
      var msg = ok ? 'كافٍ' : (have === 0 ? 'لا توجد أي قطعة، يُستحسن ' + t : 'ينقص ' + (t - have));
      return '<div class="need"><div class="top"><span>' + FL.GROUPS[g].ar + '</span><b>' + have + ' / ' + t + '</b></div>' +
        '<div class="conf"><i style="width:' + pct + '%;background:' + FL.GROUPS[g].color + '"></i></div>' +
        '<div class="msg">' + msg + '</div></div>';
    }).join('');
  }

  function pick(g) {
    var l = items.filter(function (it) { return group(it) === g; });
    return l.length ? l[Math.floor(Math.random() * l.length)] : null;
  }

  function outfit() {
    var out = [], top = pick('top'), bottom = pick('bottom'), dress = pick('dress'), shoes = pick('shoes');
    var useDress = dress && (!(top && bottom) || Math.random() < 0.35);
    var missing = [];
    if (useDress) out.push(dress);
    else if (top && bottom) out.push(top, bottom);
    else { if (!top) missing.push('ملابس علوية'); if (!bottom) missing.push('ملابس سفلية'); }
    if (shoes) out.push(shoes); else missing.push('أحذية');
    if (missing.length) { $('look').innerHTML = '<p class="muted small" style="margin-top:12px">لا أستطيع تركيب إطلالة بعد. ينقصك: ' + missing.join('، ') + '.</p>'; return; }
    var coat = pick('outer'), bag = pick('acc');
    if (coat && Math.random() < 0.6) out.push(coat);
    if (bag && Math.random() < 0.5) out.push(bag);
    $('look').innerHTML = '<div class="look">' + out.map(function (it) {
      return '<figure><img alt="" src="' + it.thumb + '">' + FL.CLASSES[it.cls].ar + '</figure>';
    }).join('') + '</div>';
  }

  /* ----- الأحداث ----- */
  $('pick').addEventListener('change', function (e) { addFiles(e.target.files); e.target.value = ''; });
  $('cam').addEventListener('change', function (e) { addFiles(e.target.files); e.target.value = ''; });
  $('demo').addEventListener('click', addDemo);
  $('mode').addEventListener('change', function (e) { mode = e.target.value; });
  $('outfit').addEventListener('click', outfit);

  $('filters').addEventListener('click', function (e) {
    var b = e.target.closest('[data-f]'); if (!b) return; filter = b.dataset.f; render();
  });
  $('items').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act="del"]'); if (!b) return;
    var id = b.closest('.item').dataset.id; items = items.filter(function (i) { return i.id !== id; }); save(); render();
  });
  $('items').addEventListener('change', function (e) {
    if (e.target.dataset.act !== 'set') return;
    var id = e.target.closest('.item').dataset.id;
    items.forEach(function (i) { if (i.id === id) { i.cls = +e.target.value; i.manual = true; } });
    save(); render();
  });
  $('clear').addEventListener('click', function () {
    if (confirm('مسح كل قطع الخزانة؟ لا يمكن التراجع.')) { items = []; save(); render(); $('look').innerHTML = ''; }
  });
  $('export').addEventListener('click', function () { FL.download('wardrobe.json', JSON.stringify(items), 'application/json'); });
  $('import').addEventListener('change', function (e) {
    var f = e.target.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var data = JSON.parse(r.result);
        if (!Array.isArray(data) || !data.every(function (d) { return d && typeof d.cls === 'number' && d.cls >= 0 && d.cls < 10 && typeof d.thumb === 'string' && d.thumb.indexOf('data:image/') === 0; })) throw new Error('bad');
        data.forEach(function (d) { d.id = d.id || uid(); }); items = items.concat(data); save(); render(); FL.toast('استُوردت ' + data.length + ' قطعة');
      } catch (err) { FL.toast('الملف ليس نسخة خزانة صالحة'); }
    };
    r.readAsText(f); e.target.value = '';
  });

  load(); render(); ready();
})();
