import asyncio
import json
from utilities.util_network import better_get
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import time

async def stream_crawl(start_url: str, max_pages: int = 100, max_depth: int = 3):
    """
    Crawls a website using BFS, yielding JSON strings containing node and link data.
    """
    # Validate and normalize start_url
    if not start_url.startswith("http"):
        start_url = "http://" + start_url
        
    parsed_start = urlparse(start_url)
    domain = parsed_start.netloc
    
    if not domain:
        yield f"data: {json.dumps({'error': 'Invalid URL'})}\n\n"
        return

    visited = set()
    # Queue stores tuples of (url, parent_url, depth)
    queue = [(start_url, None, 0)]
    
    page_count = 0
    
    yield f"data: {json.dumps({'type': 'status', 'message': f'Starting crawl for {domain}...'})}\n\n"
    
    while queue and page_count < max_pages:
        current_url, parent_url, depth = queue.pop(0)
        
        if current_url in visited:
            continue
            
        if depth > max_depth:
            continue
            
        visited.add(current_url)
        page_count += 1
        
        yield f"data: {json.dumps({'type': 'status', 'message': f'Crawling {current_url} (Depth: {depth})'})}\n\n"
        
        try:
            # Use a short timeout so we don't hang forever
            response = await asyncio.to_thread(better_get, current_url, timeout=5)
            
            if response is None:
                raise Exception("Failed to fetch")
                
            # Check if it's HTML
            content_type = response.headers.get('content-type', '')
            if 'text/html' not in content_type:
                # Still add it as a node, but don't parse links
                node_data = {
                    "type": "node",
                    "url": current_url,
                    "parent": parent_url,
                    "title": f"[{content_type.split(';')[0]}]" if content_type else "[File]",
                    "depth": depth
                }
                yield f"data: {json.dumps(node_data)}\n\n"
                continue
                
            soup = BeautifulSoup(response.text, 'html.parser')
            title = soup.title.string.strip() if soup.title and soup.title.string else current_url.split("/")[-1] or "Home"
            
            node_data = {
                "type": "node",
                "url": current_url,
                "parent": parent_url,
                "title": title,
                "depth": depth
            }
            yield f"data: {json.dumps(node_data)}\n\n"
            
            # Extract links if not at max depth
            if depth < max_depth:
                links = soup.find_all('a', href=True)
                for link in links:
                    href = link['href']
                    
                    # Normalize URL
                    full_url = urljoin(current_url, href).split('#')[0] # Remove fragments
                    
                    # Ensure it's http/https
                    if not full_url.startswith("http"):
                        continue
                        
                    # Check domain restriction
                    parsed_href = urlparse(full_url)
                    if parsed_href.netloc == domain:
                        if full_url not in visited:
                            # Avoid adding duplicates to queue
                            if not any(q[0] == full_url for q in queue):
                                queue.append((full_url, current_url, depth + 1))
                                
        except Exception as e:
            # Node failed to load
            node_data = {
                "type": "node",
                "url": current_url,
                "parent": parent_url,
                "title": "[Error loading]",
                "depth": depth
            }
            yield f"data: {json.dumps(node_data)}\n\n"
            
        # Small delay to not slam the server
        await asyncio.sleep(0.1)

    yield f"data: {json.dumps({'type': 'done', 'message': f'Finished crawling {page_count} pages.'})}\n\n"
