import os
import shutil
import tempfile
import zipfile
import xml.etree.ElementTree as ET
import itertools
import hashlib

# --- Static Cache Directory ---
STATIC_DIR = os.path.join(os.getcwd(), "static", "thumbnail_cache")
os.makedirs(STATIC_DIR, exist_ok=True)


def extract_video_frame(file_path: str, output_path: str) -> bool:
    import cv2
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
    except:
        pass
    return False


def extract_office_thumbnail(file_path: str, output_path: str) -> bool:
    try:
        with zipfile.ZipFile(file_path, 'r') as z:
            if 'docProps/thumbnail.jpeg' in z.namelist():
                with z.open('docProps/thumbnail.jpeg') as f_in, open(output_path, 'wb') as f_out:
                    f_out.write(f_in.read())
                return True
    except:
        pass
    return False


def extract_epub_cover(file_path: str, output_path: str) -> bool:
    try:
        with zipfile.ZipFile(file_path, 'r') as z:
            container_root = ET.fromstring(z.read('META-INF/container.xml'))
            opf_path = container_root.find(
                './/n:rootfile', {'n': 'urn:oasis:names:tc:opendocument:xmlns:container'}).attrib.get('full-path')
            opf_root = ET.fromstring(z.read(opf_path))
            opf_ns = {'opf': 'http://www.idpf.org/2007/opf'}
            cover_id = next((m.attrib.get('content') for m in opf_root.iterfind(
                './/opf:meta', opf_ns) if m.attrib.get('name') == 'cover'), None)
            if not cover_id:
                return False
            cover_href = next((i.attrib.get('href') for i in opf_root.iterfind(
                './/opf:item', opf_ns) if i.attrib.get('id') == cover_id), None)
            if not cover_href:
                return False
            base_path = os.path.dirname(opf_path)
            cover_full_path = f"{base_path}/{cover_href}" if base_path else cover_href
            with z.open(cover_full_path) as f_in:
                with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg', dir=tempfile.gettempdir()) as tmp:
                    tmp.write(f_in.read())
                    tmp_name = tmp.name
                shutil.move(tmp_name, output_path)
            return True
    except:
        pass
    return False


def extract_audio_cover(file_path: str, output_path: str) -> bool:
    import mutagen
    try:
        audio = mutagen.File(file_path)
        if audio and getattr(audio, 'tags', None):
            for key in audio.tags.keys():
                if key.startswith('APIC') or key == 'covr':
                    pic = audio.tags[key]
                    data = pic.data if hasattr(
                        pic, 'data') else pic[0] if isinstance(pic, list) else pic
                    with open(output_path, 'wb') as f:
                        f.write(data)
                    return True
            if hasattr(audio, 'pictures') and audio.pictures:
                with open(output_path, 'wb') as f:
                    f.write(audio.pictures[0].data)
                return True
    except:
        pass
    return False


def extract_text_preview(file_path: str, output_path: str) -> bool:
    from pygments import highlight
    from pygments.lexers import get_lexer_for_filename, guess_lexer
    from pygments.formatters import ImageFormatter
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            code = "".join(itertools.islice(f, 25))
        try:
            lexer = get_lexer_for_filename(file_path)
        except:
            lexer = guess_lexer(code)
        formatter = ImageFormatter(
            font_size=14, line_numbers=False, style='monokai')
        with open(output_path, 'wb') as f:
            f.write(highlight(code, lexer, formatter))
        return True
    except:
        pass
    return False


def extract_3d_preview(file_path: str, output_path: str) -> bool:
    import trimesh
    import matplotlib.pyplot as plt
    try:
        mesh = trimesh.load(file_path, force='mesh')
        fig = plt.figure(figsize=(4, 4))
        ax = fig.add_subplot(111, projection='3d')
        if len(mesh.faces) > 5000:
            step = max(1, len(mesh.vertices) // 2000)
            ax.scatter(mesh.vertices[::step, 0], mesh.vertices[::step,
                       1], mesh.vertices[::step, 2], s=0.5, c='gray')
        else:
            ax.plot_trisurf(mesh.vertices[:, 0], mesh.vertices[:, 1],
                            mesh.vertices[:, 2], triangles=mesh.faces, cmap='viridis', alpha=0.8)
        plt.axis('off')
        plt.savefig(output_path, bbox_inches='tight', pad_inches=0, dpi=100)
        plt.close(fig)
        return True
    except:
        import matplotlib.pyplot as plt
        plt.close('all')
        return False


def get_image_preview(file_path: str) -> str | None:
    if not file_path or not os.path.exists(file_path):
        return None

    # --- Hash-based Static Caching ---
    file_hash = hashlib.md5(file_path.encode('utf-8')).hexdigest()
    target_jpg = os.path.join(STATIC_DIR, f"{file_hash}.jpg")
    target_png = os.path.join(STATIC_DIR, f"{file_hash}.png")

    # If the physical file already exists in the static folder, skip generation
    if os.path.exists(target_jpg):
        return target_jpg
    if os.path.exists(target_png):
        return target_png

    ext = os.path.splitext(file_path)[1].lower()
    valid_images = {'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.heic'}
    valid_videos = {'.mp4', '.mkv', '.avi',
                    '.mov', '.wmv', '.flv', '.webm', '.m4v'}
    valid_office = {'.docx', '.pptx'}
    valid_audio = {'.mp3', '.flac', '.m4a', '.wav', '.ogg'}
    valid_text = {'.py', '.js', '.html', '.css',
                  '.json', '.txt', '.md', '.csv', '.java', '.cpp'}
    valid_3d = {'.obj', '.stl', '.gltf', '.glb'}

    try:
        if ext in valid_images:
            if ext == '.heic':
                from PIL import Image
                from pillow_heif import register_heif_opener
                register_heif_opener()
                img = Image.open(file_path)
                img.convert('RGB').save(target_jpg, format="JPEG")
                return target_jpg
            else:
                return file_path

        elif ext == '.pdf':
            import fitz
            with fitz.open(file_path) as doc:
                page = doc.load_page(0)
                pix = page.get_pixmap(dpi=72)
                pix.save(target_png)
                return target_png
        else:
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
                    # Save directly to the static cache directory instead of temp
                    if handler(file_path, target_jpg):
                        return target_jpg
                    break
    except:
        pass
    return None
