import os
import json
import requests
from bs4 import BeautifulSoup
import subprocess

def fetch_url_text(url: str, max_chars: int = 5000) -> str:
    """Fetches a URL using Playwright and returns the visible text content."""
    try:
        script_path = os.path.join(".", "utilities", "playwright_scraper", "scraper.js")
        if not os.path.exists(script_path):
            raise FileNotFoundError(f"Scraper script not found at {script_path}")

        payload = json.dumps({"action": "proxy", "url": url})
        
        process = subprocess.run(
            ["node", script_path],
            input=payload + "\n",
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=45
        )
        
        if process.returncode != 0:
            raise Exception(f"Node process failed: {process.stderr}")
            
        # Parse the last line of stdout which should be the JSON response
        lines = [line.strip() for line in process.stdout.strip().split('\n') if line.strip()]
        if not lines:
            raise Exception("No output from scraper")
            
        data = json.loads(lines[-1])
        if not data.get("success"):
            raise Exception(data.get("error", "Unknown Playwright error"))
            
        html = data.get("html", "")
        soup = BeautifulSoup(html, "html.parser")
        
        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer", "header"]):
            script.decompose()
            
        import markdownify
        text = markdownify.markdownify(str(soup), heading_style="ATX")
        return text[:max_chars]
    except Exception as e:
        print(f"Error fetching {url} with Playwright: {e}")
        return ""

import subprocess

def ensure_searxng_running():
    try:
        res = subprocess.run(["docker", "ps", "-q", "-f", "name=searxng"], capture_output=True, text=True)
        if not res.stdout.strip():
            # Try to start it
            subprocess.run(["docker", "start", "searxng"], check=False)
            time.sleep(2)
    except Exception as e:
        print(f"Error checking SearXNG container: {e}")

def get_search_results(topic: str) -> list:
    """Helper to just get search URLs from SearXNG"""
    ensure_searxng_running()
    try:
        from utilities.util_config import load_all_config
        config = load_all_config()
        max_urls = int(config.get("obsidian_scraper_max_urls", 2))
        from utilities.util_network import better_get
        res = better_get(f"http://127.0.0.1:8080/search", params={"q": topic, "format": "json"}, timeout=15)
        if res is None: raise Exception("Request failed")
        res.raise_for_status()
        return res.json().get("results", [])[:max_urls]
    except Exception as e:
        print(f"Search error for {topic}: {e}")
        return []

from utilities.util_config import load_all_config
import ollama


import urllib.parse
import urllib.request
import asyncio

