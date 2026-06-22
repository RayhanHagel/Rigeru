import os
import shutil
import tempfile
import sys
import subprocess
import tkinter as tk
from tkinter import filedialog
from PIL import Image
from pillow_heif import register_heif_opener
import fitz  # PyMuPDF
from send2trash import send2trash
import streamlit as st
import cv2
import zipfile
import xml.etree.ElementTree as ET
import itertools 

import mutagen
from pygments import highlight
from pygments.lexers import get_lexer_for_filename, guess_lexer
from pygments.formatters import ImageFormatter
import trimesh
import matplotlib.pyplot as plt

register_heif_opener()


def _init_tkinter():
    root = tk.Tk()
    root.withdraw()
    root.attributes('-topmost', True)
    return root


def open_folder_dialog(current_path: str = "") -> str:
    root = _init_tkinter()
    selected = filedialog.askdirectory(
        initialdir=current_path if os.path.exists(current_path) else os.path.expanduser('~'),
        title="Select Folder"
    )
    root.destroy()
    return selected if selected else current_path


# --- EXTRACTION HANDLERS ---

def extract_video_frame(file_path: str, output_path: str) -> bool:
    try:
        cap = cv2.VideoCapture(file_path)
        if not cap.isOpened():
            return False

        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps and fps > 0:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(fps))

        ret, frame = cap.read()
        if not ret:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ret, frame = cap.read()

        if ret:
            cv2.imwrite(output_path, frame)
            cap.release()
            return True
        cap.release()
    except Exception:
        pass
    return False


def extract_office_thumbnail(file_path: str, output_path: str) -> bool:
    try:
        with zipfile.ZipFile(file_path, 'r') as z:
            if 'docProps/thumbnail.jpeg' in z.namelist():
                with z.open('docProps/thumbnail.jpeg') as f_in, open(output_path, 'wb') as f_out:
                    f_out.write(f_in.read())
                return True
    except Exception:
        pass
    return False


def extract_epub_cover(file_path: str, output_path: str) -> bool:
    try:
        with zipfile.ZipFile(file_path, 'r') as z:
            container_root = ET.fromstring(z.read('META-INF/container.xml'))
            opf_path = container_root.find('.//n:rootfile', {'n': 'urn:oasis:names:tc:opendocument:xmlns:container'}).attrib.get('full-path')
            opf_root = ET.fromstring(z.read(opf_path))
            opf_ns = {'opf': 'http://www.idpf.org/2007/opf'}

            cover_id = None
            for m in opf_root.iterfind('.//opf:meta', opf_ns):
                if m.attrib.get('name') == 'cover':
                    cover_id = m.attrib.get('content')
                    break
                    
            if not cover_id:
                return False

            cover_href = None
            for i in opf_root.iterfind('.//opf:item', opf_ns):
                if i.attrib.get('id') == cover_id:
                    cover_href = i.attrib.get('href')
                    break
                    
            if not cover_href:
                return False

            base_path = os.path.dirname(opf_path)
            cover_full_path = f"{base_path}/{cover_href}" if base_path else cover_href

            with z.open(cover_full_path) as f_in:
                # OPTIMIZED: Safely stream to NamedTemporaryFile and use atomic shutil.move
                with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg', dir=tempfile.gettempdir()) as tmp:
                    tmp.write(f_in.read())
                    tmp_name = tmp.name
                shutil.move(tmp_name, output_path)
            return True
    except Exception:
        pass
    return False


def extract_audio_cover(file_path: str, output_path: str) -> bool:
    try:
        audio = mutagen.File(file_path)
        if audio and getattr(audio, 'tags', None):
            for key in audio.tags.keys():
                if key.startswith('APIC') or key == 'covr':
                    pic = audio.tags[key]
                    data = pic.data if hasattr(pic, 'data') else pic[0] if isinstance(pic, list) else pic
                    with open(output_path, 'wb') as f:
                        f.write(data)
                    return True
            if hasattr(audio, 'pictures') and audio.pictures:
                with open(output_path, 'wb') as f:
                    f.write(audio.pictures[0].data)
                return True
    except Exception:
        pass
    return False


def extract_text_preview(file_path: str, output_path: str) -> bool:
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            code = "".join(itertools.islice(f, 25))
        try:
            lexer = get_lexer_for_filename(file_path)
        except Exception:
            lexer = guess_lexer(code)

        formatter = ImageFormatter(font_size=14, line_numbers=False, style='monokai')
        result = highlight(code, lexer, formatter)
        with open(output_path, 'wb') as f:
            f.write(result)
        return True
    except Exception:
        pass
    return False


