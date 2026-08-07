import os
import os
# Suppress verbose transformers warnings (Whisper/tokenizers) which are expected in OmniVoice
os.environ["TRANSFORMERS_VERBOSITY"] = "error"

import warnings
# Suppress the non-fatal torchaudio warning about torchcodec not being loadable
# (torchcodec requires FFmpeg DLLs bundled with it; we don't use it directly)
warnings.filterwarnings("ignore", message=".*torchcodec.*", category=UserWarning)
warnings.filterwarnings("ignore", message=".*libtorchcodec.*")
import json
import shutil
import soundfile as sf

# Global variable to cache the OmniVoice model in memory
_tts_model = None

# Directory where saved voice embeddings are stored
VOICES_DIR = os.path.join(".", "cache", "voices")

def get_tts_model():
    global _tts_model

    if _tts_model is not None:
        return _tts_model

    try:
        import torch
        from omnivoice import OmniVoice
    except ImportError:
        raise RuntimeError(
            "omnivoice package is not installed. Please install it by running:\n\n"
            "pip install omnivoice"
        )

    # Set the HF token from saved credentials so from_pretrained is authenticated
    # and won't print auth warnings or hit rate limits.
    if not os.environ.get("HF_TOKEN"):
        try:
            from utilities.util_huggingface import load_hf_token
            token = load_hf_token()
            if token:
                os.environ["HF_TOKEN"] = token
        except Exception:
            pass  # Token not required for public models; continue without it

    device_map = "cuda:0" if torch.cuda.is_available() else "cpu"
    dtype = torch.float16 if device_map != "cpu" else torch.float32

    try:
        print(f"Loading OmniVoice model on {device_map}...")
        try:
            # Try local cache first — no network round-trip if already downloaded
            _tts_model = OmniVoice.from_pretrained(
                "k2-fsa/OmniVoice",
                device_map=device_map,
                dtype=dtype,
                local_files_only=True,
            )
        except Exception:
            # Not yet cached — download from HuggingFace
            _tts_model = OmniVoice.from_pretrained(
                "k2-fsa/OmniVoice",
                device_map=device_map,
                dtype=dtype,
            )
        print("OmniVoice model loaded successfully.")
    except Exception as e:
        raise RuntimeError(f"Failed to load OmniVoice model: {str(e)}")

    return _tts_model


# ---------------------------------------------------------------------------
# Saved voices (session reuse)
# ---------------------------------------------------------------------------

def _voice_dir(voice_id: str) -> str:
    return os.path.join(VOICES_DIR, voice_id)

def list_saved_voices() -> list[dict]:
    """Return a list of saved voices with their id and metadata."""
    if not os.path.exists(VOICES_DIR):
        return []
    voices = []
    for name in os.listdir(VOICES_DIR):
        meta_path = os.path.join(VOICES_DIR, name, "meta.json")
        if os.path.isfile(meta_path):
            try:
                with open(meta_path, 'r', encoding='utf-8') as f:
                    meta = json.load(f)
                voices.append({"id": name, **meta})
            except Exception:
                pass
    return sorted(voices, key=lambda v: v.get("created_at", ""), reverse=True)

