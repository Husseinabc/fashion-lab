FL.renderChrome('lab.html');

(function () {
  var $ = function (id) { return document.getElementById(id); };
  var C = FL.CLASSES;

  /* قيم سجل التدريب من الدفتر (10 حقب) */
  var H = {
    trainAcc: [.8434, .8863, .8980, .9027, .9106, .9145, .9183, .9204, .9222, .9252],
    valAcc:   [.8877, .8745, .8988, .9073, .8933, .9183, .9156, .9132, .9185, .9154],
    trainLoss: [.4470, .3148, .2848, .2704, .2485, .2363, .2281, .2183, .2102, .2040],
    valLoss:   [.3112, .3487, .2736, .2523, .2953, .2302, .2359, .2347, .2287, .2285]
  };

  function lineChart(el, a, b, lo, hi, fmt) {
    var W = 520, Hh = 250, L = 46, R = 14, T = 14, B = 30, n = a.length;
    function X(i) { return L + i * (W - L - R) / (n - 1); }
    function Y(v) { return T + (hi - v) / (hi - lo) * (Hh - T - B); }
    var g = '', i, t;
    for (i = 0; i <= 4; i++) {
      t = lo + (hi - lo) * i / 4;
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(t) + '" y2="' + Y(t) + '" stroke="rgba(255,255,255,.12)"/>' +
           '<text x="' + (L - 8) + '" y="' + (Y(t) + 4) + '" fill="rgba(245,243,255,.6)" font-size="11" text-anchor="end">' + fmt(t) + '</text>';
    }
    for (i = 0; i < n; i++) g += '<text x="' + X(i) + '" y="' + (Hh - 8) + '" fill="rgba(245,243,255,.6)" font-size="11" text-anchor="middle">' + (i + 1) + '</text>';
    function path(s, col) {
      return '<polyline fill="none" stroke="' + col + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="' +
        s.map(function (v, k) { return X(k) + ',' + Y(v); }).join(' ') + '"/>' +
        s.map(function (v, k) { return '<circle cx="' + X(k) + '" cy="' + Y(v) + '" r="3.2" fill="' + col + '"><title>الحقبة ' + (k + 1) + ': ' + fmt(v) + '</title></circle>'; }).join('');
    }
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="منحنى التدريب والاختبار عبر الحقب">' + g + path(a, '#b8a4ff') + path(b, '#7ef0d0') + '</svg>';
  }

  function archList(raw) {
    var P = raw.layers.map(function (l) { return l.weights.reduce(function (s, w) { return s + w.data.length; }, 0); });
    function n(v) { return v.toLocaleString('en-US') + ' params'; }
    var rows = [
      ['المدخل', '28×28×1', 0],
      ['Conv 3×3 (32) + ReLU', '28×28×32 · ' + n(P[0]), 0],
      ['BatchNorm', n(P[1]), 0],
      ['MaxPool 2×2', '14×14×32', 0],
      ['Dropout 0.2', 'تدريب فقط', 1],
      ['Conv 3×3 (64) + ReLU', '14×14×64 · ' + n(P[2]), 0],
      ['BatchNorm', n(P[3]), 0],
      ['MaxPool 2×2', '7×7×64', 0],
      ['Dropout 0.2', 'تدريب فقط', 1],
      ['Flatten', '3136', 0],
      ['Dense 64 + ReLU', n(P[4]), 0],
      ['BatchNorm', n(P[5]), 0],
      ['Dropout 0.3', 'تدريب فقط', 1],
      ['Dense 10 + Softmax', n(P[6]), 0]
    ];
    $('arch').innerHTML = rows.map(function (r) {
      return '<li class="glass' + (r[2] ? ' skip' : '') + '"><b>' + (/^[A-Za-z]/.test(r[0]) ? '<bdi dir="ltr">' + r[0].replace(/\u200f/g, '') + '</bdi>' : r[0]) + '</b><span>' + r[1] + '</span></li>';
    }).join('');
    return P.reduce(function (a, b) { return a + b; }, 0);
  }

  function confusion(cm) {
    var rowSum = cm.map(function (r) { return r.reduce(function (a, b) { return a + b; }, 0); });
    var h = '<tr><th></th>' + C.map(function (c) { return '<th>' + c.ar + '</th>'; }).join('') + '</tr>';
    cm.forEach(function (row, i) {
      h += '<tr><th class="rowh">' + C[i].ar + '</th>' + row.map(function (v, j) {
        var f = v / rowSum[i];
        var bg = i === j ? 'rgba(126,240,208,' + (0.12 + 0.6 * f).toFixed(2) + ')' : (v ? 'rgba(255,140,185,' + Math.min(0.85, 0.1 + f * 5).toFixed(2) + ')' : 'rgba(255,255,255,.04)');
        return '<td style="background:' + bg + '" title="الحقيقي: ' + C[i].ar + '، المتوقع: ' + C[j].ar + ' — ' + v + ' صورة (' + (f * 100).toFixed(1) + '%)">' + v + '</td>';
      }).join('') + '</tr>';
    });
    $('cm').innerHTML = h;
  }

  function perClass(cm) {
    var n = 10, rows = [], tot = 0, ok = 0;
    for (var i = 0; i < n; i++) {
      var tp = cm[i][i], rs = 0, cs = 0;
      for (var j = 0; j < n; j++) { rs += cm[i][j]; cs += cm[j][i]; }
      var p = tp / cs, r = tp / rs, f = 2 * p * r / (p + r);
      rows.push({ i: i, p: p, r: r, f: f }); tot += rs; ok += tp;
    }
    $('perClass').innerHTML = '<tr><th>الفئة</th><th class="num">الدقة</th><th class="num">الاستدعاء</th><th class="num">F1</th><th></th></tr>' +
      rows.map(function (x) {
        return '<tr><td>' + C[x.i].emoji + ' ' + C[x.i].ar + '</td><td class="num">' + (x.p * 100).toFixed(1) + '</td><td class="num">' + (x.r * 100).toFixed(1) + '</td><td class="num">' + (x.f * 100).toFixed(1) + '</td>' +
          '<td><span class="f1bar" style="width:' + Math.round(x.f * 60) + 'px;background:' + (x.f < 0.8 ? 'var(--rose)' : 'var(--mint)') + '"></span></td></tr>';
      }).join('');

    var pairs = [];
    for (var a = 0; a < n; a++) for (var b = 0; b < n; b++) if (a !== b && cm[a][b]) pairs.push({ a: a, b: b, v: cm[a][b], rs: cm[a].reduce(function (s, v) { return s + v; }, 0) });
    pairs.sort(function (x, y) { return y.v - x.v; });
    $('pairs').innerHTML = pairs.slice(0, 6).map(function (p) {
      return '<div class="pair"><span>«' + C[p.a].ar + '» يُصنَّف «' + C[p.b].ar + '»</span><b>' + p.v + ' · ' + (p.v / p.rs * 100).toFixed(1) + '%</b></div>';
    }).join('');
    return { acc: ok / tot, worst: rows.slice().sort(function (x, y) { return x.f - y.f; })[0] };
  }

  /* ----- مستكشف العينات ----- */
  function explorer(lab, net) {
    var S = lab.samples, filter = 'all', sel = -1;
    var tens = S.map(function (s) { return Float32Array.from(s.img, function (v) { return v / 255; }); });
    var jsPred = tens.map(function (x) { return FL.ranking(net.predict(x))[0].id; });
    var agree = 0, jsOk = 0, kerasOk = 0;
    S.forEach(function (s, i) { if (jsPred[i] === s.pred) agree++; if (jsPred[i] === s.label) jsOk++; if (s.pred === s.label) kerasOk++; });
    var sc = $('selfcheck');
    sc.textContent = 'تطابق محرك المتصفح مع Keras: ' + agree + ' من ' + S.length + (agree === S.length ? ' ✓' : '');
    if (agree !== S.length) { sc.style.color = 'var(--amber)'; sc.style.borderColor = 'var(--amber)'; sc.style.background = 'rgba(255,208,138,.14)'; }

    var errs = S.filter(function (s, i) { return jsPred[i] !== s.label; }).length;
    function filters() {
      var opts = [['all', 'كل العينات (' + S.length + ')'], ['err', 'الأخطاء فقط (' + errs + ')']];
      C.forEach(function (c) { opts.push([String(c.id), c.ar]); });
      $('exFilters').innerHTML = opts.map(function (o) {
        return '<button class="chip" type="button" data-f="' + o[0] + '" aria-pressed="' + (filter === o[0]) + '">' + o[1] + '</button>';
      }).join('');
    }
    function tiles() {
      var html = '';
      S.forEach(function (s, i) {
        var bad = jsPred[i] !== s.label;
        if (filter === 'err' ? !bad : (filter !== 'all' && +filter !== s.label)) return;
        html += '<button type="button" data-i="' + i + '" class="' + (bad ? 'err' : '') + '" aria-pressed="' + (i === sel) + '" aria-label="' + C[s.label].ar + (bad ? ' (خطأ)' : '') + '"><canvas width="28" height="28" data-c="' + i + '"></canvas></button>';
      });
      $('tiles').innerHTML = html || '<span class="muted">لا توجد عينات.</span>';
      Array.prototype.forEach.call($('tiles').querySelectorAll('canvas'), function (cv) { FL.drawTensor(cv, tens[+cv.dataset.c], 1); });
    }
    function detail() {
      if (sel < 0) return;
      var s = S[sel], p = net.predict(tens[sel]), top = FL.ranking(p)[0].id, ok = top === s.label;
      $('detail').innerHTML = '<canvas id="dc" width="28" height="28"></canvas>' +
        '<div><div>الفئة الحقيقية: <b>' + C[s.label].ar + '</b></div><div>توقّع النموذج: <b style="color:' + (ok ? 'var(--mint)' : 'var(--bad)') + '">' + C[top].ar + (ok ? ' ✓' : ' ✗') + '</b></div>' +
        '<div class="small muted">توقّع Keras الأصلي: ' + C[s.pred].ar + '</div></div><div id="db"></div>';
      FL.drawTensor($('dc'), tens[sel], 6); FL.renderBars($('db'), p, { top: 5 });
    }
    $('exFilters').addEventListener('click', function (e) { var b = e.target.closest('[data-f]'); if (!b) return; filter = b.dataset.f; filters(); tiles(); });
    $('tiles').addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (!b) return; sel = +b.dataset.i; tiles(); detail(); });
    filters(); tiles();
    return { jsOk: jsOk, kerasOk: kerasOk, n: S.length };
  }

  lineChart($('chAcc'), H.trainAcc, H.valAcc, 0.84, 0.94, function (v) { return (v * 100).toFixed(1) + '%'; });
  lineChart($('chLoss'), H.trainLoss, H.valLoss, 0.18, 0.36, function (v) { return v.toFixed(2); });

  Promise.all([FL.loadModel(), FL.loadLab()]).then(function (r) {
    var model = r[0], lab = r[1];
    var params = archList(model.raw);
    confusion(lab.confusion);
    var m = perClass(lab.confusion);
    var ex = explorer(lab, model.net);
    $('stats').innerHTML = [
      [(m.acc * 100).toFixed(2) + '%', 'دقة الاختبار (10,000 صورة)'],
      ['92.52%', 'دقة التدريب في الحقبة الأخيرة'],
      [params.toLocaleString('en-US'), 'عدد المعاملات'],
      [C[m.worst.i].ar, 'أضعف فئة (F1 = ' + (m.worst.f * 100).toFixed(1) + '%)']
    ].map(function (s) { return '<div class="stat glass"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>'; }).join('');
  }).catch(function (e) {
    $('stats').innerHTML = '<div class="note">تعذّر تحميل ملفات البيانات. شغّل الموقع عبر خادم محلي أو GitHub Pages.</div>';
    console.error(e);
  });
})();
