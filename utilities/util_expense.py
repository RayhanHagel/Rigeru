import io
import os
import json
from PIL import Image
import streamlit as st

CACHE_DIR = os.path.join(".", "cache", "models")
os.makedirs(CACHE_DIR, exist_ok=True)


@st.cache_resource(show_spinner=False)
def load_qwen_receipt_model(optimization: str = "PyTorch"):
    """
    Lazy loads the Qwen2-VL model. This model has explicit 2D spatial awareness,
    making it perfect for tracking multi-column layouts in receipts.
    """
    # --- Lazy Load HF Token ---
    # Automatically loads the token from cache and sets it as an environment variable
    # so transformers and huggingface_hub use it automatically to bypass rate limits.
    if "HF_TOKEN" not in os.environ:
        hf_creds_path = os.path.join(".", "cache", "hf_creds.json")
        if os.path.exists(hf_creds_path):
            try:
                with open(hf_creds_path, "r") as f:
                    creds = json.load(f)
                    if "hf_token" in creds:
                        os.environ["HF_TOKEN"] = creds["hf_token"]
            except Exception as e:
                print(f"Warning: Failed to load HF token: {e}")

    import torch
    from transformers import AutoProcessor, Qwen2VLForConditionalGeneration

    # We use the base instruct model as it is highly capable of structured JSON output
    model_id = "Qwen/Qwen2-VL-2B-Instruct"
    device = "cuda" if torch.cuda.is_available() else "cpu"

    processor = AutoProcessor.from_pretrained(model_id, cache_dir=CACHE_DIR)

    if "INT8" in optimization and device == "cuda":
        try:
            from transformers import BitsAndBytesConfig
            quant_config = BitsAndBytesConfig(load_in_8bit=True)

            model = Qwen2VLForConditionalGeneration.from_pretrained(
                model_id,
                quantization_config=quant_config,
                device_map="auto",
                cache_dir=CACHE_DIR
            )
        except ImportError:
            st.warning("bitsandbytes not installed. Falling back to FP16.")
            model = Qwen2VLForConditionalGeneration.from_pretrained(
                model_id,
                torch_dtype=torch.float16,
                device_map="auto",
                cache_dir=CACHE_DIR
            )
    elif "FP16" in optimization and device == "cuda":
        model = Qwen2VLForConditionalGeneration.from_pretrained(
            model_id,
            torch_dtype=torch.float16,
            device_map="auto",
            cache_dir=CACHE_DIR
        )
    else:
        # Standard PyTorch (FP32)
        model = Qwen2VLForConditionalGeneration.from_pretrained(
            model_id,
            device_map="auto" if device == "cuda" else None,
            cache_dir=CACHE_DIR
        )

    return processor, model, device


def extract_receipt_data(image_bytes: bytes, optimization: str = "PyTorch") -> tuple[bool, dict | str]:
    try:
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode != "RGB":
            img = img.convert("RGB")
            
        # Optimization: Downscale to prevent O(N^2) VRAM explosion
        max_dim = 1024
        if max(img.size) > max_dim:
            img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
            
        processor, model, device = load_qwen_receipt_model(optimization)
        
        # System prompt forcing strict JSON output and column awareness
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": img},
                    {
                        "type": "text", 
                        "text": "Extract the data from this receipt. Pay close attention to columns to match items with their correct prices. "
                                "Return ONLY a valid JSON object with the following keys: "
                                "'date' (string), 'total' (string), and 'items' (an array of objects with 'name' and 'price')."
                    }
                ]
            }
        ]

        # Prepare inputs
        text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        
        # FIX: Pass the PIL image directly to the main processor 
        # instead of manually calling the inner image_processor
        inputs = processor(
            text=[text],
            images=[img],
            padding=True,
            return_tensors="pt"
        )
        inputs = inputs.to(device)

        # Generate response
        generated_ids = model.generate(**inputs, max_new_tokens=512)
        generated_ids_trimmed = [
            out_ids[len(in_ids):] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
        ]
        
        output_text = processor.batch_decode(
            generated_ids_trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False
        )[0]
        
        # Clean up the output text to parse the JSON
        # LLMs sometimes wrap JSON in markdown block ticks (```json ... ```)
        cleaned_output = output_text.strip()
        if cleaned_output.startswith("```json"):
            cleaned_output = cleaned_output[7:]
        if cleaned_output.startswith("```"):
            cleaned_output = cleaned_output[3:]
        if cleaned_output.endswith("```"):
            cleaned_output = cleaned_output[:-3]
            
        try:
            parsed_json = json.loads(cleaned_output.strip())
        except json.JSONDecodeError:
            return False, f"Failed to parse JSON. Raw output:\n{output_text}"

        return True, {
            "date": parsed_json.get("date", "Not Found"),
            "total": parsed_json.get("total", "Not Found"),
            "raw_text": json.dumps(parsed_json, indent=2) 
        }

    except Exception as e:
        return False, f"Error processing receipt: {str(e)}"