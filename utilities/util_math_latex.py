import json
import os
import streamlit as st
from PIL import Image

os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

def get_model_labels():
    """
    Returns a list of tested Hugging Face OCR models suitable for math extraction.
    """
    return [
        "breezedeus/pix2text-mfr",
        "prithivMLmods/Qwen2-VL-OCR-2B-Instruct"
    ]

def get_hf_token():
    """
    Reads the Hugging Face token securely from the local cache file.
    """
    creds_path = "./cache/hf_creds.json"
    if os.path.exists(creds_path):
        try:
            with open(creds_path, "r") as f:
                creds = json.load(f)
                return creds.get("hf_token", None)
        except Exception as e:
            print(f"Warning: Failed to load HF token: {e}")
            return None
    return None

@st.cache_resource(show_spinner=False)
def load_hf_model(model_id: str, device_preference: str):
    """
    Loads and caches the respective Hugging Face models based on the selected architecture.
    Imports are lazily loaded to prevent Streamlit cold-start freezes.
    Models are explicitly downloaded to ./cache/models.
    """
    # ─── LAZY IMPORTS ──────────────────────────────────────────────
    import torch
    from transformers import AutoProcessor, TrOCRProcessor, VisionEncoderDecoderModel
    
    try:
        from transformers import Qwen2VLForConditionalGeneration
    except ImportError:
        Qwen2VLForConditionalGeneration = None

    try:
        from optimum.onnxruntime import ORTModelForVision2Seq
        has_optimum = True
    except ImportError:
        has_optimum = False

    try:
        from transformers import BitsAndBytesConfig
        has_bnb = True
    except ImportError:
        has_bnb = False
    # ───────────────────────────────────────────────────────────────

    token = get_hf_token()
    is_onnx = False
    
    # Define the local cache directory for model weights
    CACHE_DIR = "./cache/models"
    os.makedirs(CACHE_DIR, exist_ok=True)
    
    # 1. Determine the execution device
    device = "cpu"
    if "GPU" in device_preference or (device_preference == "Auto-Detect" and torch.cuda.is_available()):
        device = "cuda" if torch.cuda.is_available() else "cpu"
        
    # 2. Load model & processor based on selection
    if model_id == "prithivMLmods/Qwen2-VL-OCR-2B-Instruct":
        if Qwen2VLForConditionalGeneration is None:
            raise ImportError("Qwen2VLForConditionalGeneration requires a newer version of transformers.")
        
        processor = AutoProcessor.from_pretrained(
            model_id, 
            token=token, 
            cache_dir=CACHE_DIR
        )
        
        # Optimization B: Memory Complexity via Flash Attention
        attn_impl = "flash_attention_2" if device == "cuda" else "eager"
        
        # Optimization C: Space Complexity via Quantization (8-bit)
        quant_config = None
        if has_bnb and device == "cuda":
            quant_config = BitsAndBytesConfig(load_in_8bit=True)
            
        model = Qwen2VLForConditionalGeneration.from_pretrained(
            model_id, 
            token=token,
            cache_dir=CACHE_DIR,
            torch_dtype=torch.bfloat16 if device == "cuda" else torch.float32,
            attn_implementation=attn_impl,
            quantization_config=quant_config,
            device_map="auto" if quant_config else None
        )
        
        if not quant_config:
            model = model.to(device)
            
        return processor, model, device, is_onnx
        
    elif model_id == "breezedeus/pix2text-mfr":
        processor = TrOCRProcessor.from_pretrained(
            model_id, 
            token=token, 
            cache_dir=CACHE_DIR
        )
        
        if has_optimum:
            # Method using the recommended ONNX runtime for optimized performance
            model = ORTModelForVision2Seq.from_pretrained(
                model_id, 
                use_cache=False, 
                use_merged=False,                             # Tells Optimum not to look for merged past key values
                decoder_file_name="decoder_model.onnx",       # Explicitly points to the existing file
                token=token, 
                cache_dir=CACHE_DIR
            )
            is_onnx = True
        else:
            # Fallback natively to PyTorch backend
            model = VisionEncoderDecoderModel.from_pretrained(
                model_id, 
                token=token, 
                cache_dir=CACHE_DIR
            ).to(device)
            
        return processor, model, device, is_onnx

    raise ValueError("Unsupported model selection.")

def process_math_image(image: Image.Image, model_id: str, device_preference: str):
    """
    Processes a cropped PIL image through the OCR model and returns the LaTeX output.
    Returns: (bool success, str result_or_error)
    """
    try:
        # Load (or grab from cache) the model and flags
        processor, model, device, is_onnx = load_hf_model(model_id, device_preference)
        
        # Ensure image is strictly RGB format
        if image.mode != "RGB":
            image = image.convert("RGB")
            
        # Optimization A: Optimize Sequence Length N (Image Resizing)
        max_dim = 1024
        if image.width > max_dim or image.height > max_dim:
            image.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
            
        if model_id == "prithivMLmods/Qwen2-VL-OCR-2B-Instruct":
            prompt = "<|im_start|>user\n<|vision_start|><|image_pad|><|vision_end|>\nExtract the mathematical formulas and convert to LaTeX.<|im_end|>\n<|im_start|>assistant\n"
            
            inputs = processor(
                text=[prompt], 
                images=[image], 
                padding=True, 
                return_tensors="pt"
            ).to(device)
            
            generated_ids = model.generate(**inputs, max_new_tokens=512)
            
            generated_ids_trimmed = [
                out_ids[len(in_ids):] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
            ]
            generated_text = processor.batch_decode(
                generated_ids_trimmed, 
                skip_special_tokens=True, 
                clean_up_tokenization_spaces=False
            )[0]
            
        elif model_id == "breezedeus/pix2text-mfr":
            pixel_values = processor(images=image, return_tensors="pt").pixel_values
            
            # If using ONNX, it handles its own device placement. Otherwise, push to GPU/CPU.
            if not is_onnx:
                pixel_values = pixel_values.to(device)
            
            generated_ids = model.generate(pixel_values)
            generated_text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
        
        cleaned_text = generated_text.strip()
        
        if cleaned_text.startswith("\\[") and cleaned_text.endswith("\\]"):
            cleaned_text = cleaned_text[2:-2].strip()
        elif cleaned_text.startswith("$$") and cleaned_text.endswith("$$"):
            cleaned_text = cleaned_text[2:-2].strip()
        elif cleaned_text.startswith("$") and cleaned_text.endswith("$"):
            cleaned_text = cleaned_text[1:-1].strip()
            
        return True, cleaned_text
        
    except Exception as e:
        return False, str(e)