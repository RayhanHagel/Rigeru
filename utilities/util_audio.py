import os
import gc
import numpy as np

# Re-exports for backward compatibility — these functions were extracted
# to their own focused modules but old import paths should still resolve.
from utilities.util_time_format import format_srt_time, format_ass_time, rgba_to_ass_hex
from utilities.util_huggingface import load_hf_token, save_hf_token

# ─────────────────────────────────────────────
#  Constants
# ─────────────────────────────────────────────
CACHE_DIR  = "./cache"

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


# NOTE: load_hf_token and save_hf_token are now in util_huggingface.py
# and re-exported at the top of this file for backward compatibility.


# ─────────────────────────────────────────────
#  Hardware / model utilities
# ─────────────────────────────────────────────

# ─────────────────────────────────────────────
#  File ingestion helpers
# ─────────────────────────────────────────────

def extract_video_frame(file_path: str) -> np.ndarray | None:
    """
    Extract a single BGR frame at ~25 % of the video duration.
    Returns a 1920×1080 ndarray, or None if extraction fails.
    """
    import cv2
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
    import cv2
    cap = cv2.VideoCapture(video_path)
    thumb = None
    if cap.isOpened():
        cap.set(cv2.CAP_PROP_POS_MSEC, start_seconds * 1000)
        ret, frame = cap.read()
        if ret:
            thumb = cv2.cvtColor(cv2.resize(frame, (320, 180)), cv2.COLOR_BGR2RGB)
    cap.release()
    return thumb


def extract_speaker_clip(media_path: str, start_seconds: float, end_seconds: float, output_path: str) -> bool:
    """
    Extract a short audio clip from `start_seconds` to `end_seconds` and save to `output_path`.
    Returns True if successful, False otherwise.
    """
    import subprocess
    try:
        duration = end_seconds - start_seconds
        # -y to overwrite, -ss for start time, -t for duration, -vn to discard video, -acodec libmp3lame to ensure mp3 output
        cmd = [
            "ffmpeg", "-y", "-ss", str(start_seconds), "-i", media_path, 
            "-t", str(duration), "-vn", "-acodec", "libmp3lame", "-q:a", "2", output_path
        ]
        # Hide output
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        return os.path.exists(output_path)
    except subprocess.CalledProcessError:
        return False
    except Exception:
        return False


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
    from utilities.util_config import get_model_config
    if not model_name:
        model_name = get_model_config("audio_transcription")
    
    # Lazy load massive machine learning libraries only when executed
    import torch
    import whisperx
    from whisperx.diarize import DiarizationPipeline

    device_pref = get_model_config("device_preference")
    opt_pref = get_model_config("hardware_optimization")

    device = "cpu"
    if "GPU" in device_pref or (device_pref == "Auto-Detect" and torch.cuda.is_available()):
        device = "cuda" if torch.cuda.is_available() else "cpu"

    if "FP16" in opt_pref:
        compute_type = "float16"
    elif "INT8" in opt_pref:
        compute_type = "int8"
    else:
        compute_type = "float16" if device == "cuda" else "int8"

    def _status(msg: str, pct: int) -> None:
        if status_text:
            status_text.text(msg)
        if progress_bar:
            progress_bar.progress(pct)

    _status("Loading Whisper model weights…", 10)
    models_dir = os.path.join(CACHE_DIR, "models")
    
    is_moonshine = "moonshine" in model_name.lower()
    is_faster_whisper = model_name.startswith("Systran/faster-whisper-")
    is_whisperx = not (is_moonshine or is_faster_whisper)
    
    if is_moonshine:
        from transformers import pipeline
        _status("Loading Moonshine model weights…", 10)
        model = pipeline("automatic-speech-recognition", model=model_name, trust_remote_code=True, device=device)
    elif is_faster_whisper:
        from faster_whisper import WhisperModel
        _status("Loading Faster-Whisper model weights…", 10)
        model_path = os.path.join(models_dir, model_name)
        model = WhisperModel(model_path, device=device, compute_type=compute_type)
    else:
        _status("Loading Whisper model weights…", 10)
        actual_model_name = model_name.replace("whisper-", "") if model_name.startswith("whisper-") else model_name
        model = whisperx.load_model(actual_model_name, device, compute_type=compute_type, download_root=models_dir)

    _status("Transcribing audio stream…", 35)
    audio  = whisperx.load_audio(audio_path)
    
    if is_moonshine:
        res = model(audio_path, return_timestamps=True)
        segments_list = []
        for chunk in res.get("chunks", []):
            start, end = chunk.get("timestamp", (0.0, 0.0))
            if start is None: start = 0.0
            if end is None: end = start + 1.0
            segments_list.append({"start": start, "end": end, "text": chunk.get("text", "")})
        result = {"language": "en", "segments": segments_list}
    elif is_faster_whisper:
        segments_gen, info = model.transcribe(audio_path, beam_size=5)
        segments_list = [{"start": s.start, "end": s.end, "text": s.text} for s in segments_gen]
        result = {"language": info.language, "segments": segments_list}
    else:
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
        _status("Loading diarization pipeline...", 60)
        diarize_model_name = get_model_config("speaker_diarization")
        models_dir = os.path.join(CACHE_DIR, "models")
        # Initialize pipeline. If this fails (e.g., due to ToS not accepted on HF), let it throw!
        diarize_model = DiarizationPipeline(model_name=diarize_model_name, token=hf_token, device=device, cache_dir=models_dir)
        diarize_segments = diarize_model(audio)
        result = whisperx.assign_word_speakers(diarize_segments, result)

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


# NOTE: format_srt_time, format_ass_time, and rgba_to_ass_hex are now in
# util_time_format.py and re-exported at the top of this file for backward compatibility.


# ─────────────────────────────────────────────
#  Export builders
# ─────────────────────────────────────────────
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
