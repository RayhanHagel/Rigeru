import numpy as np
import noisereduce as nr
import soundfile as sf
import os
import torch
import subprocess
import whisperx
from utilities.util_config import get_model_config

def apply_ai_noise_reduction(audio_path: str):
    # Load audio (whisperx uses ffmpeg under the hood, perfectly handling .webm)
    sr = 16000
    audio_data = whisperx.load_audio(audio_path)
    
    # Run Whisper base to get segments (VAD essentially)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    compute_type = "float16" if device == "cuda" else "int8"
    
    models_dir = os.path.join(".", "cache", "models")
    os.makedirs(models_dir, exist_ok=True)
    
    model = whisperx.load_model("base", device, compute_type=compute_type, download_root=models_dir)
    result = model.transcribe(audio_data, batch_size=8)
    
    segments = result.get("segments", [])
    
    # Calculate noise profile (gaps between speech)
    total_duration = len(audio_data) / sr
    
    noise_segments = []
    last_end = 0.0
    
    for seg in segments:
        start = seg["start"]
        end = seg["end"]
        if start > last_end:
            # We found a gap
            noise_segments.append((last_end, start))
        last_end = end
        
    if last_end < total_duration:
        noise_segments.append((last_end, total_duration))
        
    noise_audio = []
    for (start, end) in noise_segments:
        start_idx = int(start * sr)
        end_idx = int(end * sr)
        noise_audio.extend(audio_data[start_idx:end_idx])
        
    noise_audio = np.array(noise_audio)
    
    if len(noise_audio) < sr * 0.5: # less than 0.5 seconds of pure noise found
        # Fallback to general noise reduction without a specific profile
        reduced_audio = nr.reduce_noise(y=audio_data, sr=sr, stationary=True)
    else:
        # Use the specific noise profile
        reduced_audio = nr.reduce_noise(y=audio_data, sr=sr, y_noise=noise_audio, stationary=True)
        
    # Free memory
    del model
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        
    # Overwrite original
    temp_wav = audio_path + ".wav"
    sf.write(temp_wav, reduced_audio, sr)
    subprocess.run(["ffmpeg", "-y", "-i", temp_wav, audio_path], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.remove(temp_wav)
    
    return True
