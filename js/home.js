FL.renderChrome('index.html');

(function () {
  var canvas = document.getElementById('demoCanvas');
  var bars = document.getElementById('demoBars');
  var verdict = document.getElementById('demoVerdict');
  var stats = document.getElementById('stats');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  Promise.all([FL.loadModel(), FL.loadLab()]).then(function (r) {
    var model = r[0], lab = r[1], samples = lab.samples;

    var params = 0;
    model.raw.layers.forEach(function (l) { l.weights.forEach(function (w) { params += w.data.length; }); });
    stats.innerHTML = [
      [(lab.accuracy * 100).toFixed(2) + '%', 'دقة النموذج على 10,000 صورة اختبار'],
      [params.toLocaleString('en-US'), 'عدد معاملات الشبكة'],
      ['10', 'فئات: من التي شيرت إلى البوت'],
      ['<span dir="ltr"><span id="ms">–</span> ms</span>', 'زمن التصنيف في متصفحك']
    ].map(function (s) {
      return '<div class="stat glass"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>';
    }).join('');

    var order = samples.map(function (_, i) { return i; });
    for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = order[i]; order[i] = order[j]; order[j] = t; }
    var pos = 0, timer = null;

    function show() {
      var s = samples[order[pos % order.length]]; pos++;
      var x = Float32Array.from(s.img, function (v) { return v / 255; });
      var t0 = performance.now();
      var p = model.net.predict(x);
      var ms = performance.now() - t0;
      FL.drawTensor(canvas, x, 1);
      FL.renderBars(bars, p, { top: 3 });
      var top = FL.ranking(p)[0].id, real = FL.CLASSES[s.label];
      var ok = top === s.label;
      verdict.className = 'verdict ' + (ok ? 'ok' : 'bad');
      verdict.textContent = ok ? 'الفئة الصحيحة: ' + real.ar + ' ✓' : 'أخطأ! الفئة الصحيحة: ' + real.ar;
      var el = document.getElementById('ms'); if (el) el.textContent = ms < 1 ? ms.toFixed(1) : Math.round(ms);
    }
    function start() { if (!reduce) { clearInterval(timer); timer = setInterval(show, 3200); } }

    show(); start();
    document.getElementById('demoNext').addEventListener('click', function () { show(); start(); });
  }).catch(function (e) {
    bars.textContent = 'تعذّر تحميل النموذج. شغّل الموقع عبر خادم محلي أو GitHub Pages، ولا تفتحه بنقر مزدوج على الملف.';
    console.error(e);
  });
})();
