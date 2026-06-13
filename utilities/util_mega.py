import re
import json
import base64
import requests
from Crypto.Cipher import AES
import streamlit as st

# --- MEGA Cryptography Helpers ---
def base64_url_decode(data: str) -> bytes:
    """Decodes MEGA's modified base64 format."""
    data += '=' * (-len(data) % 4)
    return base64.urlsafe_b64decode(data)

def decrypt_aes_cbc(data: bytes, key: bytes) -> bytes:
    """Decrypts MEGA's AES-CBC encrypted attributes."""
    cipher = AES.new(key, AES.MODE_CBC, b'\0' * 16)
    return cipher.decrypt(data)

def decrypt_node_key(k_str: str, master_key: bytes) -> bytes:
    """Decrypts the individual file key using the folder's master key."""
    try:
        encrypted_key_b64 = k_str.split(':')[-1] 
        encrypted_key = base64_url_decode(encrypted_key_b64)
        
        cipher = AES.new(master_key, AES.MODE_ECB)
        decrypted_key = cipher.decrypt(encrypted_key)
        
        if len(decrypted_key) == 32:
            attr_key = bytes(a ^ b for a, b in zip(decrypted_key[:16], decrypted_key[16:]))
            return attr_key
        return decrypted_key
    except Exception:
        return master_key

def get_folder_nodes(folder_url: str) -> tuple[list, str, bytes]:
    """Makes an unauthenticated API call to MEGA."""
    match = re.search(r'folder/([^#]+)#(.+)', folder_url)
    if not match:
        raise ValueError("Invalid MEGA folder link. Must contain folder ID and key (the part after the #).")
    
    folder_id = match.group(1)
    master_key_b64 = match.group(2)
    master_key = base64_url_decode(master_key_b64)

    api_url = f"https://g.api.mega.co.nz/cs?id=0&n={folder_id}"
    payload = [{"a": "f", "c": 1, "r": 1, "ca": 1}]
    
    # CRITICAL: Added timeout to prevent infinite hangs
    response = requests.post(api_url, json=payload, timeout=15)
    response_data = response.json()
    
    if isinstance(response_data, int) or not response_data or 'f' not in response_data[0]:
        raise Exception(f"API Error or Invalid Folder. Ensure the link is public and still active.")

    return response_data[0]['f'], folder_id, master_key

# --- File Type Categorization ---
def get_file_category(filename: str) -> str:
    """Determines the file type based on its decrypted extension."""
    ext = filename.split('.')[-1].lower() if '.' in filename else ''
    
    if ext in {'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v'}:
        return "🎬 VIDEO"
    elif ext in {'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'svg'}:
        return "🖼️ IMAGE"
    elif ext in {'pdf', 'doc', 'docx', 'txt', 'rtf', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'epub'}:
        return "📄 DOCUMENT"
    elif ext in {'zip', 'rar', '7z', 'tar', 'gz', 'iso'}:
        return "📦 ARCHIVE"
    elif ext in {'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'}:
        return "🎵 AUDIO"
    else:
        return "📁 OTHER"

# --- Main Processor ---
@st.cache_data(show_spinner=False)
def process_mega_link(folder_link: str, min_size_mb: int, max_size_mb: int) -> tuple[str, str, str, str]:
    """
    Processes the mega link and returns formatted strings for the UI.
    Returns: (output_raw, output_named, total_size_string, output_logs)
    """
    if not folder_link:
        return "Please enter a valid link.", "", "0.00 GB (0 MB)", ""
    
    if min_size_mb > max_size_mb:
        return "Error: Minimum size cannot be greater than Maximum size.", "", "0.00 GB (0 MB)", ""

    try:
        nodes, folder_id, master_key = get_folder_nodes(folder_link)
        
        min_size_bytes = min_size_mb * 1024 * 1024
        max_size_bytes = max_size_mb * 1024 * 1024
        
        seen_sizes = set()
        raw_links = []
        formatted_links_with_names = []
        logs = []
        skipped_logs = []
        total_selection_bytes = 0

        for node in nodes:
            if node.get('t') != 0: # Skip folders
                continue
                
            node_id = node['h']
            file_size = node['s']
            file_size_mb = file_size / (1024 * 1024)
            
            # --- 1. Min/Max Size Filter ---
            if not (min_size_bytes <= file_size <= max_size_bytes):
                skipped_logs.append(f"Skipped (Size Out of Bounds): Node {node_id} ({file_size_mb:.2f} MB)")
                continue

            # --- 2. Decrypt File Name ---
            file_name = "Unknown_Encrypted_File"
            try:
                if 'k' in node:
                    node_key = decrypt_node_key(node['k'], master_key)
                    encrypted_attr = base64_url_decode(node['a'])
                    decrypted = decrypt_aes_cbc(encrypted_attr, node_key)
                    decrypted = decrypted.rstrip(b'\0')
                    if decrypted.startswith(b'MEGA{'):
                        attr_json = json.loads(decrypted[4:].decode('utf-8'))
                        file_name = attr_json.get('n', file_name)
            except Exception:
                file_name = f"Encrypted_File_{node_id}"

            category = get_file_category(file_name)

            # --- 3. Duplicate Removal ---
            if file_size in seen_sizes:
                skipped_logs.append(f"Removed Duplicate ({category}): {file_name} ({file_size_mb:.2f} MB)")
                continue
            
            seen_sizes.add(file_size)
            total_selection_bytes += file_size

            # --- 4. Generate Links ---
            direct_link = f"https://mega.nz/file/{node_id}#{master_key}" # Provide full standalone links if possible, or just standard structure
            if "folder/" in folder_link:
                direct_link = f"{folder_link}/file/{node_id}"
                
            raw_links.append(direct_link)
            
            formatted_links_with_names.append(f"[{category}] {file_name} ({file_size_mb:.2f} MB)\n↳ Link: {direct_link}\n")
            logs.append(f"Kept: [{category}] {file_name} | Size: {file_size_mb:.2f} MB")

        output_raw = "\n".join(raw_links)
        output_named = "\n".join(formatted_links_with_names)
        output_logs = "\n".join(logs + ["\n--- SKIPPED ---"] + skipped_logs)
        
        total_gb = total_selection_bytes / (1024 ** 3)
        total_mb = total_selection_bytes / (1024 ** 2)
        total_size_string = f"{total_gb:.2f} GB ({total_mb:,.2f} MB)"
        
        if not raw_links:
            output_raw = "No files matched your criteria."
            output_named = "No files matched your criteria."
            
        return output_raw, output_named, total_size_string, output_logs

    except requests.exceptions.Timeout:
        return "Error: MEGA.nz API timed out. Try again later.", "", "0.00 GB (0 MB)", ""
    except Exception as e:
        return f"Error: {str(e)}", "", "0.00 GB (0 MB)", ""