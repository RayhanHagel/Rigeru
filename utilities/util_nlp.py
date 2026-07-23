import os
from transformers import pipeline
from utilities.util_config import load_all_config

CACHE_DIR = os.path.join(".", "cache", "hf_cache")

_translation_pipelines = {}

def get_translation_model_id() -> str:
    # Get model from config or default
    config = load_all_config().get("models", {})
    return config.get("translation", "facebook/nllb-200-distilled-600M")

def load_translation_pipeline(model_id: str):
    global _translation_pipelines
    if model_id not in _translation_pipelines:
        print(f"Loading NLP translation pipeline for {model_id}...")
        # Device map auto will use GPU if available, else CPU
        # But we also have global compute engine config. For simplicity, let pipeline infer.
        config = load_all_config().get("models", {})
        device_pref = config.get("device_preference", "Auto-Detect")
        
        device = -1 # CPU
        if device_pref != "CPU Only":
            import torch
            if torch.cuda.is_available():
                device = 0
                
        hf_cache_dir = CACHE_DIR
        os.environ["HF_HOME"] = hf_cache_dir
        
        # Load the pipeline
        try:
            if "nllb" in model_id.lower():
                import ctranslate2
                import transformers
                import torch
                
                device_str = "cuda" if device == 0 else "cpu"
                
                output_dir = os.path.join(hf_cache_dir, "models", f"{model_id.replace('/', '-')}-int8")
                if not os.path.exists(output_dir):
                    print(f"Converting {model_id} to ctranslate2 int8 format...")
                    os.makedirs(os.path.join(hf_cache_dir, "models"), exist_ok=True)
                    converter = ctranslate2.converters.TransformersConverter(model_id)
                    converter.convert(output_dir=output_dir, quantization="int8")
                    
                translator = ctranslate2.Translator(output_dir, device=device_str, compute_type="int8")
                tokenizer = transformers.AutoTokenizer.from_pretrained(model_id)
                _translation_pipelines[model_id] = (translator, tokenizer)
            else:
                task_name = "text2text-generation"
                pipe = pipeline(
                    task_name, 
                    model=model_id,
                    device=device,
                    model_kwargs={"cache_dir": hf_cache_dir}
                )
                _translation_pipelines[model_id] = pipe
        except Exception as e:
            print(f"Error loading translation model: {e}")
            raise e
            
    return _translation_pipelines[model_id]

import json

def get_nllb_lang_map() -> dict:
    """Returns a mapping of Human Readable Name -> Flores-200 code"""
    json_path = os.path.join(".", "utilities", "nllb_languages.json")
    if not os.path.exists(json_path):
        return {"English": "eng_Latn", "French": "fra_Latn"}
    
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    # The JSON maps code -> Name, we need Name -> code for lookup
    return {name: code for code, name in data.items()}

def translate_text(text: str, source_lang: str, target_lang: str, model_id: str = None) -> str:
    if not model_id:
        model_id = get_translation_model_id()
        
    pipe = load_translation_pipeline(model_id)
    
    if "nllb" in model_id.lower():
        translator, tokenizer = pipe
        lang_map = get_nllb_lang_map()
        src = lang_map.get(source_lang, "eng_Latn")
        tgt = lang_map.get(target_lang, "fra_Latn")
        
        out = []
        for line in text.split("\n"):
            if not line.strip():
                out.append("")
                continue
            tokenizer.src_lang = src
            source = tokenizer.convert_ids_to_tokens(tokenizer.encode(line))
            results = translator.translate_batch(
                [source],
                target_prefix=[[tgt]],
                beam_size=4,
                max_decoding_length=1024,
            )
            target_tokens = results[0].hypotheses[0][1:]
            out.append(tokenizer.decode(tokenizer.convert_tokens_to_ids(target_tokens)))
            
        return "\n".join(out)
    else:
        # T5 models expect prompts like "translate English to German: How are you?"
        prompt = f"translate {source_lang} to {target_lang}: {text}"
        result = pipe(prompt, max_length=1024)
        if result and len(result) > 0 and 'generated_text' in result[0]:
            return result[0]['generated_text'].strip()
            
    return ""
