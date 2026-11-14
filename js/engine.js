/* محرك الاستدلال: يشغّل نموذج CNN المدرَّب على Fashion-MNIST بجافاسكربت خالص (بدون مكتبات)
   البنية مطابقة لدفتر التدريب:
   Conv(32,relu) → BN → MaxPool → Conv(64,relu) → BN → MaxPool → Flatten → Dense(64,relu) → BN → Dense(10,softmax)
   (طبقات Dropout تُهمل وقت الاستدلال). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { var m = factory(); root.Engine = m.Engine; root.Prep = m.Prep; }
})(typeof self !== 'undefined' ? self : this, function () {

  /* ---------- الشبكة العصبية ---------- */
  function arr(w) { return Float32Array.from(w.data); }

  function convRelu(inp, H, W, c) {
    var cin = c.cin, cout = c.cout, w = c.w, b = c.b;
    var out = new Float32Array(H * W * cout);
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var o = (y * W + x) * cout;
        for (var co = 0; co < cout; co++) out[o + co] = b[co];
        for (var ky = 0; ky < 3; ky++) {
          var yy = y + ky - 1; if (yy < 0 || yy >= H) continue;
          for (var kx = 0; kx < 3; kx++) {
            var xx = x + kx - 1; if (xx < 0 || xx >= W) continue;
            var ib = (yy * W + xx) * cin, wb0 = (ky * 3 + kx) * cin;
            for (var ci = 0; ci < cin; ci++) {
              var v = inp[ib + ci]; if (v === 0) continue;
              var wb = (wb0 + ci) * cout;
              for (var co2 = 0; co2 < cout; co2++) out[o + co2] += v * w[wb + co2];
            }
          }
        }
        for (var k = 0; k < cout; k++) if (out[o + k] < 0) out[o + k] = 0;
      }
    }
    return out;
  }

  function batchNorm(a, bn) {
    var n = bn.sc.length;
    for (var i = 0; i < a.length; i++) { var c = i % n; a[i] = a[i] * bn.sc[c] + bn.sh[c]; }
    return a;
  }

  function maxPool(inp, H, W, C) {
    var h2 = H >> 1, w2 = W >> 1, out = new Float32Array(h2 * w2 * C);
    for (var y = 0; y < h2; y++) for (var x = 0; x < w2; x++) for (var c = 0; c < C; c++) {
      var m = -Infinity;
      for (var dy = 0; dy < 2; dy++) for (var dx = 0; dx < 2; dx++) {
        var v = inp[((2 * y + dy) * W + (2 * x + dx)) * C + c]; if (v > m) m = v;
      }
      out[(y * w2 + x) * C + c] = m;
    }
    return out;
  }

  function dense(inp, d, relu) {
    var out = new Float32Array(d.nout);
    for (var j = 0; j < d.nout; j++) out[j] = d.b[j];
    for (var i = 0; i < d.nin; i++) {
      var v = inp[i]; if (v === 0) continue;
      var base = i * d.nout;
      for (var j2 = 0; j2 < d.nout; j2++) out[j2] += v * d.w[base + j2];
    }
    if (relu) for (var k = 0; k < out.length; k++) if (out[k] < 0) out[k] = 0;
    return out;
  }

  var Engine = {
    paramCount: function (model) {
      var n = 0;
      model.layers.forEach(function (l) { l.weights.forEach(function (w) { n += w.data.length; }); });
      return n;
    },
    create: function (model) {
      var L = model.layers;
      function conv(l) { return { w: arr(l.weights[0]), b: arr(l.weights[1]), cin: l.weights[0].shape[2], cout: l.weights[0].shape[3] }; }
      function bn(l) {
        var p = l.weights.map(arr), g = p[0], be = p[1], m = p[2], v = p[3];
        var sc = new Float32Array(g.length), sh = new Float32Array(g.length);
        for (var i = 0; i < g.length; i++) { sc[i] = g[i] / Math.sqrt(v[i] + l.eps); sh[i] = be[i] - m[i] * sc[i]; }
        return { sc: sc, sh: sh };
      }
      function den(l) { return { w: arr(l.weights[0]), b: arr(l.weights[1]), nin: l.weights[0].shape[0], nout: l.weights[0].shape[1] }; }
      var c1 = conv(L[0]), b1 = bn(L[1]), c2 = conv(L[2]), b2 = bn(L[3]), d1 = den(L[4]), b3 = bn(L[5]), d2 = den(L[6]);

      /* x: Float32Array(784) بقيم 0..1 (خلفية سوداء، القطعة فاتحة) → احتمالات 10 فئات */
      function predict(x) {
        var a = convRelu(x, 28, 28, c1);
        a = batchNorm(a, b1);
        a = maxPool(a, 28, 28, c1.cout);
        a = convRelu(a, 14, 14, c2);
        a = batchNorm(a, b2);
        a = maxPool(a, 14, 14, c2.cout);
        a = dense(a, d1, true);
        a = batchNorm(a, b3);
        var z = dense(a, d2, false);
        var mx = -Infinity, i;
        for (i = 0; i < z.length; i++) if (z[i] > mx) mx = z[i];
        var s = 0; for (i = 0; i < z.length; i++) { z[i] = Math.exp(z[i] - mx); s += z[i]; }
        for (i = 0; i < z.length; i++) z[i] /= s;
        return z;
      }
      return { predict: predict };
    }
  };

  /* ---------- تجهيز الصورة: تحويلها لما يشبه بيانات Fashion-MNIST ---------- */
  var Prep = {
    /* gray: Float32Array(W*H) بقيم 0..1
       mode: 'auto'  = إزالة الخلفية (يقدّر لون الخلفية من الحواف)
             'invert'= قلب الألوان (قطعة داكنة على خلفية فاتحة)
             'plain' = كما هي (رسم أبيض على أسود)
       يرجع Float32Array(784) */
    fromGray: function (gray, W, H, mode) {
      var n = W * H, d = new Float32Array(n), i;
      if (mode === 'plain') d.set(gray);
      else if (mode === 'invert') for (i = 0; i < n; i++) d[i] = 1 - gray[i];
      else {
        var ring = Math.max(2, Math.round(Math.min(W, H) * 0.03)), border = [];
        for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
          if (x < ring || y < ring || x >= W - ring || y >= H - ring) border.push(gray[y * W + x]);
        }
        border.sort(function (a, b) { return a - b; });
        var bg = border[border.length >> 1];
        for (i = 0; i < n; i++) d[i] = Math.abs(gray[i] - bg);
      }
      if (mode !== 'plain') {
        var sorted = Float32Array.from(d).sort(), p = sorted[Math.floor(0.99 * (n - 1))];
        var sc = p > 0.05 ? 1 / p : 1;
        for (i = 0; i < n; i++) d[i] = Math.min(1, d[i] * sc);
      }
      var thr = mode === 'plain' ? 0.15 : 0.3;
      var minx = W, maxx = -1, miny = H, maxy = -1, cnt = 0;
      for (var yy = 0; yy < H; yy++) for (var xx = 0; xx < W; xx++) {
        if (d[yy * W + xx] > thr) {
          cnt++;
          if (xx < minx) minx = xx; if (xx > maxx) maxx = xx;
          if (yy < miny) miny = yy; if (yy > maxy) maxy = yy;
        }
      }
      if (cnt < Math.max(12, n * 0.0008)) { minx = 0; miny = 0; maxx = W - 1; maxy = H - 1; }
      /* تعبئة داخل القطعة حتى تشبه الصور الصلبة في بيانات التدريب */
      if (mode !== 'plain') for (i = 0; i < n; i++) if (d[i] > thr && d[i] < 0.55) d[i] = 0.55;

      var bw = maxx - minx + 1, bh = maxy - miny + 1;
      var side = Math.max(bw, bh) * 1.06;
      var cx = (minx + maxx + 1) / 2, cy = (miny + maxy + 1) / 2;
      var x0 = cx - side / 2, y0 = cy - side / 2;
      var out = new Float32Array(784), S = 5;
      for (var oy = 0; oy < 28; oy++) for (var ox = 0; ox < 28; ox++) {
        var acc = 0;
        for (var sy = 0; sy < S; sy++) for (var sx = 0; sx < S; sx++) {
          var px = Math.floor(x0 + ((ox + (sx + 0.5) / S) / 28) * side);
          var py = Math.floor(y0 + ((oy + (sy + 0.5) / S) / 28) * side);
          if (px >= 0 && px < W && py >= 0 && py < H) acc += d[py * W + px];
        }
        out[oy * 28 + ox] = acc / (S * S);
      }
      return out;
    },

    /* من عنصر صورة أو كانفاس في المتصفح */
    fromImage: function (img, mode) {
      var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      var sc = Math.min(1, 200 / Math.max(w, h));
      var W = Math.max(8, Math.round(w * sc)), H = Math.max(8, Math.round(h * sc));
      var c = document.createElement('canvas'); c.width = W; c.height = H;
      var ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, W, H);
      var px = ctx.getImageData(0, 0, W, H).data, g = new Float32Array(W * H);
      for (var i = 0; i < W * H; i++) g[i] = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255;
      return Prep.fromGray(g, W, H, mode);
    }
  };

  return { Engine: Engine, Prep: Prep };
});
