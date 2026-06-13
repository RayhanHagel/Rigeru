import os
import gc
import json
import torch
import whisperx
import cv2
import numpy as np
import matplotlib.font_manager as fm
from whisperx.diarize import DiarizationPipeline

# ─────────────────────────────────────────────
#  Constants
# ─────────────────────────────────────────────
CACHE_DIR  = "./cache"
CREDS_FILE = os.path.join(CACHE_DIR, "hf_creds.json")

VIDEO_EXTENSIONS = {"mp4", "mkv", "avi", "mov"}

MODEL_MATRIX = {
    "tiny":     {"size": "75 MB",   "vram": "1 GB",   "complexity": "Low",       "desc": "Fastest, lowest accuracy"},
    "base":     {"size": "145 MB",  "vram": "1.5 GB", "complexity": "Low-Medium","desc": "Good balance for speed"},
    "small":    {"size": "460 MB",  "vram": "2 GB",   "complexity": "Medium",    "desc": "Decent accuracy, modest footprint"},
    "medium":   {"size": "1.5 GB",  "vram": "5 GB",   "complexity": "High",      "desc": "High accuracy, demanding"},
    "large-v2": {"size": "3.0 GB",  "vram": "8 GB",   "complexity": "Very High", "desc": "Excellent accuracy"},
    "large-v3": {"size": "3.0 GB",  "vram": "8 GB+",  "complexity": "Extreme",   "desc": "State of the art accuracy"},
}

STYLE_PRESETS = {
    "Cinema Black": {
        "font": "Arial",   "size": 52, "margin_v": 60,
        "primary_color": "#FFFFFF", "primary_trans": 1.0,
        "outline_color": "#000000", "outline_width": 3,
    },
    "Neon Pop": {
        "font": "Impact",  "size": 58, "margin_v": 55,
        "primary_color": "#FFFF00", "primary_trans": 1.0,
        "outline_color": "#000000", "outline_width": 4,
    },
    "Soft Pastel": {
        "font": "Verdana", "size": 46, "margin_v": 70,
        "primary_color": "#FFE4E1", "primary_trans": 0.9,
        "outline_color": "#333333", "outline_width": 2,
    },
    "Minimal White": {
        "font": "Tahoma",  "size": 44, "margin_v": 50,
        "primary_color": "#FFFFFF", "primary_trans": 0.85,
        "outline_color": "#000000", "outline_width": 1,
    },
    "Custom": None,  # sentinel – user builds their own
}
DEFAULT_PRESET = "Cinema Black"


# ─────────────────────────────────────────────
#  Credentials
# ─────────────────────────────────────────────
def load_hf_token() -> str:
    """Read the cached Hugging Face token, or return empty string."""
    if os.path.exists(CREDS_FILE):
        try:
            with open(CREDS_FILE, "r", encoding="utf-8") as f:
                return json.load(f).get("hf_token", "")
        except Exception:
            return ""
    return ""


