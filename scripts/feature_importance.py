import pandas as pd
import numpy as np
import xgboost as xgb
import matplotlib.pyplot as plt
from sklearn.preprocessing import OneHotEncoder, StandardScaler
import os

# Configuration (same as training script)
DATA_PATH = r'c:\Users\pohfe\OneDrive - The Ohio State University\Desktop\Coding Projects\CancerPrediction\data\data_clean.tsv'
FEATURE_COLS = ['AGE_AT_SEQUENCING', 'SEX', 'PRIMARY_SITE', 'ONCOTREE_CODE']
TARGET_SITE = 'DMETS_DX_LIVER' # Analyze one representative site

def analyze_importance():
    print(f"🧐 Analyzing Feature Importance for: {TARGET_SITE}")
    df = pd.read_csv(DATA_PATH, sep='\t')
    
    # Preprocess
    df[TARGET_SITE] = df[TARGET_SITE].map({'Yes': 1, 'No': 0}).fillna(0).astype(int)
    df['AGE_AT_SEQUENCING'] = df.groupby('ONCOTREE_CODE')['AGE_AT_SEQUENCING'].transform(lambda x: x.fillna(x.median()))
    df['SEX'] = df['SEX'].fillna(df['SEX'].mode()[0])
    df['PRIMARY_SITE'] = df['PRIMARY_SITE'].fillna('Unknown')
    
    X_raw = df[FEATURE_COLS]
    y = df[TARGET_SITE]
    
    # Encoding
    cat_feats = ['SEX', 'PRIMARY_SITE', 'ONCOTREE_CODE']
    encoder = OneHotEncoder(sparse_output=False, handle_unknown='ignore')
    scaler = StandardScaler()
    
    X_cat = encoder.fit_transform(X_raw[cat_feats])
    X_num = scaler.fit_transform(X_raw[['AGE_AT_SEQUENCING']])
    
    # Get feature names for clarity
    feature_names = ['Age'] + list(encoder.get_feature_names_out(cat_feats))
    X = np.hstack([X_num, X_cat])
    
    # Train a single model on all data for importance extraction
    model = xgb.XGBClassifier(n_estimators=100, max_depth=4, learning_rate=0.1, random_state=42)
    model.fit(X, y)
    
    # Extract Importance
    # Intern: These numbers (0.145, 0.119, etc.) represent 'Gini Importance' or 'Gain'.
    # Think of it as a pie chart of 1.0 (100%). If a feature has 0.14, it means 
    # that feature was responsible for 14% of the model's 'cleverness' in 
    # separating patients who got Liver metastasis from those who didn't.
    importances = model.feature_importances_
    results = pd.DataFrame({'Feature': feature_names, 'Importance': importances})
    
    # Sort by highest importance first
    results = results.sort_values(by='Importance', ascending=False).head(10)
    
    print("\n--- Top 10 Clinical Predictors for Liver Metastasis ---")
    print(results.to_string(index=False))
    
    print("\n💡 Intern, look at the results. 'Site' and 'Onco' (The Origin) usually dominate,")
    print("but check where 'Age' sits in the ranking!")

if __name__ == "__main__":
    analyze_importance()