def extract_3d_preview(file_path: str, output_path: str) -> bool:
    try:
        mesh = trimesh.load(file_path, force='mesh')
        fig = plt.figure(figsize=(4, 4))
        ax = fig.add_subplot(111, projection='3d')

        if len(mesh.faces) > 5000:
            step = max(1, len(mesh.vertices) // 2000)
            ax.scatter(mesh.vertices[::step, 0], mesh.vertices[::step, 1], mesh.vertices[::step, 2], s=0.5, c='gray')
        else:
            ax.plot_trisurf(mesh.vertices[:, 0], mesh.vertices[:, 1], mesh.vertices[:, 2], triangles=mesh.faces, cmap='viridis', alpha=0.8)

        plt.axis('off')
        plt.savefig(output_path, bbox_inches='tight', pad_inches=0, dpi=100)
        plt.close(fig)
        return True
    except Exception:
        plt.close('all')
        return False


# --- PREVIEW GENERATOR ---

@st.cache_data(max_entries=50, show_spinner=False)
def get_image_preview(file_path: str) -> str | None:
    if not file_path or not os.path.exists(file_path):
        return None

    ext = os.path.splitext(file_path)[1].lower()

    valid_images = {'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.heic'}
    valid_videos = {'.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v'}
    valid_office = {'.docx', '.pptx'}
    valid_audio  = {'.mp3', '.flac', '.m4a', '.wav', '.ogg'}
    valid_text   = {'.py', '.js', '.html', '.css', '.json', '.txt', '.md', '.csv', '.java', '.cpp'}
    valid_3d     = {'.obj', '.stl', '.gltf', '.glb'}

    try:
        if ext in valid_images:
            if ext == '.heic':
                img = Image.open(file_path)
                tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg', dir=tempfile.gettempdir())
                tmp.close()
                img.convert('RGB').save(tmp.name, format="JPEG")
                return tmp.name
            else:
                return file_path

        elif ext == '.pdf':
            with fitz.open(file_path) as doc:
                page = doc.load_page(0)
                pix = page.get_pixmap(dpi=72)
                tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.png', dir=tempfile.gettempdir())
                tmp.close()
                pix.save(tmp.name)
                return tmp.name

        handlers = [
            (valid_videos, extract_video_frame),
            (valid_office, extract_office_thumbnail),
            ({'.epub'}, extract_epub_cover),
            (valid_audio, extract_audio_cover),
            (valid_text, extract_text_preview),
            (valid_3d, extract_3d_preview)
        ]

        for ext_set, handler in handlers:
            if ext in ext_set:
                tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg', dir=tempfile.gettempdir())
                tmp.close()
                if handler(file_path, tmp.name):
                    return tmp.name
                os.remove(tmp.name)
                return None

    except Exception as e:
        print(f"Preview generation failed for {file_path}: {e}")

    return None


# --- FILE OPERATIONS ---

def get_target_files(source_path: str) -> list:
    if not os.path.isdir(source_path):
        return []

    ignored_files = {'desktop.ini', '.ds_store', 'thumbs.db'}
    files = []
    
    with os.scandir(source_path) as entries:
        for entry in entries:
            if entry.name.lower() not in ignored_files:
                files.append(entry.name)
                
    return sorted(files)


def open_file_in_os(file_path: str) -> tuple[bool, str]:
    if not file_path or not os.path.exists(file_path):
        return False, "❌ File no longer exists."
    try:
        if sys.platform == "win32":
            os.startfile(file_path)
        elif sys.platform == "darwin":
            subprocess.call(["open", file_path])
        else:
            subprocess.call(["xdg-open", file_path])
        return True, f"📖 Opened: {os.path.basename(file_path)}"
    except Exception as e:
        return False, f"❌ Failed to open file: {e}"


def perform_move(src_file_path: str, dest_dir: str, current_file: str, rename_value: str) -> tuple[bool, str, str, str]:
    ext = os.path.splitext(current_file)[1]
    new_name = rename_value.strip() if rename_value and rename_value.strip() else ""

    if new_name and new_name != os.path.splitext(current_file)[0]:
        if not os.path.splitext(new_name)[1]:
            new_name += ext
        dest_filename = new_name
        record_action = "rename"
    else:
        dest_filename = current_file
        record_action = "move"

    dest_file = os.path.join(dest_dir, dest_filename)

    if os.path.exists(dest_file):
        base, e = os.path.splitext(dest_filename)
        dest_filename = f"{base}_1{e}"
        dest_file = os.path.join(dest_dir, dest_filename)

    try:
        os.makedirs(dest_dir, exist_ok=True)
        shutil.move(src_file_path, dest_file)
        return True, dest_filename, record_action, ""
    except Exception as e:
        return False, "", "", str(e)


def perform_delete(src_file_path: str) -> tuple[bool, str]:
    try:
        clean_path = src_file_path.replace('\\\\?\\', '').replace('//?/', '')
        send2trash(clean_path)
        return True, ""
    except Exception as e:
        return False, str(e)


def perform_undo(last_action: dict, source_path: str, dest_base_path: str) -> tuple[bool, str]:
    if last_action["action"] in ("move", "rename"):
        src_restore = os.path.join(dest_base_path, last_action["target"] or "", last_action["dest_file"])
        dst_restore = os.path.join(source_path, last_action["orig_file"])
        try:
            shutil.move(src_restore, dst_restore)
            return True, f"↩️ Undid: {last_action['dest_file']} ← {last_action['target']}"
        except Exception as e:
            return False, f"❌ Undo failed: {e}"
    elif last_action["action"] == "delete":
        return True, f"⚠️ Stepped back. Note: '{last_action['orig_file']}' is in your OS Trash."
    else:
        return True, f"↩️ Undid skip: {last_action['orig_file']}"