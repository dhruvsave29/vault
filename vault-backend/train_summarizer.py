import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
import skl2onnx
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType
import onnxruntime as ort

print("Building summarizer (extractive sentence scorer)...")

texts = [
    "Machine learning is transforming healthcare. Doctors use AI to diagnose diseases. Patient outcomes have improved significantly. Research continues to advance rapidly. New treatments are being discovered. The future of medicine looks promising with AI assistance.",
    "Climate change affects global weather patterns. Temperatures are rising worldwide. Ice caps are melting at alarming rates. Sea levels threaten coastal cities. Renewable energy adoption is growing. International agreements aim to reduce emissions.",
    "The tech industry is booming. Startups raise billions in funding. Innovation drives economic growth. Software engineers are in high demand. Remote work has become the norm. Artificial intelligence shapes the next wave of products.",
    "Education systems are evolving. Online learning platforms grow rapidly. Students access courses worldwide. Teachers adapt to digital tools. Personalized learning improves outcomes. Technology bridges the education gap.",
    "Space exploration reaches new milestones. Rockets land autonomously. Mars missions are planned. Satellites provide global internet. Space tourism becomes reality. Scientific discoveries expand our understanding of the universe.",
]

important_sentences = []
unimportant_sentences = []

for text in texts:
    sentences = [s.strip() for s in text.split(".") if s.strip()]
    for i, sent in enumerate(sentences):
        if i == 0 or i == len(sentences) - 1:
            important_sentences.append(sent)
        else:
            unimportant_sentences.append(sent)

X_all = important_sentences + unimportant_sentences
y_all = np.concatenate(
    [np.ones(len(important_sentences)), np.zeros(len(unimportant_sentences))]
)

vec = TfidfVectorizer(max_features=3000, stop_words="english")
X_vec = vec.fit_transform(X_all)
n_features = X_vec.shape[1]

clf = LogisticRegression(max_iter=200, random_state=42)
clf.fit(X_vec.toarray(), y_all)

acc = accuracy_score(y_all, clf.predict(X_vec.toarray()))
print(f"Training accuracy: {acc:.4f}")

initial_type = [("float_input", FloatTensorType([None, n_features]))]
onnx_model = convert_sklearn(clf, initial_types=initial_type, target_opset=12)

model_path = "models/summarizer.onnx"
with open(model_path, "wb") as f:
    f.write(onnx_model.SerializeToString())
print(f"Saved to {model_path}")

sess = ort.InferenceSession(model_path)
sample = X_vec[:1].toarray().astype(np.float32)
result = sess.run(None, {"float_input": sample})
print(
    f"Verification: score={result[0][0][0]:.4f}, predicted={'important' if result[1][0] == 1 else 'unimportant'}"
)