def save_voice(voice_id: str, ref_audio_path: str, ref_text: str, display_name: str) -> None:
    """
    Save a reference audio clip, its transcript, and a pre-computed voice clone prompt
    as a named voice for later reuse.
    """
    import time
    voice_dir = _voice_dir(voice_id)
    os.makedirs(voice_dir, exist_ok=True)

    ext = os.path.splitext(ref_audio_path)[1] or ".wav"
    dest_audio = os.path.join(voice_dir, f"ref{ext}")
    shutil.copy2(ref_audio_path, dest_audio)

    # Create and save the voice clone prompt to skip encoding in future sessions
    model = get_tts_model()
    kwargs = dict(ref_audio=ref_audio_path)
    if ref_text:
        kwargs["ref_text"] = ref_text
    prompt = model.create_voice_clone_prompt(**kwargs)
    prompt_path = os.path.join(voice_dir, "prompt.pt")
    prompt.save(prompt_path)

    meta = {
        "display_name": display_name,
        "ref_audio": dest_audio,
        "ref_text": ref_text,
        "prompt_file": prompt_path,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    with open(os.path.join(voice_dir, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

def delete_voice(voice_id: str) -> None:
    """Delete a saved voice by its id."""
    voice_dir = _voice_dir(voice_id)
    if os.path.isdir(voice_dir):
        shutil.rmtree(voice_dir)
    else:
        raise FileNotFoundError(f"Voice '{voice_id}' not found.")

def load_voice(voice_id: str) -> dict:
    """Load metadata for a saved voice. Returns dict with ref_audio and ref_text."""
    meta_path = os.path.join(_voice_dir(voice_id), "meta.json")
    if not os.path.isfile(meta_path):
        raise FileNotFoundError(f"Voice '{voice_id}' not found.")
    with open(meta_path, "r", encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Generation helpers
# ---------------------------------------------------------------------------

def generate_cloned_speech(
    text: str,
    reference_audio_path: str,
    output_path: str,
    ref_text: str = "",
) -> str:
    """
    Generates speech using Voice Cloning via OmniVoice.

    Args:
        text: The text to synthesize. Supports non-verbal markers like [laughter],
              and phoneme/pinyin pronunciation hints.
        reference_audio_path: Path to a short reference audio clip.
        output_path: Where to save the generated .wav file.
        ref_text: Optional transcription of the reference audio.
                  If omitted, OmniVoice will use Whisper ASR to auto-transcribe it.
    """
    if not text.strip():
        raise ValueError("Text cannot be empty.")
    if not os.path.exists(reference_audio_path):
        raise FileNotFoundError(f"Reference audio file not found: {reference_audio_path}")

    model = get_tts_model()

    kwargs = dict(text=text, ref_audio=reference_audio_path)
    if ref_text:
        kwargs["ref_text"] = ref_text
    # If ref_text is empty, OmniVoice auto-transcribes via Whisper ASR

    audio = model.generate(**kwargs)
    sf.write(output_path, audio[0], 24000)
    return output_path


def generate_cloned_speech_from_saved(
    text: str,
    voice_id: str,
    output_path: str,
) -> str:
    """
    Generate speech using a previously saved voice (session reuse).
    Loads the pre-computed voice clone prompt from the saved voice directory.
    """
    try:
        from omnivoice import VoiceClonePrompt
    except ImportError:
        raise RuntimeError("omnivoice package is not installed.")
        
    voice_meta = load_voice(voice_id)
    prompt_path = os.path.join(_voice_dir(voice_id), "prompt.pt")
    
    if os.path.exists(prompt_path):
        prompt = VoiceClonePrompt.load(prompt_path)
        model = get_tts_model()
        audio = model.generate(text=text, voice_clone_prompt=prompt)
        sf.write(output_path, audio[0], 24000)
        return output_path
    else:
        # Fallback for voices saved before we added prompt saving
        return generate_cloned_speech(
            text=text,
            reference_audio_path=voice_meta["ref_audio"],
            output_path=output_path,
            ref_text=voice_meta.get("ref_text", ""),
        )


def generate_voice_design(
    text: str,
    output_path: str,
    speaker_attributes: str,
) -> str:
    """
    Generates speech using Voice Design mode — no reference audio needed.
    Instead, describe the voice using natural language attributes.

    Args:
        text: The text to synthesize.
        output_path: Where to save the generated .wav file.
        speaker_attributes: Natural-language description of the desired voice,
            e.g. "A young female speaker with a high-pitched voice and a British accent."
    """
    if not text.strip():
        raise ValueError("Text cannot be empty.")
    if not speaker_attributes.strip():
        raise ValueError("Speaker attributes cannot be empty.")

    model = get_tts_model()

    audio = model.generate(
        text=text,
        speaker=speaker_attributes,
    )
    sf.write(output_path, audio[0], 24000)
    return output_path

def format_audio_for_tts(input_path: str, output_path: str) -> None:
    """
    Converts audio to a clean 24kHz mono WAV format suitable for OmniVoice TTS cloning.
    """
    from pydub import AudioSegment
    audio_seg = AudioSegment.from_file(input_path)
    audio_seg = audio_seg.set_frame_rate(24000).set_channels(1).set_sample_width(2)
    audio_seg.export(output_path, format="wav")
