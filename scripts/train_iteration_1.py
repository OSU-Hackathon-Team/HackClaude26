import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.metrics import roc_auc_score, brier_score_loss
import joblib
import os

# --- Lead Engineer's Configuration ---
# Target file: data_clean.tsv (The unified clinical record we merged from the .gz archive)
DATA_PATH = r'c:\Users\pohfe\OneDrive - The Ohio State University\Desktop\Coding Projects\CancerPrediction\data\data_clean.tsv'

# We are focusing on the Top 5 metastatic "destinations" for our baseline.
TARGET_SITES = [
    'DMETS_DX_LIVER', 
    'DMETS_DX_LUNG', 
    'DMETS_DX_BONE', 
    'DMETS_DX_CNS_BRAIN', 
    'DMETS_DX_ADRENAL_GLAND'
]

# Clinical features (The "Soil") - Age, Sex, and where the tumor started.
FEATURE_COLS = ['AGE_AT_SEQUENCING', 'SEX', 'PRIMARY_SITE', 'ONCOTREE_CODE']

def load_and_preprocess():
    """
    Intern: This is where we clean the 'Soil' data. Clinical data is messy,
    so we have to handle missing values and convert text labels into numbers
    that the XGBoost 'interns' can understand.
    """
    print("🚀 Loading data...")
    df = pd.read_csv(DATA_PATH, sep='\t')
    
    # 1. Target Transformation: Convert "Yes"/"No" strings to 1/0 integers.
    # Machine Learning models need numbers, not words.
    for col in TARGET_SITES:
        df[col] = df[col].map({'Yes': 1, 'No': 0}).fillna(0).astype(int)
    
    # 2. Imputation: Handling Missing Data
    # Pro-Tip: We use 'transform' with 'median' so a missing age is filled with 
    # the median age for THAT specific cancer type (e.g., fill LUAD missing age with LUAD median).
    df['AGE_AT_SEQUENCING'] = df.groupby('ONCOTREE_CODE')['AGE_AT_SEQUENCING'].transform(lambda x: x.fillna(x.median()))
    df['SEX'] = df['SEX'].fillna(df['SEX'].mode()[0])
    df['PRIMARY_SITE'] = df['PRIMARY_SITE'].fillna('Unknown')
    
    # 3. Splitting Features (X) and Labels (Y)
    X_raw = df[FEATURE_COLS]
    Y = df[TARGET_SITES]
    
    # 4. Feature Encoding: 'One-Hot' converts categories (like Sex) into binary columns.
    # Standard Scaling ensures 'Age' (0-100) doesn't over-influence the model compared to flags.
    cat_cols = ['SEX', 'PRIMARY_SITE', 'ONCOTREE_CODE']
    num_cols = ['AGE_AT_SEQUENCING']
    
    encoder = OneHotEncoder(sparse_output=False, handle_unknown='ignore')
    scaler = StandardScaler()
    
    X_cat = encoder.fit_transform(X_raw[cat_cols])
    X_num = scaler.fit_transform(X_raw[num_cols])
    
    # Combine the numeric and categorical columns back together.
    X = np.hstack([X_num, X_cat])
    
    print(f"✅ Preprocessing complete. Feature space: {X.shape[1]} columns.")
    return X, Y, encoder, scaler

def train_and_eval(X, Y):
    """
    Intern: This is the 'Battlefield.' We use 5-Fold Stratified Cross-Validation.
    This means we split the data 5 times, making sure each piece has a fair
    distribution of 'Yes' and 'No' cases. No cheating!
    """
    print("\n--- Starting 5-Fold Stratified Cross-Validation ---")
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    
    results = {site: [] for site in TARGET_SITES}
    
    # We evaluate each metastatic site individually.
    for site in TARGET_SITES:
        print(f"\nEvaluating Target: {site}")
        y_site = Y[site]
        
        # If an organ only has 2-3 cases, the AI can't learn anything useful.
        if y_site.sum() < 10:
            print(f"⚠️ Skipping {site} due to insufficient positive cases.")
            continue
            
        fold = 1
        for train_idx, val_idx in skf.split(X, y_site):
            X_train, X_val = X[train_idx], X[val_idx]
            y_train, y_val = y_site.iloc[train_idx], y_site.iloc[val_idx]
            
            # The XGBoost Engine: A team of 100 'interns' correcting each other's errors.
            model = xgb.XGBClassifier(
                n_estimators=100,
                max_depth=4, # Shallow trees to avoid 'memorizing' (overfitting).
                learning_rate=0.1,
                eval_metric='logloss',
                random_state=42,
                # scale_pos_weight is CRITICAL: It tells the model that 'Yes' cases 
                # are much more important than the millions of 'No' cases.
                scale_pos_weight=(len(y_train) - y_train.sum()) / y_train.sum()
            )
            
            model.fit(X_train, y_train)
            
            # predict_proba gives us that 0.0 to 1.0 probability 'Risk Score'.
            probs = model.predict_proba(X_val)[:, 1]
            
            # AUC-ROC: Our primary score. Closer to 1.0 means the AI is a genius.
            # Brier Score: Measures how 'confident' the AI is. Lower is better.
            auc = roc_auc_score(y_val, probs)
            brier = brier_score_loss(y_val, probs)
            
            results[site].append({'auc': auc, 'brier': brier})
            print(f"  Fold {fold}: AUC={auc:.4f}, Brier={brier:.4f}")
            fold += 1
            
        # The Final Report Card for this organ.
        avg_auc = np.mean([r['auc'] for r in results[site]])
        print(f"✨ Mean AUC for {site}: {avg_auc:.4f}")

    return results

if __name__ == "__main__":
    X, Y, encoder, scaler = load_and_preprocess()
    results = train_and_eval(X, Y)
    
    print("\n🚀 Training final model on all data for export...")
    # Intern: Next step is to save the 'encoder' and 'model' using joblib 
    # so we can use them in the FastAPI sandbox later!
    
    print("\n✅ Iteration One Execution Complete.")
