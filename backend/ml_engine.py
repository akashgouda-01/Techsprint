import sys
import json
import math
import os
import pickle
from datetime import datetime

# Define model path
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'safety_model.pkl')
DATA_PATH = os.path.join(os.path.dirname(__file__), 'training_data.json')

# --- Custom Logistic Regression Implementation ---
class CustomLogisticRegression:
    def __init__(self, learning_rate=0.1, n_iterations=1000):
        self.learning_rate = learning_rate
        self.n_iterations = n_iterations
        self.weights = []
        self.bias = 0

    def sigmoid(self, z):
        # Clip z to avoid overflow
        z = max(-200, min(200, z))
        return 1 / (1 + math.exp(-z))

    def fit(self, X, y):
        n_samples = len(X)
        if n_samples == 0:
            return
            
        n_features = len(X[0])
        self.weights = [0.0] * n_features
        self.bias = 0

        for _ in range(self.n_iterations):
            for i in range(n_samples):
                # Linear prediction z = w*x + b
                z = sum(w * x for w, x in zip(self.weights, X[i])) + self.bias
                y_pred = self.sigmoid(z)

                # Gradient Calculation
                error = y_pred - y[i]
                
                # Update weights
                for j in range(n_features):
                    self.weights[j] -= self.learning_rate * error * X[i][j]
                
                self.bias -= self.learning_rate * error

    def predict_proba(self, X):
        predictions = []
        for row in X:
            z = sum(w * x for w, x in zip(self.weights, row)) + self.bias
            prob_safe = self.sigmoid(z)
            # Return [prob_unsafe, prob_safe]
            predictions.append([1 - prob_safe, prob_safe])
        return predictions

# --- Feature Engineering ---

def encode_features(context):
    # Context expected: { lighting, activity, timestamp/time }
    
    # Lighting
    l_map = {'well-lit': 1.0, 'partial': 0.5, 'poor': 0.0}
    lighting = l_map.get(context.get('lighting', 'unknown'), 0.5)

    # Activity
    a_map = {'busy': 1.0, 'moderate': 0.5, 'isolated': 0.0}
    activity = a_map.get(context.get('activity', 'unknown'), 0.5)

    # Time (parse ISO string or hour)
    time_val = 0.5
    ts = context.get('timestamp')
    if ts:
        try:
            if 'T' in str(ts):
                dt = datetime.fromisoformat(str(ts).replace('Z', '+00:00'))
                hour = dt.hour
            else:
                hour = 12 
                
            if 6 <= hour < 18: time_val = 1.0     # Day
            elif 18 <= hour < 22: time_val = 0.5  # Evening
            else: time_val = 0.0                  # Night
        except:
            pass
            
    return [lighting, activity, time_val]

# --- Data Management ---

def get_initial_data():
    return [
        {"features": [1.0, 1.0, 1.0], "label": 1}, # Perfect conditions -> Safe
        {"features": [0.0, 0.0, 0.0], "label": 0}, # Worst conditions -> Unsafe
        {"features": [0.5, 0.5, 0.5], "label": 1}, # Average -> Safe
        {"features": [0.0, 1.0, 0.0], "label": 1}, # Busy but dark -> Safe
        {"features": [1.0, 0.0, 0.0], "label": 0}, # Well lit but isolated -> Unsafe
    ]

def load_data():
    if os.path.exists(DATA_PATH):
        with open(DATA_PATH, 'r') as f:
            return json.load(f)
    else:
        data = get_initial_data()
        with open(DATA_PATH, 'w') as f:
            json.dump(data, f)
        return data

def train_and_save():
    data = load_data()
    X = [d['features'] for d in data]
    y = [d['label'] for d in data]
    
    # Ensure class diversity for stability
    if len(set(y)) < 2:
        y.append(0 if y[0] == 1 else 1)
        X.append([0.5, 0.5, 0.5])

    model = CustomLogisticRegression()
    model.fit(X, y)
    
    with open(MODEL_PATH, 'wb') as f:
        pickle.dump(model, f)
    
    return model

def load_model():
    if not os.path.exists(MODEL_PATH):
        return train_and_save()
    try:
        with open(MODEL_PATH, 'rb') as f:
            return pickle.load(f)
    except:
        return train_and_save()

# --- Main Logic ---

def predict_risk(context):
    features = encode_features(context)
    model = load_model()
    # prob_safe is index 1
    prob_safe = model.predict_proba([features])[0][1]
    return prob_safe * 100

if __name__ == "__main__":
    try:
        # Read from stdin
        input_str = sys.stdin.read()
        if not input_str:
            sys.exit(0)
            
        request = json.loads(input_str)
        command = request.get('command')
        
        if command == 'predict':
            segments = request.get('segments', [])
            results = []
            for seg in segments:
                context = seg.get('context', {})
                score = predict_risk(context)
                results.append({
                    "segment_index": seg.get('index'),
                    "safety_score": float(f"{score:.2f}") 
                })
            print(json.dumps({"results": results}))
            
        elif command == 'train':
            points = request.get('data_points', [])
            data = load_data()
            new_count = 0
            
            for pt in points:
                # 1 (Safe) to 10 (Unsafe)
                safety_rating = pt.get('safetyRating', 5)
                # Label: 1 = Safe, 0 = Unsafe
                label = 1 if safety_rating <= 4 else 0
                
                features = encode_features(pt.get('context', {}))
                
                data.append({
                    "features": features,
                    "label": label,
                    "meta": { "origin": pt.get("origin"), "dest": pt.get("destination") }
                })
                new_count += 1
                
            with open(DATA_PATH, 'w') as f:
                json.dump(data, f)
            
            train_and_save()
            print(json.dumps({"status": "trained", "new_samples": new_count}))
                
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
