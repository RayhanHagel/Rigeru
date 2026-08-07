import os
from functools import lru_cache
from PIL import Image
import torch
import gc
from utilities.util_huggingface import load_hf_token
from utilities.util_config import get_model_config

os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

def get_model_labels():
    """
    Returns a list of tested Hugging Face OCR models suitable for math extraction.
    """
    return [
        "stepfun-ai/GOT-OCR2_0",
        "ATH-MaaS/OvisOCR2",
        "baidu/Unlimited-OCR",
        "breezedeus/pix2text-mfr",
        "prithivMLmods/Qwen2-VL-OCR-2B-Instruct"
    ]


@lru_cache(maxsize=2)
def load_hf_model(model_id: str):
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

    token = load_hf_token() or None
    is_onnx = False
    
    # Define the local cache directory for model weights
    CACHE_DIR = "./cache/models"
    os.makedirs(CACHE_DIR, exist_ok=True)
    
    # 1. Determine the execution device
    device_preference = get_model_config("device_preference")
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
            cache_dir=CACHE_DIR,
            use_fast=False
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
            dtype=torch.bfloat16 if device == "cuda" else torch.float32,
            attn_implementation=attn_impl,
            quantization_config=quant_config,
            device_map="auto" if quant_config else None
        )
        
        if not quant_config:
            model = model.to(device)
            
        return processor, model, device, is_onnx
        
    elif model_id == "stepfun-ai/GOT-OCR2_0":
        from transformers import AutoModel, AutoTokenizer
        
        processor = AutoTokenizer.from_pretrained(
            model_id, 
            trust_remote_code=True, 
            token=token, 
            cache_dir=CACHE_DIR
        )
        model = AutoModel.from_pretrained(
            model_id, 
            trust_remote_code=True, 
            token=token, 
            cache_dir=CACHE_DIR,
            device_map="auto" if device == "cuda" else None,
            low_cpu_mem_usage=True,
            use_safetensors=True,
            pad_token_id=processor.eos_token_id
        )
        if device == "cuda" and not getattr(model, "hf_device_map", None):
            model = model.to(device)
        model = model.eval()
        
        return processor, model, device, False
        
    elif model_id == "ATH-MaaS/OvisOCR2":
        from transformers import AutoModelForCausalLM, AutoTokenizer
        processor = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True, token=token, cache_dir=CACHE_DIR)
        model = AutoModelForCausalLM.from_pretrained(
            model_id, 
            trust_remote_code=True, 
            token=token, 
            cache_dir=CACHE_DIR,
            device_map="auto" if device == "cuda" else "cpu"
        ).eval()
        return processor, model, device, False
        
    elif model_id == "baidu/Unlimited-OCR":
        from transformers import AutoModel, AutoTokenizer
        processor = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True, token=token, cache_dir=CACHE_DIR)
        model = AutoModel.from_pretrained(
            model_id, 
            trust_remote_code=True, 
            token=token, 
            cache_dir=CACHE_DIR,
            use_safetensors=True
        )
        if device == "cuda":
            model = model.cuda()
        model = model.eval()
        return processor, model, device, False
        
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

def process_math_image(image_bytes: bytes):
    """
    Processes image bytes through the OCR model and returns the LaTeX output.
    Returns: (bool success, str result_or_error)
    """
    try:
        import io
        from PIL import Image
        image = Image.open(io.BytesIO(image_bytes))
        
        model_id = get_model_config("math_latex")
        
        # Load (or grab from cache) the model and flags
        processor, model, device, is_onnx = load_hf_model(model_id)
        
        # Ensure image is strictly RGB format
        if image.mode != "RGB":
            image = image.convert("RGB")
            
        # Optimization A: Optimize Sequence Length N (Image Resizing)
        max_dim = 1024
        if image.width > max_dim or image.height > max_dim:
            image.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
            
        if model_id == "stepfun-ai/GOT-OCR2_0":
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                image.save(tmp.name)
                tmp_path = tmp.name
                
            try:
                # processor is the tokenizer for GOT-OCR
                res = model.chat(processor, tmp_path, ocr_type='format')
            finally:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
                    
            return True, res
            
        elif model_id == "ATH-MaaS/OvisOCR2":
            prompt = '\\nExtract all readable content from the image in natural human reading order and output the result as a single Markdown document. Format formulas as LaTeX. Format tables as HTML: <table>...</table>. Transcribe all other text as standard Markdown. Preserve the original text without translation or paraphrasing.'
            inputs = processor(text=prompt, images=image, return_tensors="pt")
            if device == "cuda":
                inputs = inputs.to("cuda")
            generated_ids = model.generate(**inputs, max_new_tokens=4096)
            res = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
            return True, res
            
        elif model_id == "baidu/Unlimited-OCR":
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                image.save(tmp.name)
                tmp_path = tmp.name
                
            try:
                res = model.infer(
                    tokenizer=processor,
                    image_file=tmp_path,
                    prompt="Extract all text and mathematical formulas into LaTeX format.",
                    output_path=os.path.dirname(tmp_path)
                )
            finally:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
            return True, res
            
        elif model_id == "prithivMLmods/Qwen2-VL-OCR-2B-Instruct":
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
        import traceback
        traceback.print_exc()
        return False, str(e)