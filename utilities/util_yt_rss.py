import json
import re
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from utilities.util_store import get_data, set_data

def _get_yt_manager() -> dict:
    return get_data("youtube_manager") or {}

def _set_yt_manager(data: dict):
    set_data("youtube_manager", data)

def load_tracked_channels() -> list:
    """Loads tracked channels from the local store."""
    return _get_yt_manager().get("channels", [])

def save_tracked_channels(channels: list):
    """Saves tracked channels to the local store."""
    data = _get_yt_manager()
    data["channels"] = channels
    _set_yt_manager(data)

def load_feed_cache() -> dict:
    """Loads the pre-fetched RSS data so the UI doesn't freeze on load."""
    return _get_yt_manager().get("cache", {})

def save_feed_cache(cache_data: dict):
    """Saves the fully parsed feed data for instant loading."""
    data = _get_yt_manager()
    data["cache"] = cache_data
    _set_yt_manager(data)

def search_youtube_channel(query: str) -> tuple[str | None, str | None]:
    """Scrapes YouTube search results to find the first channel matching the query."""
    search_url = f"https://www.youtube.com/results?search_query={urllib.parse.quote(query)}&sp=EgIQAg%253D%253D"
    try:
        req = urllib.request.Request(search_url, headers={'User-Agent': 'Mozilla/5.0'})
        html = urllib.request.urlopen(req, timeout=5).read().decode('utf-8')
        
        match_id = re.search(r'"channelId":"(UC[\w-]{22})"', html)
        match_name = re.search(r'"title":\{"simpleText":"(.*?)"\}', html)
        
        if match_id and match_name:
            return match_name.group(1), match_id.group(1)
    except Exception:
        pass
    return None, None

def add_channel(name: str, channel_id: str) -> tuple[bool, str]:
    """Adds a single channel to the tracking list, verifying its RSS feed first."""
    channels = load_tracked_channels()
    clean_id = channel_id.split("channel/")[-1].split("?")[0].strip()
    
    tracked_ids = {c['id'] for c in channels}
    if clean_id in tracked_ids:
        return False, "This channel is already being tracked."

    # Verify the feed exists using pure standard library
    test_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={clean_id}"
    try:
        req = urllib.request.Request(test_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status != 200:
                return False, "Could not find an RSS feed for this Channel ID."
    except Exception:
        pass 

    channels.append({"name": name, "id": clean_id})
    save_tracked_channels(channels)
    return True, f"Successfully added {name}!"

def delete_channel(channel_id: str):
    """Removes a channel from the tracking list."""
    channels = load_tracked_channels()
    channels = [c for c in channels if c['id'] != channel_id]
    save_tracked_channels(channels)

def fetch_latest_videos(channel_id: str, limit: int = 15) -> tuple[bool, list | str]:
    """Fetches and parses Atom feeds blazingly fast using ElementTree."""
    url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"

    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            xml_data = response.read()

        root = ET.fromstring(xml_data)
        
        # Atom namespaces used by YouTube
        ns = {
            'atom': 'http://www.w3.org/2005/Atom',
            'media': 'http://search.yahoo.com/mrss/',
            'yt': 'http://www.youtube.com/xml/schemas/2015'
        }

        videos = []
        for entry in root.findall('atom:entry', ns)[:limit]:
            title = entry.find('atom:title', ns).text
            link = entry.find('atom:link', ns).attrib['href']
            published = entry.find('atom:published', ns).text
            
            author_elem = entry.find('atom:author/atom:name', ns)
            author = author_elem.text if author_elem is not None else "Unknown"

            thumbnail = ""
            media_group = entry.find('media:group', ns)
            if media_group is not None:
                media_thumbnail = media_group.find('media:thumbnail', ns)
                if media_thumbnail is not None:
                    thumbnail = media_thumbnail.attrib.get('url', '')

            videos.append({
                "title": title,
                "link": link,
                "published": published,
                "author": author,
                "thumbnail": thumbnail
            })

        return True, videos
    except Exception as e:
        return False, f"Error fetching feed: {str(e)}"

def bulk_add_channels(new_channels: list[dict]) -> tuple[int, int]:
    """Adds multiple channels to the tracking list at once, skipping duplicates."""
    channels = load_tracked_channels()
    existing_ids = {c['id'] for c in channels}
    
    added_count, skipped_count = 0, 0
    
    for nc in new_channels:
        clean_id = nc['id'].split("channel/")[-1].split("?")[0].strip()
        if clean_id in existing_ids:
            skipped_count += 1
        else:
            channels.append({"name": nc['name'], "id": clean_id})
            existing_ids.add(clean_id)
            added_count += 1
            
    if added_count > 0:
        save_tracked_channels(channels)
        
    return added_count, skipped_count