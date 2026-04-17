"""
================================================================================
FILE: app_frontend.py
ROLE: The Visual HUD (Heads-Up Display)
PURPOSE: This is the professional "Face" of OncoPath. It replaces the CLI 
         with a beautiful, interactive dashboard where users can simulate 
         patients and visualize risk across the whole body.
         
LEARNING POINTS:
- STREAMLIT: A powerful tool for turning Python scripts into web apps in minutes.
- INTERACTIVITY: By linking the sidebar to our FastAPI backend, we create 
  a "Closed Loop" between the user's curiosity and our AI's knowledge.
- REGIONAL MAPPING: Grouping 21 sites into 4 regions (Head, Chest, etc.) 
  makes complex data digestible for clinicians.
================================================================================
"""

import streamlit as st
import requests
import pandas as pd
import plotly.express as px
import json
import os
from pathlib import Path
from urllib.parse import urljoin

# --- PAGE CONFIG ---
st.set_page_config(page_title="OncoPath | Metastatic HUD", page_icon="🌡️", layout="wide")

PROJECT_ROOT = Path(__file__).resolve().parents[1]
API_BASE_URL = os.getenv("ONCOPATH_API_BASE_URL", "http://127.0.0.1:8000").rstrip("/") + "/"
API_URL = urljoin(API_BASE_URL, "simulate")
ANATOMY_PATH = PROJECT_ROOT / "data" / "anatomy_mapping.json"

# --- LOAD ASSETS ---
@st.cache_data
def load_anatomy():
    with open(ANATOMY_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

anatomy_map = load_anatomy()

# --- SIDEBAR: PATIENT INPUT ---
st.sidebar.header("👤 Patient Profile")
age = st.sidebar.slider("Age at Sequencing", 18, 90, 65)
sex = st.sidebar.selectbox("Sex", ["Male", "Female"])
primary_site = st.sidebar.text_input("Primary Site (e.g., Lung, Breast)", "Lung")
onco_code = st.sidebar.text_input("OncoTree Code (e.g., LUAD, BRCA)", "LUAD")

st.sidebar.markdown("---")
st.sidebar.header("🧬 Genomic Lab")

# We know we trained on Top 100, but for the UI let's show the Big 5 + others
important_genes = ["TP53", "KRAS", "APC", "PIK3CA", "ARID1A", "FGA"]
genomic_state = {}

with st.sidebar.expander("Superstar Genes", expanded=True):
    for gene in important_genes:
        genomic_state[gene] = st.checkbox(gene, value=False)

with st.sidebar.expander("Other Mutations"):
    # Mocking a subset for UI simplicity - in a real app we'd load all 100
    other_genes = ["PTEN", "EGFR", "KMT2D", "ATM", "RB1"]
    for gene in other_genes:
        genomic_state[gene] = st.checkbox(gene, value=False)

# --- MAIN HUD ---
st.title("🌡️ OncoPath | Metastatic Risk HUD")
st.markdown(f"**Current Simulation:** {age}yo {sex} | Primary: **{primary_site}** ({onco_code})")

# Prepare Payload
payload = {
    "age": age,
    "sex": sex,
    "primary_site": primary_site,
    "oncotree_code": onco_code,
    "mutations": {g: (1 if v else 0) for g, v in genomic_state.items()}
}

# --- TRIGGER SIMULATION ---
try:
    response = requests.post(API_URL, json=payload)
    if response.status_code == 200:
        data = response.json()
        risks = data['simulated_risks']
        
        # --- DATA PROCESSING ---
        df_plot = []
        for site, prob in risks.items():
            meta = anatomy_map.get(site, {"label": site, "region": "Other", "system": "Other"})
            df_plot.append({
                "Site": meta['label'],
                "Region": meta['region'],
                "Risk": prob * 100,
                "Raw": site
            })
        
        df = pd.DataFrame(df_plot).sort_values(by="Risk", ascending=True)

        # --- VISUALIZATION ---
        col1, col2 = st.columns([2, 1])
        
        with col1:
            st.subheader("Full Body Metastatic Heatmap")
            fig = px.bar(
                df, 
                x="Risk", 
                y="Site", 
                color="Risk",
                color_continuous_scale="RdYlGn_r",
                orientation='h',
                range_x=[0, 100],
                labels={"Risk": "Likelihood (%)", "Site": "Organ/Site"},
                hover_data=["Region"]
            )
            fig.update_layout(height=600, margin=dict(l=0, r=0, t=0, b=0))
            st.plotly_chart(fig, use_container_width=True)

        with col2:
            st.subheader("🦴 Regional Summary")
            regional_max = df.groupby("Region")["Risk"].max().reset_index()
            # Rename for clarity
            regional_max.columns = ["Body Region", "Highest Risk (%)"]
            st.table(regional_max)
            
            st.info("""
            **How to read this:**
            - 🔴 **High Risk (>70%):** Immediate monitoring suggested.
            - 🟡 **Moderate Risk (40-70%):** Secondary priority for screening.
            - 🟢 **Low Risk (<40%):** Standard follow-up protocol.
            """)

    else:
        st.error(f"❌ API Error: {response.text}")
except Exception as e:
    st.warning("⚠️ **Connection Pending:** Is the FastAPI backend running?")
    st.code("python scripts/api_service.py", language="bash")
    st.info("Start the backend in another terminal to activate this HUD.")

st.markdown("---")
st.caption("© 2024 JassehXia/CancerPrediction | For Research Use Only | MSK-MET Multi-Omic Cohort")
