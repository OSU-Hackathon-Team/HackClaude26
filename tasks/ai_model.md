# AI Model Tasks

## Iteration 1: Multimodal Fusion Plan
We will implement an "embedding-forward" architecture. The PyTorch model acts as a fixed feature extractor, which feeds into the existing XGBoost multi-site trainer.

### Detailed Steps:
1.  **Environment Sync**: Install `transformers`, `torch`, `torchvision`.
2.  **Encoder Setup**: Load `Phikon-ViT` from HuggingFace.
3.  **Data Ingestion**: 
    - Create a data-loader that maps MSK-MET `PATIENT_ID` to image patches.
    - Handle missing images by padding with "Mean Embeddings" (Average of all available embeddings).
4.  **Feature Concatenation**: Logic to merge 768-D vision features with 51-D tabular features.
5.  **Benchmarking**: Compare results to the current `global_site_report_v2.csv` baseline.

## 🤝 Interface Contract (Parallel Sync)
Refer to **`contracts.md` Section 1**.
- **Input**: Tumor image (JPG/PNG).
- **Output**: 768-D Embedding vector.
- **Agent Note**: You can build the extraction logic independently of the GraphQL/API layer by using a simple `main` test block.

### Checklist:
- [ ] Select Pre-trained Foundation Model (Phikon/UNI)
- [ ] Implement `extract_embeddings.py` script
- [ ] Pre-generate embeddings for a subset of CAMELYON slides
- [ ] Modify `train_iteration_3.py` to accept embeddings
- [ ] Retrain XGBoost models with "Visual Lift" features
- [ ] Validate site-specific Lift scores