def save_hf_token(token: str) -> None:
    """Persist a Hugging Face token to the local cache directory."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(CREDS_FILE, "w", encoding="utf-8") as f:
        json.dump({"hf_token": token.strip()}, f, indent=4)


# ─────────────────────────────────────────────
#  Hardware / model utilities
# ─────────────────────────────────────────────
def get_vram_recommendation() -> tuple[str, str]:
    """Return (recommended_model_key, human_readable_message) based on detected hardware."""
    if not torch.cuda.is_available():
        return "tiny", "⚠️ No GPU detected — CPU mode. tiny / base recommended for speed."
    vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
    if vram_gb >= 10:
        return "large-v3", f"✅ {vram_gb:.1f} GB VRAM detected — large-v3 recommended."
    elif vram_gb >= 6:
        return "medium",   f"✅ {vram_gb:.1f} GB VRAM detected — medium recommended."
    elif vram_gb >= 3:
        return "small",    f"✅ {vram_gb:.1f} GB VRAM detected — small recommended."
    else:
        return "base",     f"⚠️ {vram_gb:.1f} GB VRAM detected — base or tiny recommended."


def check_model_downloaded(model_name: str) -> bool:
    """Return True if the Whisper model weights are already in the HF hub cache."""
    hf_hub_cache = os.path.expanduser("~/.cache/huggingface/hub")
    if os.path.exists(hf_hub_cache):
        for folder in os.listdir(hf_hub_cache):
            if model_name in folder.lower() or f"whisper-{model_name}" in folder.lower():
                return True
    return False


# ─────────────────────────────────────────────
#  File ingestion helpers
# ─────────────────────────────────────────────
def is_video_file(filename: str) -> bool:
    """Return True when the file extension is a recognised video format."""
    return filename.lower().rsplit(".", 1)[-1] in VIDEO_EXTENSIONS


def save_upload_to_cache(uploaded_file) -> str:
    """
    Write a Streamlit UploadedFile to ./cache and return the local path.
    Safe to call on every rerun — only overwrites when content changes.
    """
    os.makedirs(CACHE_DIR, exist_ok=True)
    temp_path = os.path.join(CACHE_DIR, uploaded_file.name)
    with open(temp_path, "wb") as f:
        f.write(uploaded_file.getbuffer())
    return temp_path


def extract_video_frame(file_path: str) -> np.ndarray | None:
    """
    Extract a single BGR frame at ~25 % of the video duration.
    Returns a 1920×1080 ndarray, or None if extraction fails.
    """
    cap = cv2.VideoCapture(file_path)
    frame_bgr = None
    if cap.isOpened():
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        cap.set(cv2.CAP_PROP_POS_FRAMES, min(total // 4, max(total - 1, 0)))
        ret, frame = cap.read()
        if ret:
            frame_bgr = cv2.resize(frame, (1920, 1080))
    cap.release()
    return frame_bgr


def bgr_frame_to_rgb(frame: np.ndarray) -> np.ndarray:
    """Convert a BGR ndarray (as returned by OpenCV) to RGB for display in Streamlit."""
    import cv2
    return cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)


def extract_speaker_thumbnail(video_path: str, start_seconds: float) -> np.ndarray | None:
    """
    Seek to `start_seconds` in a video and return a 320×180 RGB thumbnail.
    Returns None if the seek or read fails.
    """
    cap = cv2.VideoCapture(video_path)
    thumb = None
    if cap.isOpened():
        cap.set(cv2.CAP_PROP_POS_MSEC, start_seconds * 1000)
        ret, frame = cap.read()
        if ret:
            thumb = cv2.cvtColor(cv2.resize(frame, (320, 180)), cv2.COLOR_BGR2RGB)
    cap.release()
    return thumb


# ─────────────────────────────────────────────
#  Transcription pipeline
# ─────────────────────────────────────────────
def run_transcription_pipeline(
    audio_path: str,
    model_name: str,
    hf_token: str,
    do_diarize: bool,
    speaker_mapping: dict,
    progress_bar=None,
    status_text=None,
) -> list[dict]:
    """
    Full WhisperX pipeline: load → transcribe → align → (optionally) diarise.

    Returns a list of segment dicts, each with keys:
        start, end, text, (speaker if diarized)
    """
    device       = "cuda" if torch.cuda.is_available() else "cpu"
    compute_type = "float16" if device == "cuda" else "int8"

    def _status(msg: str, pct: int) -> None:
        if status_text:  status_text.text(msg)
        if progress_bar: progress_bar.progress(pct)

    _status("Loading Whisper model weights…", 10)
    model = whisperx.load_model(model_name, device, compute_type=compute_type)

    _status("Transcribing audio stream…", 35)
    audio  = whisperx.load_audio(audio_path)
    result = model.transcribe(audio, batch_size=8)

    _status("Aligning word-level timestamps…", 60)
    model_a, metadata = whisperx.load_align_model(
        language_code=result["language"], device=device
    )
    result = whisperx.align(
        result["segments"], model_a, metadata, audio, device,
        return_char_alignments=False,
    )

    # Free GPU memory before diarization
    del model, model_a
    gc.collect()
    if device == "cuda":
        torch.cuda.empty_cache()

    if do_diarize and hf_token:
        _status("Running speaker diarization…", 80)
        try:
            diarize_model    = DiarizationPipeline(token=hf_token, device=device)
            diarize_segments = diarize_model(audio)
            result           = whisperx.assign_word_speakers(diarize_segments, result)
        except Exception as e:
            if status_text:
                status_text.text(f"⚠️ Diarization failed ({e}) — continuing without speaker labels.")

    # Apply any caller-supplied name remapping
    for seg in result.get("segments", []):
        raw = seg.get("speaker", "UNKNOWN")
        if raw in speaker_mapping and speaker_mapping[raw].strip():
            seg["speaker"] = speaker_mapping[raw].strip()

    _status("Done!", 100)
    return result.get("segments", [])


def collect_raw_speaker_ids(segments: list[dict]) -> list[str]:
    """Return a sorted list of unique speaker IDs present in the segments."""
    return sorted({seg.get("speaker", "UNKNOWN") for seg in segments})


def apply_speaker_renames(segments: list[dict], mapping: dict) -> list[dict]:
    """
    Return a *new* list of segment dicts with speaker keys replaced per mapping.
    Does not mutate the original list.
    """
    renamed = []
    for seg in segments:
        new_seg = dict(seg)
        raw     = seg.get("speaker", "UNKNOWN")
        new_seg["speaker"] = mapping.get(raw, raw)
        renamed.append(new_seg)
    return renamed


# ─────────────────────────────────────────────
#  Font helpers
# ─────────────────────────────────────────────
def get_system_fonts() -> list[str]:
    """Return a sorted list of all system font family names."""
    try:
        fonts = sorted({f.name for f in fm.fontManager.ttflist})
        return fonts or ["Arial", "Courier New", "Tahoma", "Times New Roman", "Verdana"]
    except Exception:
        return ["Arial", "Courier New", "Tahoma", "Times New Roman", "Verdana"]


# ─────────────────────────────────────────────
#  Subtitle canvas preview
# ─────────────────────────────────────────────
def render_subtitle_preview(
    base_frame: np.ndarray | None,
    sample_text: str,
    style: dict,
) -> np.ndarray:
    """
    Draw sample subtitle text onto a copy of base_frame (or a dark canvas)
    using the supplied style dict.  Returns a 1920×1080 RGB ndarray ready
    for st.image().
    """
    canvas = base_frame.copy() if base_frame is not None \
             else np.full((1080, 1920, 3), 30, dtype=np.uint8)

    cv_font  = cv2.FONT_HERSHEY_SIMPLEX
    cv_scale = style.get("size", 52) / 38.0
    out_w    = style.get("outline_width", 3)

    text_size, _ = cv2.getTextSize(sample_text, cv_font, cv_scale, out_w + 2)
    tx = max(0, (1920 - text_size[0]) // 2)
    ty = 1080 - style.get("margin_v", 60)

    def _hex_to_bgr(hex_str: str) -> list[int]:
        h = hex_str.lstrip("#")
        return [int(h[4:6], 16), int(h[2:4], 16), int(h[0:2], 16)]

    p_bgr = _hex_to_bgr(style.get("primary_color", "#FFFFFF"))
    o_bgr = _hex_to_bgr(style.get("outline_color", "#000000"))

    if out_w > 0:
        cv2.putText(canvas, sample_text, (tx, ty), cv_font, cv_scale,
                    o_bgr, out_w + 4, cv2.LINE_AA)

    opacity = style.get("primary_trans", 1.0)
    if opacity >= 0.98:
        cv2.putText(canvas, sample_text, (tx, ty), cv_font, cv_scale,
                    p_bgr, out_w, cv2.LINE_AA)
    else:
        overlay = canvas.copy()
        cv2.putText(overlay, sample_text, (tx, ty), cv_font, cv_scale,
                    p_bgr, out_w, cv2.LINE_AA)
        cv2.addWeighted(overlay, opacity, canvas, 1.0 - opacity, 0, canvas)

    return cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)


# ─────────────────────────────────────────────
#  Time formatters
# ─────────────────────────────────────────────
def format_srt_time(seconds: float) -> str:
    h  = int(seconds // 3600)
    m  = int((seconds % 3600) // 60)
    s  = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def format_ass_time(seconds: float) -> str:
    h  = int(seconds // 3600)
    m  = int((seconds % 3600) // 60)
    s  = int(seconds % 60)
    cs = int((seconds % 1) * 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def rgba_to_ass_hex(color_hex: str, transparency: float) -> str:
    """Convert #RRGGBB + opacity float → ASS &H[AA][BB][GG][RR] string."""
    h = color_hex.lstrip("#")
    r, g, b = (h[0:2], h[2:4], h[4:6]) if len(h) == 6 else ("FF", "FF", "FF")
    alpha = int((1.0 - transparency) * 255)
    return f"&H{alpha:02X}{b}{g}{r}"


