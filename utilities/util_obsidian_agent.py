import os
import os
import json
import re
import time

from bs4 import BeautifulSoup
from huggingface_hub import InferenceClient
from utilities.util_huggingface import load_hf_token
import asyncio

CACHE_DIR = os.path.join(".", "cache", "obsidian_vaults")

def sanitize_filename(filename: str) -> str:
    """Removes invalid characters for Windows filenames."""
    return re.sub(r'[\\/*?:"<>|]', "", filename).strip()

from utilities.util_ai_tools import *

def optimize_query(topic: str, root_topic: str, hf_token: str) -> str:
    """Uses LLM to generate an optimized search query."""
    config = load_all_config()
    provider = config.get("obsidian_provider", "Hugging Face API")
    ollama_model = config.get("obsidian_ollama_model", "llama3:8b-instruct-q4_K_M")
    
    prompt = f"I need to research the sub-topic '{topic}' which is related to the main topic '{root_topic}'. Generate a highly optimized search engine query to find the most comprehensive academic and historical overviews about '{topic}' specifically in the context of '{root_topic}'. ONLY output the search query itself, nothing else. Do not use quotes."
    
    try:
        if provider == "Ollama":
            client = ollama.Client(host="http://localhost:11434", timeout=None)
            response = client.chat(
                model=ollama_model,
                messages=[{"role": "user", "content": prompt}],
                options={"temperature": 0.3, "num_predict": 50}
            )
            return response.get("message", {}).get("content", "").strip('"\'\n ')
        else:
            client = InferenceClient(model="meta-llama/Meta-Llama-3-8B-Instruct", token=hf_token, timeout=None)
            response = client.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                max_tokens=50,
                temperature=0.3
            )
            return response.choices[0].message.content.strip('"\'\n ')
    except Exception as e:
        print(f"Error optimizing query for {topic}: {e}")
        return topic # fallback to original topic

