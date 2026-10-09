import os
import feedparser
import time
from datetime import datetime

import re
import xml.etree.ElementTree as ET
import concurrent.futures
import json

# Import shared utilities
from utilities.core.util_network import better_get
from utilities.core.util_store import get_data, set_data

def _get_rss_manager() -> dict:
    """Retrieves the RSS manager dictionary from the store.

    Returns:
        dict: Stored RSS manager data.
    """
    return get_data("rss_manager") or {}

def _set_rss_manager(data: dict) -> None:
    """Persists the RSS manager dictionary to the store.

    Args:
        data (dict): Data to persist.

    Returns:
        None
    """
    set_data("rss_manager", data)


def load_disk_cache() -> tuple[list, float]:
    """Loads articles from the store and returns the data + modification time.

    Returns:
        tuple[list, float]: (cached articles list, cache last-modified epoch timestamp).
    """
    data = _get_rss_manager()
    cache = data.get("cache", [])
    mtime = data.get("cache_mtime", 0.0)
    return cache, mtime

def save_disk_cache(articles: list) -> None:
    """Saves articles safely to the store.

    Args:
        articles (list): List of article objects to cache.

    Returns:
        None
    """
    data = _get_rss_manager()
    data["cache"] = articles
    data["cache_mtime"] = time.time()
    _set_rss_manager(data)
    
def load_subscriptions() -> dict:
    """Loads saved RSS feed URLs and their titles from local cache.

    Returns:
        dict: Mapping of feed URL strings to feed title strings.
    """
    data = _get_rss_manager().get("subscriptions", {})
    # Backward compatibility for old list-based format
    if isinstance(data, list):
        return {url: url for url in data}
    return data

def save_subscriptions(feed_urls: dict) -> None:
    """Saves RSS feed URLs to local cache.

    Args:
        feed_urls (dict): Dictionary mapping feed URLs to display titles.

    Returns:
        None
    """
    data = _get_rss_manager()
    data["subscriptions"] = feed_urls
    _set_rss_manager(data)

def fetch_feed_data(url: str) -> feedparser.FeedParserDict:
    """Robustly fetches feed data using a real User-Agent to bypass bot blocks.

    Args:
        url (str): RSS/Atom feed URL to fetch and parse.

    Returns:
        feedparser.FeedParserDict: Parsed feed structure.
    """
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

def fetch_all_feeds(feed_urls: list[str]) -> list[dict]:
    """Fetches and aggregates articles from all subscribed RSS feeds.

    Args:
        feed_urls (list[str]): List of subscribed feed URLs.

    Returns:
        list[dict]: Sorted list of article dictionary entries.
    """
    aggregated_entries = []
    
    with concurrent.futures.ThreadPoolExecutor() as executor:
        future_to_url = {executor.submit(fetch_feed_data, url): url for url in feed_urls}
        
        for future in concurrent.futures.as_completed(future_to_url):
            url = future_to_url[future]
            try:
                parsed = future.result()
                if not parsed:
                    continue
                    
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



def preview_rss_feed(url: str) -> tuple[bool, str | dict]:
    """Fetches a single RSS feed to preview its content before subscribing.

    Args:
        url (str): Feed URL to preview.

    Returns:
        tuple[bool, str | dict]: (success flag, preview feed metadata dict or error message).
    """
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