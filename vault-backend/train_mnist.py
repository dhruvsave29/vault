import numpy as np
from sklearn.datasets import fetch_openml
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import accuracy_score
import skl2onnx
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType
import onnxruntime as ort

print("Loading MNIST...")
mnist = fetch_openml("mnist_784", version=1, as_frame=False)
X, y = mnist.data / 255.0, mnist.target.astype(int)

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=10000, random_state=42
)

print("Training MLPClassifier...")
clf = MLPClassifier(
    hidden_layer_sizes=(128, 64), max_iter=30, random_state=42, verbose=True
)
clf.fit(X_train, y_train)

acc = accuracy_score(y_test, clf.predict(X_test))
print(f"Test accuracy: {acc:.4f}")

initial_type = [("float_input", FloatTensorType([None, 784]))]
onnx_model = convert_sklearn(clf, initial_types=initial_type, target_opset=12)

model_path = "models/mnist.onnx"
with open(model_path, "wb") as f:
    f.write(onnx_model.SerializeToString())
print(f"Saved to {model_path}")

sess = ort.InferenceSession(model_path)
sample = X_test[:1].astype(np.float32)
result = sess.run(None, {"float_input": sample})
flat = result[0].flatten()
pred = int(np.argmax(flat))
print(
    f"Verification: predicted={pred}, actual={y_test[0]}, confidence={flat[pred]:.4f}"
)