def generate_markdown(topic: str, root_topic: str, context: str, hf_token: str, existing_nodes: set = None) -> tuple[str, list, dict]:
    """Uses LLM to generate Markdown and extract linked topics based on settings."""
    config = load_all_config()
    provider = config.get("obsidian_provider", "Hugging Face API")
    
    agent_model = config.get("obsidian_ollama_model", "llama3:8b-instruct-q4_K_M")
    ollama_model = config.get("obsidian_ollama_generator_model", agent_model)
    if not ollama_model.strip():
        ollama_model = agent_model
    
    existing_str = ", ".join(list(existing_nodes)) if existing_nodes else "None"
    
    prompt = f"""You are an expert knowledge curator building an Obsidian markdown vault about the main topic "{root_topic}".
Write a highly detailed, comprehensive, and structured guide about the specific sub-topic "{topic}".
    
Use the following context as your primary source of information:
{context}

Requirements for your response:
1. Format your response entirely in Markdown (use #, ##, ###, bullet points, bold text, etc.).
2. Break the topic down into multiple logical sections (e.g., Introduction, Core Concepts, History, Applications, etc.) and write thoroughly about each.
3. Be as detailed and comprehensive as possible. Do not summarize briefly; expand on the ideas found in the context.
4. CRITICAL LINKING REQUIREMENT: At the end of the document, BEFORE the References section, you MUST create a "## Related Topics" section. In this section, provide a bulleted list of exactly 5 to 10 NEW, distinct concepts related to this topic, wrapped in double brackets. Example:
   ## Related Topics
   * [[First Concept]]
   * [[Second Concept]]
   If you fail to include this section with double-bracketed links, the knowledge graph will break and fail to expand.
5. CRITICAL GRAPH-AWARENESS: To prevent duplicate pages, you must strongly prefer linking to these existing topics if they fit your context:
   EXISTING TOPICS: {existing_str}
   IMPORTANT: DO NOT create a link to the current topic ("{topic}"). You must create links to NEW concepts!
6. Do not use brackets for anything else. 
7. Do not include introductory filler like "Here is a guide". Just output the markdown directly.
8. MUST INCLUDE REFERENCES: At the very end of your markdown, you MUST add a "## References" section. Look through the provided context and list all the sources you used (e.g. Wikipedia titles, URLs, authors, YouTube videos, document names). Be specific about where the facts came from.
"""
    
    try:
        if provider == "Ollama":
            context_length = int(config.get("obsidian_context_length", 8192))
            
            messages = []
            options = {"temperature": 0.7, "num_predict": 4000, "num_ctx": context_length}
            
            if "gemma4" in ollama_model.lower():
                messages.append({"role": "system", "content": "<|think|>"})
                options["temperature"] = 1.0
                options["top_p"] = 0.95
                options["top_k"] = 64
                
            messages.append({"role": "user", "content": prompt})

            # Setting timeout=None disables the timeout entirely
            client = ollama.Client(host="http://localhost:11434", timeout=None)
            response = client.chat(
                model=ollama_model,
                messages=messages,
                options=options
            )
            content = response.get("message", {}).get("content", "")
            usage = {
                "prompt": response.get("prompt_eval_count", 0),
                "completion": response.get("eval_count", 0)
            }
            
            if "gemma4" in ollama_model.lower():
                content = re.sub(r'<\|channel>thought\n.*?<channel\|>', '', content, flags=re.DOTALL)
                content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()
        else:
            # Fallback to Hugging Face
            client = InferenceClient(model="meta-llama/Meta-Llama-3-8B-Instruct", token=hf_token, timeout=None)
            response = client.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                max_tokens=4000,
                temperature=0.7
            )
            content = response.choices[0].message.content
            usage = {
                "prompt": response.usage.prompt_tokens if hasattr(response, 'usage') else 0,
                "completion": response.usage.completion_tokens if hasattr(response, 'usage') else 0
            }
        
        # Extract [[links]]
        links = re.findall(r'\[\[(.*?)\]\]', content)
        links = [sanitize_filename(link) for link in links if sanitize_filename(link)]
        links = list(set(links))
        
        # Fallback if the model completely ignored linking instructions
        if not links:
            try:
                import json
                fallback_prompt = "Generate a JSON list of 5 new, distinct related topics based on the above text. Output ONLY the JSON list of strings (e.g. [\"Topic 1\", \"Topic 2\"]). Do not output anything else."
                if provider == "Ollama":
                    fb_msgs = [{"role": "user", "content": content[:2000] + "\n\n" + fallback_prompt}]
                    fb_res = client.chat(model=ollama_model, messages=fb_msgs, options={"temperature": 0.3, "num_predict": 100})
                    fb_content = fb_res.get("message", {}).get("content", "")
                    if "gemma4" in ollama_model.lower():
                        fb_content = re.sub(r'<\|channel>thought\n.*?<channel\|>', '', fb_content, flags=re.DOTALL)
                        fb_content = re.sub(r'<think>.*?</think>', '', fb_content, flags=re.DOTALL).strip()
                else:
                    fb_res = client.chat_completion(messages=[{"role": "user", "content": content[:2000] + "\n\n" + fallback_prompt}], max_tokens=100, temperature=0.3)
                    fb_content = fb_res.choices[0].message.content
                
                match = re.search(r'\[.*?\]', fb_content, flags=re.DOTALL)
                if match:
                    fb_links = json.loads(match.group(0))
                    links = [sanitize_filename(l) for l in fb_links if sanitize_filename(l)]
                    links = list(set(links))
                    if links:
                        content += "\n\n## Related Topics\n" + "\n".join([f"* [[{l}]]" for l in links])
            except Exception as e:
                print(f"Fallback link generation error: {e}")

        return content, links, usage
    except Exception as e:
        print(f"Generation error for {topic}: {e}")
        return f"# {topic}\n\nError generating content: {e}", [], {"prompt": 0, "completion": 0}

import asyncio
import json