# ─────────────────────────────────────────────
#  Export builders
# ─────────────────────────────────────────────
def export_txt(
    segments: list[dict],
    identify_people: bool,
    show_names: bool = True,
    separator: str = ":",
    uppercase_names: bool = False,
) -> str:
    """Build a plain-text transcript string."""
    lines = []
    for seg in segments:
        text = seg["text"].strip()
        spk  = seg.get("speaker", "")
        if identify_people and show_names and spk:
            name = spk.upper() if uppercase_names else spk
            lines.append(f"{name}{separator} {text}")
        else:
            lines.append(text)
    return "\n".join(lines)


def export_srt(segments: list[dict], identify_people: bool) -> str:
    """Build a SubRip (.srt) string from segments."""
    lines = []
    for i, seg in enumerate(segments, 1):
        start = format_srt_time(seg["start"])
        end   = format_srt_time(seg["end"])
        text  = seg["text"].strip()
        lines.append(f"{i}\n{start} --> {end}")
        if identify_people:
            lines.append(f"{seg.get('speaker', 'UNKNOWN')}: {text}\n")
        else:
            lines.append(f"{text}\n")
    return "\n".join(lines)


def export_ass(segments: list[dict], style_config: dict) -> str:
    """Build a single-style Advanced SubStation Alpha (.ass) string."""
    fn  = style_config.get("font", "Arial")
    fs  = style_config.get("size", 48)
    mv  = style_config.get("margin_v", 40)
    ow  = style_config.get("outline_width", 2)
    pri = rgba_to_ass_hex(style_config.get("primary_color", "#FFFFFF"),
                          style_config.get("primary_trans", 1.0))
    out = rgba_to_ass_hex(style_config.get("outline_color", "#000000"), 1.0)

    header = [
        "[Script Info]", "ScriptType: v4.00+",
        "PlayResX: 1920", "PlayResY: 1080", "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
        "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, "
        "ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
        "Alignment, MarginL, MarginR, MarginV, Encoding",
        f"Style: Default,{fn},{fs},{pri},&H000000FF,{out},&H80000000,"
        f"0,0,0,0,100,100,0,0,1,{ow},1,2,10,10,{mv},1", "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    events = []
    for seg in segments:
        start = format_ass_time(seg["start"])
        end   = format_ass_time(seg["end"])
        text  = seg["text"].strip().replace("\n", " ")
        display = (
            f"{seg.get('speaker', 'Speaker')}: {text}"
            if style_config.get("identify_people") else text
        )
        events.append(f"Dialogue: 0,{start},{end},Default,,0,0,0,,{display}")

    return "\n".join(header + events)


def export_ass_multistyle(
    segments: list[dict],
    speaker_styles: dict,
    identify_people: bool,
    fallback_preset_name: str = DEFAULT_PRESET,
) -> str:
    """
    Build an .ass file where each unique speaker gets their own [V4+ Style] entry.

    speaker_styles  – { speaker_id: style_dict, … }
    identify_people – prefix dialogue lines with "Speaker: "
    """
    fallback = STYLE_PRESETS[fallback_preset_name]

    header = [
        "[Script Info]", "ScriptType: v4.00+",
        "PlayResX: 1920", "PlayResY: 1080", "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
        "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, "
        "ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
        "Alignment, MarginL, MarginR, MarginV, Encoding",
    ]

    # Collect unique speakers in segment order (preserve appearance order)
    seen: set[str] = set()
    ordered_speakers: list[str] = []
    for seg in segments:
        spk = seg.get("speaker", "UNKNOWN")
        if spk not in seen:
            seen.add(spk)
            ordered_speakers.append(spk)

    style_name_map: dict[str, str] = {}
    for spk in ordered_speakers:
        s          = speaker_styles.get(spk, fallback)
        pri        = rgba_to_ass_hex(s.get("primary_color", "#FFFFFF"), s.get("primary_trans", 1.0))
        out        = rgba_to_ass_hex(s.get("outline_color", "#000000"), 1.0)
        fn         = s.get("font", "Arial")
        fs         = s.get("size", 52)
        ow         = s.get("outline_width", 3)
        mv         = s.get("margin_v", 60)
        style_name = spk.replace(" ", "_")
        style_name_map[spk] = style_name
        header.append(
            f"Style: {style_name},{fn},{fs},{pri},&H000000FF,{out},&H80000000,"
            f"0,0,0,0,100,100,0,0,1,{ow},1,2,10,10,{mv},1"
        )

    header += [
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]

    events = []
    for seg in segments:
        start      = format_ass_time(seg["start"])
        end        = format_ass_time(seg["end"])
        text       = seg["text"].strip().replace("\n", " ")
        spk        = seg.get("speaker", "UNKNOWN")
        style_name = style_name_map.get(spk, "Default")
        display    = f"{spk}: {text}" if identify_people else text
        events.append(f"Dialogue: 0,{start},{end},{style_name},,0,0,0,,{display}")

    return "\n".join(header + events)

def extract_audio_snippet(media_path: str, start_time: float, end_time: float) -> bytes | None:
    """
    Extracts a small audio chunk from the media file using ffmpeg.
    Requires ffmpeg to be installed on the system PATH or via pydub.
    """
    try:
        from pydub import AudioSegment
        import io
        
        # Load the media (works for both audio and video files via ffmpeg)
        ext = media_path.split('.')[-1].lower()
        if ext in ['mp4', 'mkv', 'avi', 'mov']:
            audio = AudioSegment.from_file(media_path, format="mp4")
        else:
            audio = AudioSegment.from_file(media_path)
            
        # Pydub works in milliseconds
        start_ms = int(start_time * 1000)
        end_ms = int(end_time * 1000)
        
        # Extract the chunk
        chunk = audio[start_ms:end_ms]
        
        # Export to a BytesIO object
        buffer = io.BytesIO()
        chunk.export(buffer, format="wav")
        return buffer.getvalue()
        
    except ImportError:
        import streamlit as st
        st.error("Please install pydub to enable audio extraction: `pip install pydub`")
        return None
    except Exception as e:
        print(f"Error extracting audio: {e}")
        return None