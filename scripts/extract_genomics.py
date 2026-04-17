import tarfile
import pandas as pd
import os

# Configuration
DATA_PATH = r'c:\Users\pohfe\OneDrive - The Ohio State University\Desktop\Coding Projects\CancerPrediction\data\data.gz'
OUTPUT_PATH = r'c:\Users\pohfe\OneDrive - The Ohio State University\Desktop\Coding Projects\CancerPrediction\data\mutation_matrix.tsv'

# Top 8 "Seed" Genes to extract
TARGET_GENES = ['TP53', 'KRAS', 'PIK3CA', 'EGFR', 'APC', 'PTEN', 'AR', 'BRAF']

def extract_mutation_matrix():
    print(f"🧬 Opening archive: {os.path.basename(DATA_PATH)}...")
    
    try:
        with tarfile.open(DATA_PATH, "r:gz") as tar:
            # Find the mutation file
            mutation_file = next((m for m in tar.getnames() if 'data_mutations.txt' in m), None)
            if not mutation_file:
                print("❌ Could not find 'data_mutations.txt' in archive.")
                return

            print(f"📂 Extracting mutations from: {mutation_file}...")
            f = tar.extractfile(mutation_file)
            
            # Read relevant columns only to save memory
            # Hugo_Symbol: The gene name
            # Tumor_Sample_Barcode: The Sample ID
            cols_to_use = ['Hugo_Symbol', 'Tumor_Sample_Barcode']
            
            # Using chunking if the file is massive, but 76MB is small enough for pandas
            df_mut = pd.read_csv(f, sep='\t', comment='#', usecols=cols_to_use)
            
            print(f"✅ Loaded {len(df_mut)} raw mutation records.")

            # Filter for target genes
            df_target = df_mut[df_mut['Hugo_Symbol'].isin(TARGET_GENES)].copy()
            print(f"🎯 Found {len(df_target)} mutations in target genes.")

            # Create binary matrix (Sample x Gene)
            # 1 if mutated, 0 if not
            print("🧱 Building pivot matrix...")
            matrix = pd.crosstab(df_target['Tumor_Sample_Barcode'], df_target['Hugo_Symbol'])
            
            # Ensure all target genes are present in columns (even if 0 mutations found)
            for gene in TARGET_GENES:
                if gene not in matrix.columns:
                    matrix[gene] = 0
            
            # Binarize (in case of multiple mutations in same gene for same sample)
            matrix = (matrix > 0).astype(int)
            
            # Rename index for consistency with clinical data
            matrix.index.name = 'SAMPLE_ID'
            
            # Save matrix
            os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
            matrix.to_csv(OUTPUT_PATH, sep='\t')
            print(f"🚀 Success! Mutation matrix saved to: {OUTPUT_PATH}")
            print(f"   Matrix Shape: {matrix.shape[0]} samples x {matrix.shape[1]} genes.")

    except Exception as e:
        print(f"❌ Error during extraction: {e}")

if __name__ == "__main__":
    extract_mutation_matrix()
