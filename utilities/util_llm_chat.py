import os
import json
import asyncio
import re
from utilities.util_config import load_all_config
from utilities.util_huggingface import load_hf_token
from utilities.util_store import get_data, set_data

CACHE_DIR = os.path.join(".", "cache", "llm_chat")

def load_tool_config() -> list:
    ai_settings = get_data("ai_settings") or {}
    return ai_settings.get("tools", ["web_search", "get_current_date"])

def save_tool_config(enabled_tools: list) -> bool:
    try:
        ai_settings = get_data("ai_settings") or {}
        ai_settings["tools"] = enabled_tools
        set_data("ai_settings", ai_settings)
        return True
    except Exception as e:
        print(f"Error saving tool config: {e}")
        return False

from utilities.util_ai_tools import ALL_TOOLS, filter_context_with_rag, summarize_text_with_bart

async def stream_chat(messages_json: str, token: str):
    import ollama
    
    try:
        messages = json.loads(messages_json)
    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'message': f'Invalid messages format: {e}'})}\n\n"
        return

    config = load_all_config()
    provider = config.get("obsidian_provider", "Hugging Face API")
    ollama_model = config.get("obsidian_ollama_model", "llama3:8b-instruct-q4_K_M")

    enabled_tools_keys = load_tool_config()
    active_tools = []
    for k in enabled_tools_keys:
        if k in ALL_TOOLS:
            active_tools.append(ALL_TOOLS[k]["schema"])

    if provider != "Ollama":
        yield f"data: {json.dumps({'type': 'error', 'message': 'Tool usage is currently only supported via Ollama in agentic mode. Please configure Ollama in Settings.'})}\n\n"
        return

    client = ollama.AsyncClient(host="http://localhost:11434")
    
    # We will do a loop to allow tool calling
    max_turns = 10
    
    for _ in range(max_turns):
        options = {"temperature": 0.7, "num_ctx": 4096}
        if "gemma4" in ollama_model.lower():
            options["temperature"] = 1.0
            options["top_p"] = 0.95
            options["top_k"] = 64
            # Inject think token if not present in system prompt
            if messages and messages[0].get("role") == "system":
                if "<|think|>" not in messages[0]["content"]:
                    messages[0]["content"] = "<|think|>\n" + messages[0]["content"]
            else:
                messages.insert(0, {"role": "system", "content": "<|think|>\n"})
                
        try:
            response = await client.chat(
                model=ollama_model,
                messages=messages,
                tools=active_tools if active_tools else None,
                stream=False,
                options=options
            )
            
            msg = response.get("message", {})
            
            if "gemma4" in ollama_model.lower() and "content" in msg:
                # Strip thinking content to maintain clean history per Gemma best practices
                msg["content"] = re.sub(r'<\|channel>thought\n.*?<channel\|>', '', msg["content"], flags=re.DOTALL).strip()
            
            tool_calls = msg.get("tool_calls", [])
            if not tool_calls and "{" in msg.get("content", ""):
                try:
                    start = msg["content"].find("{")
                    end = msg["content"].rfind("}") + 1
                    parsed = json.loads(msg["content"][start:end])
                    if "name" in parsed:
                        tool_calls = [{"function": parsed}]
                except:
                    pass
                    
            current_message = {
                "role": "assistant", 
                "content": msg.get("content", ""), 
                "tool_calls": tool_calls
            }
            
            if current_message["content"]:
                # Mask known Llama 3 bug where it repeats the exact same string twice without a space
                content_str = current_message["content"]
                length = len(content_str)
                if length > 20 and length % 2 == 0:
                    half = length // 2
                    if content_str[:half] == content_str[half:]:
                        current_message["content"] = content_str[:half]
                        
                # Yield the full content as a single token chunk
                yield f"data: {json.dumps({'type': 'token', 'content': current_message['content']})}\n\n"
                
            usage = {
                "prompt": response.get("prompt_eval_count", 0),
                "completion": response.get("eval_count", 0)
            }
            if usage["prompt"] > 0 or usage["completion"] > 0:
                yield f"data: {json.dumps({'type': 'usage', 'prompt_tokens': usage['prompt'], 'completion_tokens': usage['completion']})}\n\n"
                
            messages.append(current_message)
            
            if not current_message.get("tool_calls"):
                # No tools called, generation is complete
                break
                
            # Clear frontend chat bubble if tools are called, so intermediate thoughts are removed
            yield f"data: {json.dumps({'type': 'clear'})}\n\n"
            
            # Execute tool calls
            for tc in current_message["tool_calls"]:
                fn_name = tc.get("function", {}).get("name")
                args = tc.get("function", {}).get("arguments", {})
                
                yield f"data: {json.dumps({'type': 'status', 'message': f'Executing {fn_name}...'})}\n\n"
                
                if fn_name in ALL_TOOLS:
                    try:
                        res = await asyncio.to_thread(ALL_TOOLS[fn_name]["func"], **args)
                        
                        # Optionally apply RAG if result is huge, but let's just return it to keep it simple 
                        # for general chat, or we can use the same RAG logic from uoa
                        if fn_name in ["wikipedia_search", "arxiv_search", "web_search", "read_pdf", "verify_claim"]:
                            # RAG if too large (heuristic > 5000 chars)
                            if len(str(res)) > 5000:
                                yield f"data: {json.dumps({'type': 'status', 'message': f'Reranking {fn_name} results...'})}\n\n"
                                # We need a topic for RAG, use the last user message
                                last_user_msg = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
                                res = await asyncio.to_thread(filter_context_with_rag, last_user_msg, res)
                                
                                if config.get("obsidian_summarize_searches", "false") == "true":
                                    yield f"data: {{json.dumps({{'type': 'status', 'message': f'Summarizing {{fn_name}} results with BART'}})}}\n\n"
                                    max_words = int(config.get("obsidian_bart_max_words", 150))
                                    res = await asyncio.to_thread(summarize_text_with_bart, res, max_words)

                        messages.append({"role": "tool", "content": str(res), "name": fn_name})
                        yield f"data: {json.dumps({'type': 'status', 'message': f'Finished {fn_name}'})}\n\n"
                    except Exception as e:
                        messages.append({"role": "tool", "content": f"Error executing {fn_name}: {e}", "name": fn_name})
                else:
                    messages.append({"role": "tool", "content": f"Error: unknown tool {fn_name}", "name": fn_name})
                    
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Agent error: {e}'})}\n\n"
            break
            
    yield f"data: {json.dumps({'type': 'done'})}\n\n"
