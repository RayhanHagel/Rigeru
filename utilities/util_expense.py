import io
import os
import json
import logging
from PIL import Image
from functools import lru_cache
from utilities.util_huggingface import load_hf_token
from utilities.util_config import get_model_config

CACHE_DIR = os.path.join(".", "cache", "models")
os.makedirs(CACHE_DIR, exist_ok=True)


@lru_cache(maxsize=2)
def load_receipt_model():
    """
    Lazy loads the configured model (Qwen2-VL or Donut).
    """
    # --- Lazy Load HF Token ---
    # Automatically loads the token from cache and sets it as an environment variable
    # so transformers and huggingface_hub use it automatically to bypass rate limits.
    if "HF_TOKEN" not in os.environ:
        token = load_hf_token()
        if token:
            os.environ["HF_TOKEN"] = token

    import torch

    # We use the configured vision model
    model_id = get_model_config("expense_tracker")
    device = "cuda" if torch.cuda.is_available() else "cpu"

    if "donut" in model_id.lower():
        from transformers import DonutProcessor, VisionEncoderDecoderModel
        processor = DonutProcessor.from_pretrained(model_id, cache_dir=CACHE_DIR)
        model = VisionEncoderDecoderModel.from_pretrained(model_id, cache_dir=CACHE_DIR)
        if device == "cuda":
            model.to("cuda")
        return processor, model, device, "donut"

    from transformers import AutoProcessor, Qwen2VLForConditionalGeneration
    processor = AutoProcessor.from_pretrained(model_id, cache_dir=CACHE_DIR, use_fast=False)

    optimization = get_model_config("hardware_optimization")

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
            logging.warning("bitsandbytes not installed. Falling back to FP16.")
            model = Qwen2VLForConditionalGeneration.from_pretrained(
                model_id,
                dtype=torch.float16,
                device_map="auto",
                cache_dir=CACHE_DIR
            )
    elif "FP16" in optimization and device == "cuda":
        model = Qwen2VLForConditionalGeneration.from_pretrained(
            model_id,
            dtype=torch.float16,
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

    return processor, model, device, "qwen"


def extract_receipt_data(image_bytes: bytes) -> tuple[bool, dict | str]:
    try:
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode != "RGB":
            img = img.convert("RGB")
            
        # Optimization: Downscale to prevent O(N^2) VRAM explosion
        max_dim = 1024
        if max(img.size) > max_dim:
            img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
            
        processor, model, device, model_type = load_receipt_model()
        
        if model_type == "donut":
            import torch
            import re
            
            # Prepare Donut inputs
            pixel_values = processor(img, return_tensors="pt").pixel_values
            task_prompt = "<s_cord-v2>"
            decoder_input_ids = processor.tokenizer(task_prompt, add_special_tokens=False, return_tensors="pt").input_ids
            
            # Generate Donut output
            outputs = model.generate(
                pixel_values.to(device),
                decoder_input_ids=decoder_input_ids.to(device),
                max_length=model.decoder.config.max_position_embeddings,
                pad_token_id=processor.tokenizer.pad_token_id,
                eos_token_id=processor.tokenizer.eos_token_id,
                use_cache=True,
                bad_words_ids=[[processor.tokenizer.unk_token_id]],
                return_dict_in_generate=True,
            )
            
            sequence = processor.batch_decode(outputs.sequences)[0]
            sequence = sequence.replace(processor.tokenizer.eos_token, "").replace(processor.tokenizer.pad_token, "")
            # Remove first task start token
            sequence = re.sub(r"<.*?>", "", sequence, count=1).strip()
            parsed_json = processor.token2json(sequence)
            
            # Donut does not have standard 'total' and 'date' keys for CORD, try to extract them
            total_val = "Not Found"
            if isinstance(parsed_json, dict):
                total_obj = parsed_json.get("total")
                if isinstance(total_obj, dict):
                    total_val = total_obj.get("total_price", total_obj.get("cashprice", "Not Found"))
                elif isinstance(total_obj, list) and len(total_obj) > 0 and isinstance(total_obj[0], dict):
                    total_val = total_obj[0].get("total_price", total_obj[0].get("cashprice", "Not Found"))
                    
            date_val = "Not Found"
            # CORD sometimes puts date under validating -> datetime
            
            return True, {
                "date": date_val,
                "total": str(total_val),
                "raw_text": json.dumps(parsed_json, indent=2)
            }
        
        # --- Qwen2-VL Flow ---
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