async def run_agentic_research(topic: str, root_topic: str, visited: set, token: str, vault_dir: str):
    from utilities.util_config import load_all_config
    import ollama
    
    config = load_all_config()
    provider = config.get("obsidian_provider", "Hugging Face API")
    ollama_model = config.get("obsidian_ollama_model", "llama3:8b-instruct-q4_K_M")
    
    if provider != "Ollama":
        # Fallback to linear flow if not Ollama
        yield {'type': 'status', 'message': f'Agentic mode only supports Ollama. Falling back to linear search for {topic}...'}
        import utilities.util_ai_tools as uoa
        opt_q = await asyncio.to_thread(uoa.optimize_query, topic, root_topic, token)
        urls = await asyncio.to_thread(uoa.get_search_results, opt_q)
        texts = []
        for url in urls:
            t = await asyncio.to_thread(uoa.fetch_url_text, url)
            texts.append(t)
        combined = "\n\n".join(texts)
        filtered = await asyncio.to_thread(filter_context_with_rag, topic, combined)
        if config.get("obsidian_summarize_searches", "false") == "true":
            yield {'type': 'status', 'message': 'Summarizing context with BART'}
            max_words = int(config.get("obsidian_bart_max_words", 150))
            filtered = await asyncio.to_thread(summarize_text_with_bart, filtered, max_words)
        yield {'type': 'result', 'context': filtered}
        return

    # Agentic flow
    tools_list = [
        {
            "type": "function",
            "function": {
                "name": "wikipedia_search",
                "description": "Search Wikipedia for factual summaries.",
                "parameters": {
                    "type": "object",
                    "properties": {"query": {"type": "string"}},
                    "required": ["query"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "arxiv_search",
                "description": "Search arXiv for academic and scientific papers.",
                "parameters": {
                    "type": "object",
                    "properties": {"query": {"type": "string"}},
                    "required": ["query"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "web_search",
                "description": "Search the live web for general information or current events.",
                "parameters": {
                    "type": "object",
                    "properties": {"query": {"type": "string"}},
                    "required": ["query"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "scrape_page",
                "description": "Fetch the full readable text of a specific URL.",
                "parameters": {
                    "type": "object",
                    "properties": {"url": {"type": "string"}},
                    "required": ["url"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "read_vault_note",
                "description": "Reads an existing Markdown note from the current vault.",
                "parameters": {
                    "type": "object",
                    "properties": {"note_name": {"type": "string"}},
                    "required": ["note_name"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_youtube_transcript",
                "description": "Gets the transcript/captions of a YouTube video.",
                "parameters": {
                    "type": "object",
                    "properties": {"url": {"type": "string"}},
                    "required": ["url"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "search_images",
                "description": "Searches for image URLs.",
                "parameters": {
                    "type": "object",
                    "properties": {"query": {"type": "string"}},
                    "required": ["query"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_current_date",
                "description": "Returns the current date and time.",
                "parameters": {
                    "type": "object",
                    "properties": {}
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "verify_claim",
                "description": "Fact checks a specific claim using the web.",
                "parameters": {
                    "type": "object",
                    "properties": {"claim": {"type": "string"}},
                    "required": ["claim"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "read_github_repo",
                "description": "Reads the README of a GitHub repository.",
                "parameters": {
                    "type": "object",
                    "properties": {"repo_url": {"type": "string"}},
                    "required": ["repo_url"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "read_pdf",
                "description": "Downloads and reads a PDF from a URL.",
                "parameters": {
                    "type": "object",
                    "properties": {"url": {"type": "string"}},
                    "required": ["url"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "translate_source",
                "description": "Translates foreign text into English.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "text": {"type": "string"},
                        "target_lang": {"type": "string", "default": "English"}
                    },
                    "required": ["text", "target_lang"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "query_wikidata",
                "description": "Executes a SPARQL query on Wikidata.",
                "parameters": {
                    "type": "object",
                    "properties": {"sparql_query": {"type": "string"}},
                    "required": ["sparql_query"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "create_diagram",
                "description": "Converts Mermaid.js code into a markdown diagram block.",
                "parameters": {
                    "type": "object",
                    "properties": {"mermaid_code": {"type": "string"}},
                    "required": ["mermaid_code"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "solve_math_and_latex",
                "description": "Solves math equations and formats them as LaTeX.",
                "parameters": {
                    "type": "object",
                    "properties": {"equation": {"type": "string"}},
                    "required": ["equation"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "finish_research",
                "description": "Call this ONLY when you have gathered sufficient, high-quality information to write a comprehensive article.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                }
            }
        }
    ]

    import utilities.util_ai_tools as uoa
    dispatch = {
        "wikipedia_search": uoa.tool_wikipedia_search,
        "arxiv_search": uoa.tool_arxiv_search,
        "web_search": uoa.tool_web_search,
        "scrape_page": uoa.tool_scrape_page,
        "read_vault_note": uoa.tool_read_vault_note,
        "get_youtube_transcript": uoa.tool_get_youtube_transcript,
        "search_images": uoa.tool_search_images,
        "get_current_date": uoa.tool_get_current_date,
        "verify_claim": uoa.tool_verify_claim,
        "read_github_repo": uoa.tool_read_github_repo,
        "read_pdf": uoa.tool_read_pdf,
        "translate_source": uoa.tool_translate_source,
        "query_wikidata": uoa.tool_query_wikidata,
        "create_diagram": uoa.tool_create_diagram,
        "solve_math_and_latex": uoa.tool_solve_math_and_latex
    }

    system_prompt = f"""You are an autonomous research agent building an Obsidian knowledge vault about '{root_topic}'.
Your current task is to thoroughly research the sub-topic '{topic}'.

You MUST use your tools to gather information. 
- You can call multiple tools. 
- Try Wikipedia first, then Web or arXiv if needed.
- If a search result gives a URL that looks promising, you can use scrape_page(url) to read it.
- Once you have gathered sufficient context to write a massive, highly detailed article about '{topic}', you MUST call the `finish_research` tool.

DO NOT output your thoughts. ONLY call tools.
"""
    if "gemma4" in ollama_model.lower():
        system_prompt = "<|think|>\n" + system_prompt
        
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Begin researching '{topic}' now."}
    ]

    client = ollama.AsyncClient(host="http://localhost:11434")
    
    yield {'type': 'status', 'message': f'Initializing autonomous agent for: {topic}'}
    
    gathered_context = []
    
    for _ in range(8): # max 8 tool iterations
        try:
            response = await client.chat(
                model=ollama_model,
                messages=messages,
                tools=tools_list,
                options={"temperature": 0.1, "num_ctx": 4096}
            )
            msg = response.get("message", {})
            
            if "gemma4" in ollama_model.lower() and "content" in msg:
                # Strip thinking content to maintain clean history per Gemma best practices
                msg["content"] = re.sub(r'<\|channel>thought\n.*?<channel\|>', '', msg["content"], flags=re.DOTALL).strip()
                
            messages.append(msg)
            
            tool_calls = msg.get("tool_calls", [])
            if not tool_calls and "{" in msg.get("content", ""):
                import json
                try:
                    # attempt to parse content
                    start = msg["content"].find("{")
                    end = msg["content"].rfind("}") + 1
                    parsed = json.loads(msg["content"][start:end])
                    if "name" in parsed:
                        tool_calls = [{"function": parsed}]
                except:
                    pass
            
            if not tool_calls:
                content_text = msg.get("content", "")
                if content_text:
                    yield {'type': 'status', 'message': f'Agent providing text'}
                    gathered_context.append(content_text)
                break
                
            finished = False
            for tc in tool_calls:
                fn_name = tc.get("function", {}).get("name")
                args = tc.get("function", {}).get("arguments", {})
                
                if fn_name == "finish_research":
                    finished = True
                    break
                    
                if fn_name in dispatch:
                    yield {'type': 'status', 'message': f'Agent is executing {fn_name}({args})'}
                    # Pass vault_dir specifically to read_vault_note
                    if fn_name == "read_vault_note":
                        args["vault_dir"] = vault_dir
                        
                    # Execute tool in thread
                    res = await asyncio.to_thread(dispatch[fn_name], **args)
                    
                    if fn_name in ["wikipedia_search", "arxiv_search", "web_search", "read_pdf", "verify_claim"]:
                        yield {'type': 'status', 'message': f'Reranking {fn_name} results using embedding model'}
                        res = await asyncio.to_thread(filter_context_with_rag, topic, res)
                        
                        if config.get("obsidian_summarize_searches", "false") == "true":
                            yield {'type': 'status', 'message': f'Summarizing {fn_name} results with BART'}
                            max_words = int(config.get("obsidian_bart_max_words", 150))
                            res = await asyncio.to_thread(summarize_text_with_bart, res, max_words)

                    gathered_context.append(res)
                    messages.append({"role": "tool", "content": res})
                else:
                    messages.append({"role": "tool", "content": f"Error: unknown tool {fn_name}"})
                    
            if finished:
                break
                
        except Exception as e:
            yield {'type': 'status', 'message': f'Agent error: {e}'}
            break
            
    # Combine gathered context
    final_context = "\n\n---\n\n".join(gathered_context)
    if not final_context.strip():
        # fallback
        final_context = "No information could be found."
        
    yield {'type': 'result', 'context': final_context}


async def stream_obsidian_build(root_topic: str, vault_name: str, max_pages: int = 10, max_depth: int = 3):
    """
    Generator that orchestrates the agent loop and yields SSE JSON data.
    """
    token = load_hf_token()
    if not token:
        yield f"data: {json.dumps({'type': 'error', 'message': 'Hugging Face token is not configured in Settings.'})}\n\n"
        return

    vault_dir = os.path.join(CACHE_DIR, sanitize_filename(vault_name))
    os.makedirs(vault_dir, exist_ok=True)
    
    # Save root topic to metadata
    meta_path = os.path.join(vault_dir, "vault_meta.json")
    meta = {"root_topics": []}
    if os.path.exists(meta_path):
        try:
            with open(meta_path, 'r', encoding='utf-8') as f:
                meta = json.load(f)
        except Exception:
            pass
    if root_topic not in meta.get("root_topics", []):
        meta.setdefault("root_topics", []).append(root_topic)
        try:
            with open(meta_path, 'w', encoding='utf-8') as f:
                json.dump(meta, f, indent=4)
        except Exception:
            pass
    
    root_clean = sanitize_filename(root_topic)
    queue = [] # (topic, depth)
    visited = set()
    
    nodes = [{"id": root_clean, "group": 0, "branch": root_clean}]
    links_list = []
    
    def get_existing_node_id(link_name: str) -> str:
        for n in nodes:
            if n["id"].lower() == link_name.lower():
                return n["id"]
        return link_name

    # 1. Load Existing Graph Nodes from Vault Directory
    if os.path.exists(vault_dir):
        for fname in os.listdir(vault_dir):
            if fname.endswith(".md"):
                base = fname[:-3]
                visited.add(base)
                if not any(n["id"] == base for n in nodes):
                    nodes.append({"id": base, "group": 0})
        
        # 2. Extract Links from Existing Nodes
        for fname in os.listdir(vault_dir):
            if fname.endswith(".md"):
                base = fname[:-3]
                file_path = os.path.join(vault_dir, fname)
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        file_text = f.read()
                    # extract [[links]]
                    links = re.findall(r'\[\[(.*?)\]\]', file_text)
                    for raw_link in links:
                        link_clean = sanitize_filename(raw_link)
                        if link_clean:
                            if not any(l["source"] == base and l["target"] == link_clean for l in links_list):
                                links_list.append({"source": base, "target": link_clean})
                            if not any(n["id"] == link_clean for n in nodes):
                                nodes.append({"id": link_clean, "group": 1})
                            
                            # If it's a dangling link (not in visited), add to queue
                            if link_clean.lower() not in [v.lower() for v in visited]:
                                if not any(q[0].lower() == link_clean.lower() for q in queue):
                                    queue.append((link_clean, 1))
                except Exception:
                    pass
                    
    # If the root topic isn't generated yet, start with it
    if root_clean.lower() not in [v.lower() for v in visited]:
        queue.insert(0, (root_clean, 0))

    if len(visited) > 0:
        yield f"data: {json.dumps({'type': 'node_added', 'nodes': nodes, 'links': links_list, 'current_topic': '', 'completed_count': len(visited)})}\n\n"
        await asyncio.sleep(0.1)

    while queue and len(visited) < max_pages:
        topic, depth = queue.pop(0)
        
        # Case insensitive check
        if topic.lower() in [v.lower() for v in visited]:
            continue
            
        visited.add(topic)
        
        # 1. Autonomous Research Phase
        yield ":" + " " * 1024 + "\n\n"
        
        context = ""
        agent_gen = run_agentic_research(topic, root_clean, visited, token, vault_dir)
        
        q = asyncio.Queue()
        async def consume_gen():
            try:
                async for up in agent_gen:
                    await q.put(up)
            except Exception as e:
                await q.put({'type': 'status', 'message': f'Research error: {e}'})
            finally:
                await q.put(None)
                
        consume_task = asyncio.create_task(consume_gen())
        
        while True:
            try:
                update = await asyncio.wait_for(q.get(), timeout=2.0)
                if update is None:
                    break
                if isinstance(update, dict):
                    if update.get('type') == 'status':
                        yield f"data: {json.dumps(update)}\n\n"
                    elif update.get('type') == 'result':
                        context = update.get('context', '')
            except asyncio.TimeoutError:
                yield ": heartbeat\n\n"

        # 3. LLM Generation Phase
        yield f"data: {json.dumps({'type': 'status', 'message': f'LLM generating markdown for: {topic} (this may take a few minutes)'})}\n\n"
        await asyncio.sleep(0.1)
        
        gen_task = asyncio.create_task(asyncio.to_thread(generate_markdown, topic, root_clean, context, token, visited))
        while not gen_task.done():
            done, pending = await asyncio.wait([gen_task], timeout=2.0)
            if not done:
                yield ": heartbeat\n\n"
        content, extracted_links, usage = gen_task.result()
        
        yield f"data: {json.dumps({'type': 'usage', 'prompt_tokens': usage['prompt'], 'completion_tokens': usage['completion']})}\n\n"
        
        if "Error generating content" in content:
            yield f"data: {json.dumps({'type': 'status', 'message': f'Error from LLM for: {topic}'})}\n\n"
            await asyncio.sleep(0.5)
        
        # Save file
        file_path = os.path.join(vault_dir, f"{topic}.md")
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
        except Exception as e:
            print(f"Failed to write file {file_path}: {e}")
            
        # Process extracted links
        for raw_link in extracted_links:
            link = get_existing_node_id(raw_link)
            
            # Add to nodes if not exists
            if not any(n["id"] == link for n in nodes):
                nodes.append({"id": link, "group": depth + 1})
                
            # Add to links if not exists
            if not any(l["source"] == topic and l["target"] == link for l in links_list):
                links_list.append({"source": topic, "target": link})
                
            # Add to queue if within depth limit and not visited/queued
            if depth < max_depth:
                if link.lower() not in [v.lower() for v in visited]:
                    if not any(q[0].lower() == link.lower() for q in queue):
                        queue.append((link, depth + 1))
                    
        # Emit NODE_ADDED
        yield f"data: {json.dumps({'type': 'node_added', 'nodes': nodes, 'links': links_list, 'current_topic': topic, 'completed_count': len(visited)})}\n\n"
        await asyncio.sleep(0.5)
        
    yield f"data: {json.dumps({'type': 'done', 'message': 'Vault generation complete!'})}\n\n"

