"""
================================================================================
FILE: extract_genomics_v2.py
ROLE: High-Resolution Genomic Extractor
PURPOSE: This script automates the discovery of the Top 50 most frequent 
         mutations in the MSK-MET dataset and extracts them into a binary matrix.
         
LEARNING POINTS:
- AUTOMATION: Instead of hardcoding 8 genes, we are now letting the data 
  tell us which genes are the most common "Seeds."
- FEATURE SCALING: We are jumping from 8 features to 50, which increases 
  the model's "Resolution" but also increases the risk of "Noise."
================================================================================
"""

import tarfile
import pandas as pd
import os

# Configuration
DATA_PATH = r'c:\Users\pohfe\OneDrive - The Ohio State University\Desktop\Coding Projects\CancerPrediction\data\data.gz'
OUTPUT_PATH = r'c:\Users\pohfe\OneDrive - The Ohio State University\Desktop\Coding Projects\CancerPrediction\data\mutation_matrix.tsv'
TOP_N = 100 # Doubling our genomic signal to find more "Lift"
def extract_top_50_matrix():
    print(f"🧬 Opening archive: {os.path.basename(DATA_PATH)}...")
    
    try:
        with tarfile.open(DATA_PATH, "r:gz") as tar:
            mutation_file = next((m for m in tar.getnames() if 'data_mutations.txt' in m), None)
            if not mutation_file:
                print("❌ Could not find 'data_mutations.txt' in archive.")
                return

            print(f"📂 Scanning mutations for frequency counts...")
            f = tar.extractfile(mutation_file)
            
            # Use chunks if memory is an issue, but for 76MB we can load Hugo_Symbol
            df_symbols = pd.read_csv(f, sep='\t', comment='#', usecols=['Hugo_Symbol', 'Tumor_Sample_Barcode'])
            
            # Find Top Genes
            top_genes = df_symbols['Hugo_Symbol'].value_counts().head(TOP_N).index.tolist()
            print(f"✅ Top 5 genes found: {top_genes[:5]}... and {len(top_genes)-5} more.")

            # Filter for these Top Genes
            df_target = df_symbols[df_symbols['Hugo_Symbol'].isin(top_genes)].copy()
            print(f"🎯 Total target gene mutations identified: {len(df_target)}")

            # Create binary matrix (Sample x Gene)
            print("🧱 Building high-resolution pivot matrix...")
            matrix = pd.crosstab(df_target['Tumor_Sample_Barcode'], df_target['Hugo_Symbol'])
            
            # Ensure all genes are present in columns
            for gene in top_genes:
                if gene not in matrix.columns:
                    matrix[gene] = 0
            
            # Binarize
            matrix = (matrix > 0).astype(int)
            matrix.index.name = 'SAMPLE_ID'
            
            # Save matrix
            os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
            matrix.to_csv(OUTPUT_PATH, sep='\t')
            print(f"🚀 Success! High-res matrix saved to: {OUTPUT_PATH}")
            print(f"   Matrix Shape: {matrix.shape[0]} samples x {matrix.shape[1]} genes.")

    except Exception as e:
        print(f"❌ Error during extraction: {e}")

if __name__ == "__main__":
    extract_top_50_matrix()
