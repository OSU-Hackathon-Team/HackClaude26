import json
import os

metadata_path = "files/derivative/human_body_metadata.json"
output_path = "human_anatomy.obj"

print(f"Loading metadata from {metadata_path}...")
with open(metadata_path, 'r') as f:
    metadata = json.load(f)

# Track global offsets for OBJ
v_offset = 0
vn_offset = 0

# Group JSONs by RegionPath
regions = {}
for item in metadata:
    region = item.get("RegionPath", "Unknown")
    url = None
    if "LOD" in item and "Levels" in item["LOD"] and "medium" in item["LOD"]["Levels"]:
        url = item["LOD"]["Levels"]["medium"]["URL"]
    elif "URL" in item:
        url = item["URL"]
        
    if url:
        if region not in regions:
            regions[region] = []
        regions[region].append({
            "url": os.path.join("files/derivative", url),
            "group": item.get("GroupName", "Group")
        })

print(f"Found {len(regions)} regions.")

with open(output_path, 'w') as out:
    out.write("# Exported Human Anatomy 3D Model\n")
    
    # Process each region
    for region, entries in regions.items():
        # Keep region names simple for obj groups
        clean_region = region.replace(' ', '_').replace('/', '_')
        print(f"Processing region: {clean_region} ({len(entries)} items)")
        out.write(f"\no {clean_region}\n")
        out.write(f"g {clean_region}\n")
        
        for entry in entries:
            path = entry["url"]
            if not os.path.exists(path):
                print(f"  Warning: File missing {path}")
                continue
                
            try:
                with open(path, 'r') as f:
                    mesh_data = json.load(f)
            except Exception as e:
                print(f"  Error reading {path}: {e}")
                continue
                
            if isinstance(mesh_data, dict):
                mesh_data = [mesh_data]
                
            for mesh in mesh_data:
                if not isinstance(mesh, dict):
                    continue
                vertices = mesh.get("vertices", [])
                normals = mesh.get("normals", [])
                faces = mesh.get("faces", [])
                
                # Write vertices
                for i in range(0, len(vertices), 3):
                    # Scale by 0.01 for better viewing and center roughly
                    # Also the provided model units are huge, like x=63, y=-85, z=496
                    x = vertices[i] * 0.01
                    y = vertices[i+1] * 0.01
                    z = vertices[i+2] * 0.01
                    out.write(f"v {x} {y} {z}\n")
                    
                # Write normals
                for i in range(0, len(normals), 3):
                    nx = normals[i]
                    ny = normals[i+1]
                    nz = normals[i+2]
                    out.write(f"vn {nx} {ny} {nz}\n")
                    
                # Write faces
                idx = 0
                while idx < len(faces):
                    type_mask = faces[idx]
                    # We assume exclusively type 40 (bit 32+8) for this dataset.
                    if type_mask == 40:
                        v1 = faces[idx+1] + 1 + v_offset
                        v2 = faces[idx+2] + 1 + v_offset
                        v3 = faces[idx+3] + 1 + v_offset
                        n1 = faces[idx+7] + 1 + vn_offset
                        n2 = faces[idx+8] + 1 + vn_offset
                        n3 = faces[idx+9] + 1 + vn_offset
                        out.write(f"f {v1}//{n1} {v2}//{n2} {v3}//{n3}\n")
                        idx += 10
                    elif type_mask == 32: # face normals, no UVs
                        v1 = faces[idx+1] + 1 + v_offset
                        v2 = faces[idx+2] + 1 + v_offset
                        v3 = faces[idx+3] + 1 + v_offset
                        n1 = faces[idx+4] + 1 + vn_offset
                        n2 = faces[idx+5] + 1 + vn_offset
                        n3 = faces[idx+6] + 1 + vn_offset
                        out.write(f"f {v1}//{n1} {v2}//{n2} {v3}//{n3}\n")
                        idx += 7
                    elif type_mask == 0: # just vertices
                        v1 = faces[idx+1] + 1 + v_offset
                        v2 = faces[idx+2] + 1 + v_offset
                        v3 = faces[idx+3] + 1 + v_offset
                        out.write(f"f {v1} {v2} {v3}\n")
                        idx += 4
                    elif type_mask == 42 or type_mask == 43:
                        idx += 11 # Unhandled fallback
                    elif type_mask == 41:
                        idx += 11
                    elif type_mask == 2:
                        idx += 5
                    else:
                        print(f"  Unhandled face type {type_mask}")
                        break
                        
                v_offset += len(vertices) // 3
                vn_offset += len(normals) // 3

print(f"Successfully wrote OBJ model to {output_path}")