def tool_wikipedia_search(query: str) -> str:
    try:
        url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(query)}&utf8=&format=json"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))
        results = data.get("query", {}).get("search", [])
        if not results:
            return "No Wikipedia results found."
        output = []
        for r in results[:3]:
            page_title = r['title']
            sum_url = f"https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=&explaintext=&titles={urllib.parse.quote(page_title)}&format=json"
            sum_req = urllib.request.Request(sum_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(sum_req, timeout=10) as s_res:
                s_data = json.loads(s_res.read().decode('utf-8'))
                pages = s_data.get("query", {}).get("pages", {})
                for page_id, page_info in pages.items():
                    output.append(f"Title: {page_info.get('title')}\\nSummary: {page_info.get('extract', '')}")
        return "\\n\\n".join(output)
    except Exception as e:
        return f"Wikipedia search failed: {e}"

def tool_arxiv_search(query: str) -> str:
    try:
        url = f"https://searchthearxiv.com/search?query={urllib.parse.quote(query)}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "X-Requested-With": "XMLHttpRequest"})
        with urllib.request.urlopen(req, timeout=15) as response:
            data = json.loads(response.read().decode('utf-8'))
        entries = data.get("papers", [])[:3]
        if not entries:
            return f"No academic papers located for '{query}'"
        results = ""
        for i, entry in enumerate(entries, 1):
            results += f"{i}. {entry.get('title', '').strip()}\\n   Authors: {entry.get('authors', '')}\\n   Abstract: {entry.get('abstract', '').strip()}\\n\\n"
        return results
    except Exception as e:
        return f"arXiv search failed: {e}"

def tool_web_search(query: str) -> str:
    try:
        from utilities.util_config import load_all_config
        import httpx
        from utilities.util_network import better_get
        config = load_all_config()
        max_urls = int(config.get("obsidian_scraper_max_urls", 3))
        res = better_get(f"http://127.0.0.1:8080/search", params={"q": query, "format": "json"}, timeout=15)
        if res is None: raise Exception("Request failed")
        res.raise_for_status()
        results = res.json().get("results", [])[:max_urls]
        output = []
        for r in results:
            output.append(f"Title: {r.get('title')}\\nURL: {r.get('url')}\\nSnippet: {r.get('content')}")
        return "\\n\\n".join(output)
    except Exception as e:
        return f"Web search failed: {e}"

def tool_scrape_page(url: str) -> str:
    try:
        text = fetch_url_text(url)
        if text:
            # We must pass something for topic to the RAG, just use URL for now
            return filter_context_with_rag(url, text)
        return "Failed to scrape page."
    except Exception as e:
        return f"Failed to scrape page: {e}"



import datetime
import urllib.parse
import urllib.request
import json
import os
import httpx
from bs4 import BeautifulSoup
import tempfile

def tool_read_vault_note(note_name: str, vault_dir: str) -> str:
    try:
        if not note_name.endswith('.md'):
            note_name += '.md'
        file_path = os.path.join(vault_dir, note_name)
        if not os.path.exists(file_path):
            return f"Note '{note_name}' does not exist in the vault."
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return f"Contents of {note_name}:\n\n{content}"
    except Exception as e:
        return f"Failed to read vault note: {e}"

def tool_get_youtube_transcript(url: str) -> str:
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        import urllib.parse
        
        # Parse video ID
        parsed_url = urllib.parse.urlparse(url)
        video_id = ""
        if "youtu.be" in parsed_url.netloc:
            video_id = parsed_url.path[1:]
        elif "youtube.com" in parsed_url.netloc:
            query = urllib.parse.parse_qs(parsed_url.query)
            video_id = query.get("v", [""])[0]
            
        if not video_id:
            return "Could not extract video ID from URL."
            
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        text = " ".join([entry['text'] for entry in transcript])
        return text
    except Exception as e:
        return f"Failed to fetch YouTube transcript: {e}"

def tool_search_images(query: str) -> str:
    try:
        from utilities.util_config import load_all_config
        from utilities.util_network import better_get
        config = load_all_config()
        max_urls = int(config.get("obsidian_scraper_max_urls", 3))
        res = better_get(f"http://127.0.0.1:8080/search", params={"q": query, "format": "json", "categories": "images"}, timeout=15)
        if res is None: raise Exception("Request failed")
        res.raise_for_status()
        results = res.json().get("results", [])[:max_urls]
        output = []
        for r in results:
            output.append(f"Image Title: {r.get('title')}\nURL: {r.get('img_src') or r.get('url')}")
        if not output:
            return "No images found."
        return "\n\n".join(output)
    except Exception as e:
        return f"Image search failed: {e}"

def tool_get_current_date() -> str:
    return f"The current date and time is {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}."

def tool_verify_claim(claim: str) -> str:
    try:
        from utilities.util_network import better_get
        res = better_get(f"http://127.0.0.1:8080/search", params={"q": claim + " fact check", "format": "json"}, timeout=15)
        if res is None: raise Exception("Request failed")
        res.raise_for_status()
        results = res.json().get("results", [])[:3]
        output = [f"Results for claim verification: '{claim}'\n"]
        for r in results:
            output.append(f"Source: {r.get('title')}\nSnippet: {r.get('content')}")
        if len(output) == 1:
            return "No fact-check results found."
        return "\n\n".join(output)
    except Exception as e:
        return f"Claim verification failed: {e}"

def tool_read_github_repo(repo_url: str) -> str:
    try:
        import urllib.parse
        parsed = urllib.parse.urlparse(repo_url)
        path_parts = [p for p in parsed.path.split('/') if p]
        if len(path_parts) < 2:
            return "Invalid GitHub repository URL."
        owner, repo = path_parts[0], path_parts[1]
        
        from utilities.util_network import better_get
        api_url = f"https://api.github.com/repos/{owner}/{repo}/readme"
        res = better_get(api_url, headers={"Accept": "application/vnd.github.v3.raw"}, timeout=10)
        if res is None: raise Exception("Request failed")
        res.raise_for_status()
        return res.text
    except Exception as e:
        return f"Failed to read GitHub repo: {e}"

def tool_read_pdf(url: str) -> str:
    try:
        import fitz
        from utilities.util_network import better_get
        res = better_get(url, timeout=15)
        if res is None: raise Exception("Request failed")
        res.raise_for_status()
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(res.content)
            tmp_path = tmp.name
            
        doc = fitz.open(tmp_path)
        text = ""
        for page in doc:
            text += page.get_text() + "\n"
        doc.close()
        os.remove(tmp_path)
        return text
    except Exception as e:
        return f"Failed to read PDF: {e}"

def tool_translate_source(text: str, target_lang: str) -> str:
    try:
        from utilities.util_nlp import translate_text
        # We don't have model_id so it will use default
        result = translate_text(text, source_lang="English", target_lang=target_lang)
        return result
    except Exception as e:
        return f"Translation failed: {e}"

def tool_query_wikidata(sparql_query: str) -> str:
    try:
        from utilities.util_network import better_get
        url = "https://query.wikidata.org/sparql"
        headers = {"Accept": "application/json", "User-Agent": "Mozilla/5.0"}
        res = better_get(url, params={"query": sparql_query}, headers=headers, timeout=15)
        if res is None: raise Exception("Request failed")
        res.raise_for_status()
        data = res.json()
        
        # Format the result nicely
        bindings = data.get("results", {}).get("bindings", [])
        if not bindings:
            return "No results found for Wikidata query."
            
        output = []
        for i, item in enumerate(bindings[:20]): # limit to 20 to avoid massive context
            row = []
            for key, val in item.items():
                row.append(f"{key}: {val.get('value')}")
            output.append(" | ".join(row))
        return "\n".join(output)
    except Exception as e:
        return f"Wikidata query failed: {e}"

def tool_create_diagram(mermaid_code: str) -> str:
    # Just formats it into markdown. The LLM gets this back and learns how to output it.
    if not mermaid_code.startswith("```mermaid"):
        mermaid_code = f"```mermaid\n{mermaid_code}\n```"
    return mermaid_code

def tool_solve_math_and_latex(equation: str) -> str:
    try:
        import sympy
        from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication_application
        
        transformations = standard_transformations + (implicit_multiplication_application,)
        
        # Check if it's an equation
        if "=" in equation:
            left, right = equation.split("=", 1)
            expr = sympy.Eq(parse_expr(left, transformations=transformations), parse_expr(right, transformations=transformations))
            solution = sympy.solve(expr)
            latex_expr = sympy.latex(expr)
            latex_sol = sympy.latex(solution)
            return f"Equation: $${latex_expr}$$\nSolution: $${latex_sol}$$"
        else:
            expr = parse_expr(equation, transformations=transformations)
            simplified = sympy.simplify(expr)
            latex_expr = sympy.latex(expr)
            latex_simp = sympy.latex(simplified)
            return f"Expression: $${latex_expr}$$\nSimplified: $${latex_simp}$$"
    except Exception as e:
        return f"Failed to solve math: {e}"



import numpy as np

def filter_context_with_rag(topic: str, context: str) -> str:
    """Uses Ollama embeddings to filter the context to the most relevant chunks."""
    config = load_all_config()
    embedding_model = config.get("obsidian_embedding_model", "nomic-embed-text")
    
    # Robust chunking
    raw_chunks = context.split('\n')
    chunks = []
    current_chunk = ""
    for rc in raw_chunks:
        # Force split extremely long lines that have no newlines
        while len(rc) > 1500:
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
                current_chunk = ""
            chunks.append(rc[:1500].strip())
            rc = rc[1500:]
            
        if len(current_chunk) + len(rc) < 1500:
            current_chunk += rc + "\n"
        else:
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
            current_chunk = rc + "\n"
            
    if current_chunk.strip():
        chunks.append(current_chunk.strip())
        
    # If the context is already small, skip RAG
    if len(chunks) <= 3:
        return context

    try:
        client = ollama.Client(host="http://localhost:11434", timeout=None)
        topic_emb_res = client.embeddings(model=embedding_model, prompt=topic)
        topic_vec = np.array(topic_emb_res["embedding"])
        
        chunk_embeddings = []
        valid_chunks = []
        for c in chunks:
            if not c.strip(): continue
            try:
                emb_res = client.embeddings(model=embedding_model, prompt=c)
                chunk_embeddings.append(np.array(emb_res["embedding"]))
                valid_chunks.append(c)
            except Exception as e:
                print(f"Failed to embed chunk: {e}")
                
        if not valid_chunks:
            return context
            
        similarities = []
        for i, vec in enumerate(chunk_embeddings):
            # Cosine similarity
            norm_topic = np.linalg.norm(topic_vec)
            norm_vec = np.linalg.norm(vec)
            if norm_topic == 0 or norm_vec == 0:
                sim = 0
            else:
                sim = np.dot(topic_vec, vec) / (norm_topic * norm_vec)
            similarities.append((sim, valid_chunks[i]))
            
        similarities.sort(key=lambda x: x[0], reverse=True)
        
        # Take top 6 chunks (approx 9000 chars)
        top_chunks = [c for sim, c in similarities[:6]]
        return "\n\n...\n\n".join(top_chunks)
    except Exception as e:
        print(f"RAG embedding error: {e}")
_bart_tokenizer = None
_bart_model = None

def summarize_text_with_bart(text: str, max_words: int = 150) -> str:
    """Uses offline facebook/bart-large-cnn to summarize text in chunks."""
    global _bart_tokenizer, _bart_model
    import torch
    device = "cuda" if torch.cuda.is_available() else "cpu"
    
    if _bart_tokenizer is None or _bart_model is None:
        from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
        try:
            print("Loading offline BART model...")
            _bart_tokenizer = AutoTokenizer.from_pretrained("facebook/bart-large-cnn")
            _bart_model = AutoModelForSeq2SeqLM.from_pretrained("facebook/bart-large-cnn").to(device)
            _bart_model.eval()
        except Exception as e:
            print(f"Failed to load BART model: {e}")
            return text
            
    # BART max length is 1024 tokens. We'll chunk the text by ~3500 chars to be safe.
    chunks = []
    current_chunk = ""
    for paragraph in text.split('\n'):
        if len(current_chunk) + len(paragraph) < 3500:
            current_chunk += paragraph + "\n"
        else:
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
            current_chunk = paragraph + "\n"
    if current_chunk.strip():
        chunks.append(current_chunk.strip())
        
    summaries = []
    for c in chunks:
        if len(c) < 100:  # Too short to summarize
            summaries.append(c)
            continue
        try:
            input_length = len(c.split())
            max_len = min(max_words, input_length)
            min_len = min(30, max_len - 1) if max_len > 30 else 10
            if max_len <= min_len:
                max_len = min_len + 10
                
            inputs = _bart_tokenizer(c, max_length=1024, return_tensors="pt", truncation=True).to(device)
            with torch.no_grad():
                summary_ids = _bart_model.generate(
                    inputs["input_ids"],
                    max_new_tokens=max_len,
                    min_length=min_len,
                    length_penalty=2.0,
                    num_beams=4,
                    early_stopping=True
                )
            summary_text = _bart_tokenizer.decode(summary_ids[0], skip_special_tokens=True)
            summaries.append(summary_text)
        except Exception as e:
            print(f"BART summarization error: {e}")
            summaries.append(c)
            
    return "\n\n".join(summaries)


# Mapping of tool names to functions and their schemas
ALL_TOOLS = {
    "wikipedia_search": {
        "func": tool_wikipedia_search,
        "schema": {
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
        }
    },
    "arxiv_search": {
        "func": tool_arxiv_search,
        "schema": {
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
        }
    },
    "web_search": {
        "func": tool_web_search,
        "schema": {
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
        }
    },
    "scrape_page": {
        "func": tool_scrape_page,
        "schema": {
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
        }
    },
    "get_youtube_transcript": {
        "func": tool_get_youtube_transcript,
        "schema": {
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
        }
    },
    "search_images": {
        "func": tool_search_images,
        "schema": {
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
        }
    },
    "get_current_date": {
        "func": tool_get_current_date,
        "schema": {
            "type": "function",
            "function": {
                "name": "get_current_date",
                "description": "Returns the current date and time.",
                "parameters": {
                    "type": "object",
                    "properties": {}
                }
            }
        }
    },
    "verify_claim": {
        "func": tool_verify_claim,
        "schema": {
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
        }
    },
    "read_github_repo": {
        "func": tool_read_github_repo,
        "schema": {
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
        }
    },
    "read_pdf": {
        "func": tool_read_pdf,
        "schema": {
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
        }
    },
    "translate_source": {
        "func": tool_translate_source,
        "schema": {
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
        }
    },
    "query_wikidata": {
        "func": tool_query_wikidata,
        "schema": {
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
        }
    },
    "solve_math_and_latex": {
        "func": tool_solve_math_and_latex,
        "schema": {
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
        }
    }
}

