import numpy as np
from sklearn.datasets import fetch_20newsgroups
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
import skl2onnx
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import StringTensorType, FloatTensorType
import onnxruntime as ort

print("Loading sentiment data...")
pos = fetch_20newsgroups(
    subset="train",
    categories=[
        "rec.autos",
        "rec.motorcycles",
        "rec.sport.baseball",
        "rec.sport.hockey",
    ],
)
neg = fetch_20newsgroups(
    subset="train",
    categories=["sci.electronics", "sci.med", "sci.space", "talk.politics.guns"],
)

X_pos = pos.data
X_neg = neg.data
y_pos = np.ones(len(X_pos))
y_neg = np.zeros(len(X_neg))

X_all = X_pos + X_neg
y_all = np.concatenate([y_pos, y_neg])

X_train, X_test, y_train, y_test = train_test_split(
    X_all, y_all, test_size=0.2, random_state=42
)

print("Training sentiment classifier...")
pipe = Pipeline(
    [
        ("tfidf", TfidfVectorizer(max_features=5000, stop_words="english")),
        ("clf", LogisticRegression(max_iter=200, random_state=42)),
    ]
)
pipe.fit(X_train, y_train)

acc = accuracy_score(y_test, pipe.predict(X_test))
print(f"Test accuracy: {acc:.4f}")

initial_type = [("text_input", StringTensorType([None, 1]))]
try:
    onnx_model = convert_sklearn(pipe, initial_types=initial_type, target_opset=12)
    model_path = "models/sentiment.onnx"
    with open(model_path, "wb") as f:
        f.write(onnx_model.SerializeToString())
    print(f"Saved to {model_path}")

    sess = ort.InferenceSession(model_path)
    sample = np.array([["This car is amazing and fast"]])
    result = sess.run(None, {"text_input": sample})
    print(
        f"Verification: positive={result[0][0][0]:.4f}, predicted={'positive' if result[1][0] == 1 else 'negative'}"
    )
except Exception as e:
    print(f"ONNX conversion failed for text pipeline: {e}")
    print("Falling back to numeric feature model...")

    vec = TfidfVectorizer(max_features=5000, stop_words="english")
    X_train_vec = vec.fit_transform(X_train)
    X_test_vec = vec.transform(X_test)

    clf2 = LogisticRegression(max_iter=200, random_state=42)
    clf2.fit(X_train_vec.toarray(), y_train)

    acc2 = accuracy_score(y_test, clf2.predict(X_test_vec.toarray()))
    print(f"Numeric model accuracy: {acc2:.4f}")

    initial_type2 = [("float_input", FloatTensorType([None, 5000]))]
    onnx_model2 = convert_sklearn(clf2, initial_types=initial_type2, target_opset=12)
    model_path2 = "models/sentiment.onnx"
    with open(model_path2, "wb") as f:
        f.write(onnx_model2.SerializeToString())
    print(f"Saved fallback to {model_path2}")
