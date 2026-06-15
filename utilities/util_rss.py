import os
import feedparser
import time
from datetime import datetime
import streamlit as st
import re
import xml.etree.ElementTree as ET

# Import shared utilities
from utilities.util_network import better_get
from utilities.util_json import load_json, save_json

CACHE_FILE = os.path.join(".", "cache", "rss_subscriptions.json")

def load_subscriptions() -> dict:
    """Loads saved RSS feed URLs and their titles from local cache."""
    data = load_json(CACHE_FILE, default_factory=dict)
    # Backward compatibility for old list-based format
    if isinstance(data, list):
        return {url: url for url in data}
    return data

def save_subscriptions(feed_urls: dict):
    """Saves RSS feed URLs to local cache."""
    save_json(CACHE_FILE, feed_urls)

def fetch_feed_data(url: str):
    """Robustly fetches feed data using a real User-Agent to bypass bot blocks."""
    try:
        # Utilize the robust fetcher from util_network
        res = better_get(url)
        
        if res and res.status_code == 200:
            # Fix unescaped ampersands which break strict XML parsers
            content = re.sub(r'&(?![A-Za-z0-9#]+;)', '&amp;', res.text)
            return feedparser.parse(content)
            
    except Exception as e:
        print(f"Request failed for {url}: {e}")
        
    # Fallback to feedparser's internal downloader if the custom request fails
    return feedparser.parse(url)

@st.cache_data(ttl=900)
def fetch_all_feeds(feed_urls: list) -> list:
    """Fetches and aggregates articles from all subscribed RSS feeds."""
    aggregated_entries = []
    
    for url in feed_urls:
        try:
            parsed = fetch_feed_data(url)
            source_title = parsed.feed.get('title', url)
            
            for entry in parsed.entries:
                published_time = entry.get('published_parsed') or entry.get('updated_parsed')
                if published_time:
                    dt = datetime.fromtimestamp(time.mktime(published_time))
                    date_str = dt.strftime("%Y-%m-%d %H:%M")
                    sort_key = time.mktime(published_time)
                else:
                    date_str = "Unknown Date"
                    sort_key = 0.0
                
                aggregated_entries.append({
                    "source": source_title,
                    "title": entry.get('title', 'No Title'),
                    "link": entry.get('link', ''),
                    "summary": entry.get('summary', 'No summary available.'),
                    "date": date_str,
                    "sort_key": sort_key
                })
        except Exception as e:
            print(f"Failed to fetch {url}: {e}")
            
    aggregated_entries.sort(key=lambda x: x['sort_key'], reverse=True)
    return aggregated_entries

def parse_markdown_links(markdown_text: str) -> dict:
    """Extracts [Title](URL) pairs from markdown text."""
    pattern = r'\[([^\]]+)\]\((https?://[^\)]+)\)'
    matches = re.findall(pattern, markdown_text)
    
    feeds = {}
    ignore_domains = ['play.google.com', 'twitter.com', 'wikipedia.org']
    
    for title, url in matches:
        url = url.strip()
        title = title.strip()
        
        if any(domain in url for domain in ignore_domains):
            continue
            
        if 'github.com' in url and '/blob/' in url:
            url = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')
            
        feeds[title] = url
    return feeds

def parse_opml_links(opml_text: str) -> dict:
    """Extracts feed titles and URLs from an OPML file, with an indestructible regex fallback."""
    feeds = {}
    try:
        clean_text = re.sub(r'&(?![A-Za-z0-9#]+;)', '&amp;', opml_text)
        root = ET.fromstring(clean_text)
        for outline in root.iter('outline'):
            xml_url = outline.get('xmlUrl') or outline.get('url')
            title = outline.get('title') or outline.get('text') or outline.get('name')
            
            if xml_url and title:
                feeds[title.strip()] = xml_url.strip()
                
    except Exception as e:
        print(f"Strict OPML parse failed: {e}. Switching to Line-by-Line Regex fallback.")
        
        for line in opml_text.splitlines():
            url_match = re.search(r'(?:xmlUrl|url)=["\']([^"\']+)["\']', line, re.IGNORECASE)
            title_match = re.search(r'(?:title|text|name)=["\']([^"\']+)["\']', line, re.IGNORECASE)
            
            if url_match and title_match:
                feeds[title_match.group(1).strip()] = url_match.group(1).strip()
                
    return feeds

@st.cache_data(show_spinner=False)
def fetch_remote_recommendations(url: str) -> dict:
    """Fetches and parses a remote Markdown or OPML file via URL."""
    try:
        response = better_get(url)
        if response and response.status_code == 200:
            content = response.text
            if '<opml' in content.lower() or 'xmlurl' in content.lower():
                return parse_opml_links(content)
            else:
                return parse_markdown_links(content)
    except Exception as e:
        print(f"Failed to fetch remote feeds: {e}")
    return {}

@st.cache_data(ttl=300, show_spinner=False)
def preview_rss_feed(url: str) -> tuple[bool, str | dict]:
    """Fetches a single RSS feed to preview its content before subscribing."""
    try:
        parsed = fetch_feed_data(url)
        
        if not parsed.entries:
            return False, "No articles found. The feed might be invalid or blocked by the server."

        feed_info = {
            "title": parsed.feed.get('title', 'Unknown Title'),
            "description": parsed.feed.get('description', 'No description available.'),
            "link": parsed.feed.get('link', url),
            "entries": []
        }

        for entry in parsed.entries[:5]:  
            published_time = entry.get('published_parsed') or entry.get('updated_parsed')
            if published_time:
                dt = datetime.fromtimestamp(time.mktime(published_time))
                date_str = dt.strftime("%Y-%m-%d %H:%M")
            else:
                date_str = "Unknown Date"

            raw_summary = entry.get('summary', 'No summary.')
            clean_summary = re.sub('<[^<]+>', '', raw_summary)

            feed_info["entries"].append({
                "title": entry.get('title', 'No Title'),
                "link": entry.get('link', ''),
                "summary": clean_summary[:200] + "...",
                "date": date_str
            })
        return True, feed_info
    except Exception as e:
        return False, f"Failed to fetch feed: {e}"