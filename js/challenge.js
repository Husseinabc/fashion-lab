FL.renderChrome('challenge.html');

(function () {
  var $ = function (id) { return document.getElementById(id); };
  var pad = $('pad'), ctx = pad.getContext('2d');
  var strokes = [], cur = null, net = null, dirty = false;
  var game = null;     // { round, targets, results, locked }

  /* ----- الرسم ----- */
  function redraw() {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, pad.width, pad.height);
    ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    strokes.forEach(function (s) {
      ctx.lineWidth = s.size;
      if (s.pts.length === 1) { ctx.beginPath(); ctx.arc(s.pts[0][0], s.pts[0][1], s.size / 2, 0, Math.PI * 2); ctx.fill(); return; }
      ctx.beginPath(); ctx.moveTo(s.pts[0][0], s.pts[0][1]);
      for (var i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i][0], s.pts[i][1]);
      ctx.stroke();
    });
  }
  function pos(e) {
    var r = pad.getBoundingClientRect(), k = pad.width / r.width;
    return [(e.clientX - r.left) * k, (e.clientY - r.top) * k];
  }
  pad.addEventListener('pointerdown', function (e) {
    if (game && game.locked) return;
    pad.setPointerCapture(e.pointerId);
    cur = { size: +$('size').value * (pad.width / 448), pts: [pos(e)] };
    strokes.push(cur); redraw(); schedule(); e.preventDefault();
  });
  pad.addEventListener('pointermove', function (e) {
    if (!cur) return; cur.pts.push(pos(e)); redraw(); schedule();
  });
  ['pointerup', 'pointercancel'].forEach(function (ev) { pad.addEventListener(ev, function () { if (cur) { cur = null; schedule(); } }); });

  $('undo').addEventListener('click', function () { if (game && game.locked) return; strokes.pop(); redraw(); schedule(); });
  $('clear').addEventListener('click', function () { if (game && game.locked) return; strokes = []; redraw(); schedule(); });
  $('center').addEventListener('change', schedule);

  /* ----- التنبؤ ----- */
  function tensor() {
    var S = 112, off = document.createElement('canvas'); off.width = off.height = S;
    var o = off.getContext('2d', { willReadFrequently: true });
    o.imageSmoothingQuality = 'high'; o.drawImage(pad, 0, 0, S, S);
    var px = o.getImageData(0, 0, S, S).data, g = new Float32Array(S * S);
    for (var i = 0; i < S * S; i++) g[i] = px[i * 4] / 255;
    if ($('center').checked) return Prep.fromGray(g, S, S, 'plain');
    var out = new Float32Array(784), k = S / 28;           // بدون تمركز: تصغير مباشر
    for (var y = 0; y < 28; y++) for (var x = 0; x < 28; x++) {
      var a = 0; for (var dy = 0; dy < k; dy++) for (var dx = 0; dx < k; dx++) a += g[(y * k + dy) * S + x * k + dx];
      out[y * 28 + x] = a / (k * k);
    }
    return out;
  }

  function schedule() { if (!dirty) { dirty = true; requestAnimationFrame(predict); } }
  var lastProbs = null;
  function predict() {
    dirty = false;
    if (!strokes.length) {
      lastProbs = null; FL.drawTensor($('eye'), new Float32Array(784), 1);
      $('bars').innerHTML = '<span class="muted">ارسم شيئاً لتبدأ.</span>'; return;
    }
    if (!net) return;
    var x = tensor(); FL.drawTensor($('eye'), x, 1);
    lastProbs = net.predict(x);
    FL.renderBars($('bars'), lastProbs, { top: 10, highlight: game ? game.targets[game.round] : undefined });
  }

  /* ----- التحدي ----- */
  function setMode(g) {
    $('mFree').setAttribute('aria-pressed', !g); $('mGame').setAttribute('aria-pressed', g);
    $('endBox').hidden = true;
    if (g) startGame(); else { game = null; $('gameBox').hidden = true; strokes = []; redraw(); schedule(); }
  }
  $('mFree').addEventListener('click', function () { setMode(false); });
  $('mGame').addEventListener('click', function () { setMode(true); });
  $('again').addEventListener('click', function () { startGame(); });

  function startGame() {
    var ids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].sort(function () { return Math.random() - 0.5; }).slice(0, 5);
    game = { round: 0, targets: ids, results: [], locked: false };
    $('endBox').hidden = true; $('gameBox').hidden = false; newRound();
  }
  function newRound() {
    game.locked = false; strokes = []; redraw();
    var c = FL.CLASSES[game.targets[game.round]];
    $('tEmoji').textContent = c.emoji; $('tName').textContent = 'ارسم: ' + c.ar;
    $('tRound').textContent = 'الجولة ' + (game.round + 1) + ' من 5';
    var fb = $('feedback'); fb.textContent = ''; fb.className = 'feedback';
    $('confirm').hidden = false; $('skip').hidden = false; $('next').hidden = true;
    drawRounds(); schedule();
  }
  function drawRounds() {
    $('rounds').innerHTML = game.targets.map(function (t, i) {
      var r = game.results[i], cls = r ? (r.ok ? 'ok' : 'no') : (i === game.round ? 'now' : '');
      return '<span class="' + cls + '">' + FL.CLASSES[t].emoji + (r ? (r.ok ? ' ✓' : ' ✗') : '') + '</span>';
    }).join('');
  }
  function finishRound(ok, probs) {
    var t = game.targets[game.round], fb = $('feedback');
    game.results[game.round] = { ok: ok }; game.locked = true;
    if (!probs) { fb.textContent = 'تخطّيت الجولة.'; fb.className = 'feedback'; }
    else {
      var top = FL.ranking(probs)[0], T = FL.CLASSES[t];
      if (ok) { fb.textContent = 'عرفها! قال النموذج «' + T.ar + '» بثقة ' + Math.round(top.p * 100) + '%.'; fb.className = 'feedback ok'; }
      else { fb.textContent = 'خمّن «' + FL.CLASSES[top.id].ar + '» (' + Math.round(top.p * 100) + '%) بدل «' + T.ar + '» (' + Math.round(probs[t] * 100) + '%).'; fb.className = 'feedback no'; }
    }
    $('confirm').hidden = true; $('skip').hidden = true; $('next').hidden = false;
    $('next').textContent = game.round === 4 ? 'اعرض النتيجة' : 'الجولة التالية';
    drawRounds();
  }
  $('confirm').addEventListener('click', function () {
    if (!lastProbs) { FL.toast('ارسم القطعة أولاً'); return; }
    finishRound(FL.ranking(lastProbs)[0].id === game.targets[game.round], lastProbs);
  });
  $('skip').addEventListener('click', function () { finishRound(false, null); });
  $('next').addEventListener('click', function () {
    if (game.round === 4) {
      var n = game.results.filter(function (r) { return r.ok; }).length;
      $('gameBox').hidden = true; $('endBox').hidden = false; $('score').textContent = n + ' / 5';
      $('endMsg').textContent = n === 5 ? 'النموذج فهم كل رسوماتك.' : n >= 3 ? 'نتيجة جيدة. النموذج يفهم الأشكال الواضحة.' : 'النموذج تدرّب على صور حقيقية لا على رسوم. جرّب التظليل الكامل للشكل.';
      game.locked = true;
    } else { game.round++; newRound(); }
  });

  redraw();
  FL.loadModel().then(function (m) { net = m.net; schedule(); }).catch(function () { $('bars').textContent = 'تعذّر تحميل النموذج. شغّل الموقع عبر خادم.'; });
})();
