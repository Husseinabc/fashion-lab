# تصدير نموذج Keras إلى JSON يقرؤه المتصفح (شُغّل في Google Colab)
import json, numpy as np, keras

model = keras.models.load_model('fashion_mnist_cnn_model.keras')
(_, _), (x_test, y_test) = keras.datasets.fashion_mnist.load_data()
x = (x_test / 255.0).reshape(-1, 28, 28, 1)
pred = model.predict(x, verbose=0).argmax(1)

layers = []
for l in model.layers:
    ws = l.get_weights()
    if not ws:
        continue                      # Dropout / MaxPool / Flatten بلا أوزان
    layers.append({
        "type": l.__class__.__name__,
        "eps": float(getattr(l, "epsilon", 0)),
        "weights": [{"shape": list(a.shape), "data": np.round(a, 5).flatten().tolist()} for a in ws],
    })

cm = np.zeros((10, 10), int)
for t, p in zip(y_test, pred):
    cm[t, p] += 1

samples = []
for c in range(10):                    # 20 صورة اختبار لكل فئة
    for i in np.where(y_test == c)[0][:20]:
        samples.append({"img": x_test[i].flatten().tolist(), "label": int(y_test[i]), "pred": int(pred[i])})

json.dump({"layers": layers, "accuracy": float((pred == y_test).mean()),
           "confusion": cm.tolist(), "samples": samples}, open("model_export.json", "w"))
