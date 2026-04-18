import os

target = 'data/camelyon16_features.csv'
chunk_size = 1024 * 1024
total = 0

with open(target, 'rb') as f:
    while True:
        chunk = f.read(chunk_size)
        if not chunk:
            break
        if b'IS_TUMOR' in chunk:
            print(f"Found 'IS_TUMOR' at {total/1e6:.1f} MB")
        total += len(chunk)

print("Scan complete.")
