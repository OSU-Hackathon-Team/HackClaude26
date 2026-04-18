import pandas as pd
import numpy as np
import xgboost as xgb
import joblib
import os
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score

# Paths
INPUT_CSV = 'data/camelyon16_pseudo_labeled.csv'
MODEL_DIR = 'models'
MODEL_PATH = os.path.join(MODEL_DIR, 'vision_detector.joblib')
BACKUP_PATH = os.path.join(MODEL_DIR, 'vision_detector_old_v1.joblib')

def train_vision_model():
    print(f"Loading pseudo-labeled data from {INPUT_CSV}...")
    print(f"Loading subsample from {INPUT_CSV} for rapid validation...")
    try:
        # Load a 50k sample for speed
        df = pd.read_csv(INPUT_CSV, nrows=50000)
    except Exception as e:
        print(f"Error loading data: {e}")
        return

    print(f"Loaded {len(df)} samples.")
    
    # Identify feature columns (v_feat_0 to v_feat_767)
    feature_cols = [col for col in df.columns if col.startswith('v_feat_')]
    target_col = 'IS_TUMOR'
    
    if target_col not in df.columns:
        # Fallback check for labels
        potential_labels = ['label', 'target', 'class']
        for l in potential_labels:
            if l in df.columns:
                target_col = l
                break
    
    print(f"Target Column: {target_col}")
    print(f"Class Distribution:\n{df[target_col].value_counts()}")
    
    X = df[feature_cols].values
    y = df[target_col].values
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    # Calculate scale_pos_weight to favor Recall for class 1 (Tumor)
    # Ratio: count(negative) / count(positive)
    neg_count = np.sum(y_train == 0)
    pos_count = np.sum(y_train == 1)
    scale_weight = neg_count / pos_count
    
    # To prioritize Recall even more, we can boost the scale_weight further
    print(f"Base scale_pos_weight: {scale_weight:.2f}")
    recall_optimized_weight = scale_weight * 2.0  # Conservative boost for recall
    print(f"Recall Optimized scale_pos_weight: {recall_optimized_weight:.2f}")

    print("Training XGBoost...")
    model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=6,
        learning_rate=0.05,
        scale_pos_weight=recall_optimized_weight,
        use_label_encoder=False,
        eval_metric='logloss',
        random_state=42
    )
    
    model.fit(X_train, y_train)
    
    print("Evaluating...")
    preds = model.predict(X_test)
    probs = model.predict_proba(X_test)[:, 1]
    
    print("\nClassification Report:")
    print(classification_report(y_test, preds))
    
    print("\nConfusion Matrix:")
    print(confusion_matrix(y_test, preds))
    
    print(f"\nROC AUC Score: {roc_auc_score(y_test, probs):.4f}")
    
    # Save model
    if os.path.exists(MODEL_PATH):
        print(f"Backing up old model to {BACKUP_PATH}")
        if os.path.exists(BACKUP_PATH): os.remove(BACKUP_PATH)
        os.rename(MODEL_PATH, BACKUP_PATH)
    
    print(f"Saving new model to {MODEL_PATH}")
    joblib.dump(model, MODEL_PATH)
    print("Training Complete.")

if __name__ == "__main__":
    train_vision_model()
