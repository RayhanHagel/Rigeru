def get_proxy_html(url: str) -> str:
    """Fetches HTML via node scraper and injects proxy interactivity (base tag and JS)."""
    from bs4 import BeautifulSoup
    from utilities.util_scraper import _run_node_scraper
    
    payload = {
        "action": "proxy",
        "url": url
    }
    res = _run_node_scraper(payload)
    if not res.get("success"):
        raise RuntimeError(f"Failed to fetch proxy HTML: {res.get('error')}")
        
    html_content = res.get("html")
        
    # Parse and inject logic
    soup = BeautifulSoup(html_content, "lxml")
    
    # Inject <base> tag to fix relative assets
    base_tag = soup.new_tag("base", href=url)
    if soup.head:
        soup.head.insert(0, base_tag)
    else:
        head_tag = soup.new_tag("head")
        head_tag.insert(0, base_tag)
        soup.insert(0, head_tag)
        
    # Inject interactive selector JS
    script_tag = soup.new_tag("script")
    script_tag.string = """
        document.addEventListener('mouseover', function(e) {
            if(e.target === document.body) return;
            e.target.style.outline = '2px solid #a855f7';
            e.target.style.backgroundColor = 'rgba(168,85,247,0.1)';
            e.stopPropagation();
        });
        document.addEventListener('mouseout', function(e) {
            if(e.target === document.body) return;
            e.target.style.outline = '';
            e.target.style.backgroundColor = '';
        });
        document.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            let path = [];
            let node = e.target;
            while(node && node.nodeType === Node.ELEMENT_NODE) {
                let selector = node.nodeName.toLowerCase();
                if(node.id) {
                    selector += '#' + node.id;
                    path.unshift(selector);
                    break;
                } else {
                    let sib = node, nth = 1;
                    while(sib = sib.previousElementSibling) nth++;
                    selector += ":nth-child(" + nth + ")";
                }
                path.unshift(selector);
                node = node.parentNode;
            }
            let finalSelector = path.join(' > ');
            window.parent.postMessage({ type: 'SELECTOR_PICKED', selector: finalSelector }, '*');
        }, true);
    """
    if soup.body:
        soup.body.append(script_tag)
    else:
        soup.append(script_tag)
        
    return str(soup)