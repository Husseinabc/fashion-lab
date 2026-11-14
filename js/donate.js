FL.renderChrome('donate.html');

(function () {
  var $ = function (id) { return document.getElementById(id); };
  var items = [], nextId = 1, net = null;
  var state = { mode: 'auto', thr: 70, showModel: false };

  function finalClass(it) { return it.manual != null ? it.manual : it.cls; }
  function needsReview(it) { return it.manual == null && it.conf * 100 < state.thr; }

  function classify(it) {
    it.tensor = it.fixed || Prep.fromImage(it.img, state.mode);
    it.probs = net.predict(it.tensor);
    var r = FL.ranking(it.probs);
    it.cls = r[0].id; it.conf = r[0].p;
  }

  function ready() {
    return net ? Promise.resolve() : FL.loadModel().then(function (m) { net = m.net; });
  }

  function tick() { return new Promise(function (r) { setTimeout(r, 0); }); }

  function addFiles(files) {
    var list = Array.prototype.filter.call(files, function (f) { return /^image\//.test(f.type); });
    if (!list.length) { FL.toast('اختر ملفات صور فقط'); return; }
    ready().then(function () {
      var chain = Promise.resolve(), failed = 0;
      list.forEach(function (f) {
        chain = chain.then(function () { return FL.loadImage(f); }).then(function (img) {
          var it = { id: nextId++, name: f.name, img: img, thumb: FL.thumb(img), manual: null };
          classify(it); items.push(it); return tick();
        }).catch(function () { failed++; });
      });
      return chain.then(function () {
        render();
        FL.toast('أُضيفت ' + (list.length - failed) + ' قطعة' + (failed ? ' وتعذّر فتح ' + failed : ''));
      });
    }).catch(function (e) { FL.toast('تعذّر تحميل النموذج'); console.error(e); });
  }

  function addDemo() {
    ready().then(function () { return FL.loadLab(); }).then(function (lab) {
      var pool = lab.samples.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 12);
      pool.forEach(function (s) {
        var x = Float32Array.from(s.img, function (v) { return v / 255; });
        var c = document.createElement('canvas'); FL.drawTensor(c, x, 4);
        var it = { id: nextId++, name: 'عيّنة اختبار', thumb: c.toDataURL('image/png'), fixed: x, manual: null, truth: s.label };
        classify(it); items.push(it);
      });
      render(); FL.toast('أُضيفت 12 عيّنة من بيانات الاختبار');
    });
  }

  function render() {
    var box = $('items');
    $('empty').style.display = items.length ? 'none' : '';
    box.innerHTML = items.map(function (it) {
      var c = FL.CLASSES[finalClass(it)], pct = Math.round(it.conf * 100), rv = needsReview(it);
      return '<div class="item glass" data-id="' + it.id + '">' +
        '<div class="ph">' + (state.showModel ? '<canvas data-t="' + it.id + '"></canvas>' : '<img alt="' + FL.esc(it.name) + '" src="' + it.thumb + '">') +
        '<button class="x" type="button" aria-label="حذف" data-act="del">×</button></div>' +
        '<select data-act="set" aria-label="الفئة">' + FL.optionsHtml(finalClass(it)) + '</select>' +
        '<div class="conf" title="ثقة النموذج"><i style="width:' + pct + '%;background:' + (rv ? 'var(--amber)' : c.color) + '"></i></div>' +
        '<div class="small muted">' + (it.manual != null ? '<span class="tag">صُحّحت يدوياً</span>' : 'ثقة ' + pct + '%') + '</div>' +
        (rv ? '<div class="flag">يحتاج مراجعة يدوية</div>' : '') + '</div>';
    }).join('');
    if (state.showModel) items.forEach(function (it) {
      var cv = box.querySelector('canvas[data-t="' + it.id + '"]'); if (cv) FL.drawTensor(cv, it.tensor, 6);
    });
    summary();
  }

  function summary() {
    var counts = new Array(10).fill(0), rv = 0;
    items.forEach(function (it) { counts[finalClass(it)]++; if (needsReview(it)) rv++; });
    $('total').textContent = items.length; $('review').textContent = rv;
    var mx = Math.max.apply(null, counts.concat([1]));
    $('counts').innerHTML = FL.CLASSES.map(function (c) {
      return '<div class="count-row"><span>' + c.emoji + '</span><div class="track"><div class="fill" style="width:' + (counts[c.id] / mx * 100) + '%;background:' + c.color + '"></div></div><b>' + counts[c.id] + '</b></div>';
    }).join('');
    $('bins').innerHTML = Object.keys(FL.GROUPS).map(function (g) {
      var inG = FL.CLASSES.filter(function (c) { return c.group === g; }), n = 0;
      inG.forEach(function (c) { n += counts[c.id]; });
      return '<div class="bin"><span><i style="background:' + FL.GROUPS[g].color + '"></i>' + FL.GROUPS[g].ar +
        '<small>' + inG.map(function (c) { return c.ar; }).join('، ') + '</small></span><b dir="ltr">' + n + '</b></div>';
    }).join('');
    ['csv', 'print', 'clear'].forEach(function (id) { $(id).disabled = !items.length; });
  }

  function reclassifyAll() { items.forEach(classify); render(); }

  /* ----- الأحداث ----- */
  $('pick').addEventListener('change', function (e) { addFiles(e.target.files); e.target.value = ''; });
  $('cam').addEventListener('change', function (e) { addFiles(e.target.files); e.target.value = ''; });
  $('demo').addEventListener('click', addDemo);

  var drop = $('drop');
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { addFiles(e.dataTransfer.files); });

  $('mode').addEventListener('change', function (e) { state.mode = e.target.value; if (items.length) { ready().then(reclassifyAll); } });
  $('thr').addEventListener('input', function (e) { state.thr = +e.target.value; $('thrVal').textContent = state.thr + '%'; render(); });
  $('showModel').addEventListener('change', function (e) { state.showModel = e.target.checked; render(); });

  $('items').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act="del"]'); if (!b) return;
    var id = +b.closest('.item').dataset.id; items = items.filter(function (i) { return i.id !== id; }); render();
  });
  $('items').addEventListener('change', function (e) {
    if (e.target.dataset.act !== 'set') return;
    var id = +e.target.closest('.item').dataset.id;
    items.forEach(function (i) { if (i.id === id) i.manual = +e.target.value; }); render();
  });

  $('clear').addEventListener('click', function () {
    if (confirm('مسح كل القطع؟')) { items = []; render(); }
  });
  $('print').addEventListener('click', function () { window.print(); });
  $('csv').addEventListener('click', function () {
    var rows = [['الملف', 'الفئة', 'الفئة بالإنجليزية', 'المجموعة', 'ثقة النموذج %', 'صُحّحت يدوياً']];
    items.forEach(function (it) {
      var c = FL.CLASSES[finalClass(it)];
      rows.push([it.name, c.ar, c.en, FL.GROUPS[c.group].ar, Math.round(it.conf * 100), it.manual != null ? 'نعم' : 'لا']);
    });
    var csv = '﻿' + rows.map(function (r) { return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    FL.download('donations.csv', csv, 'text/csv;charset=utf-8');
  });

  render();
  ready();
})();
