import pandas as pd
import os
import csv

input_path = 'data/camelyon16_features.csv'
output_path = 'data/camelyon16_features_full_cleaned.csv'

def clean_csv(in_path, out_path):
    print(f"Cleaning {in_path}...")
    import sys
    # Increase CSV field limit for large/malformed lines
    csv.field_size_limit(10 * 1024 * 1024) 
    
    valid_count = 0
    bad_count = 0
    file_size = os.path.getsize(in_path)
    
    import re
    float_pattern = re.compile(r'[-+]?\d*\.\d+(?:[eE][-+]?\d+)?|\d+')
    
    with open(in_path, 'rb') as f_in, open(out_path, 'w', encoding='utf-8', newline='') as f_out:
        writer = csv.writer(f_out)
        header_found = False
        expected_fields = 770 # Default based on research
        current_row_data = []
        
        # Read first line for header
        first_line = f_in.readline().decode('utf-8', errors='ignore')
        header = next(csv.reader([first_line]))
        writer.writerow(header)
        expected_fields = len(header)
        print(f"Header written with {expected_fields} fields.")

        # Now stream the rest and collect rows
        buffer = b""
        while True:
            chunk = f_in.read(1024 * 1024)
            if not chunk:
                break
            
            buffer += chunk
            lines = buffer.split(b'\n')
            buffer = lines.pop()
            
            for line in lines:
                cleaned = line.replace(b'\x00', b'').replace(b'\x1a', b'').strip()
                if not cleaned:
                    continue
                
                # Try splitting by comma first, then whitespace
                decoded = cleaned.decode('utf-8', errors='ignore')
                cells = next(csv.reader([decoded]))
                if len(cells) < expected_fields:
                    cells = decoded.split() # Try space split
                
                if len(cells) == expected_fields:
                    writer.writerow(cells)
                    valid_count += 1
                elif len(cells) > expected_fields:
                    # Possibly an extra index or malformed part, truncate to end
                    writer.writerow(cells[:expected_fields])
                    valid_count += 1
                
                if valid_count % 10000 == 0 and valid_count > 0:
                    print(f"Extracted {valid_count} valid rows... (Pos: {f_in.tell()/1e6:.1f}MB)")

    print(f"Finished Cleaning.")
    print(f"Total Valid: {valid_count}")
    print(f"Total Bad: {bad_count}")

if __name__ == "__main__":
    clean_csv(input_path, output_path)
