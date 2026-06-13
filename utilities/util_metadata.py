import os
import datetime
import win32file
import win32con
import pywintypes
import mutagen
from tkinter import filedialog
import tkinter as tk

def _init_tkinter():
    """Helper to initialize a hidden, top-most tkinter root window."""
    root = tk.Tk()
    root.withdraw()
    root.attributes('-topmost', True)
    return root

def open_media_dialog() -> str:
    """Opens a native Windows file browser for selecting any file."""
    root = _init_tkinter()
    file_path = filedialog.askopenfilename(
        title="Select File to Edit",
        filetypes=[("All Files", "*.*")]
    )
    root.destroy()
    return file_path

def get_media_metadata(file_path: str) -> dict:
    """Safely extracts basic media metadata using Mutagen."""
    data = {"title": "", "artist": "", "album": "", "date": ""}
    if not os.path.exists(file_path):
        return data
        
    try:
        audio = mutagen.File(file_path, easy=True)
        if audio:
            data["title"] = audio.get("title", [""])[0]
            data["artist"] = audio.get("artist", [""])[0]
            data["album"] = audio.get("album", [""])[0]
            data["date"] = audio.get("date", [""])[0]
    except Exception:
        pass # Not a supported media file or missing tags
    return data

def save_media_metadata(file_path: str, title: str, artist: str, album: str, date: str) -> tuple[bool, str]:
    """Writes updated tags back to the media file."""
    try:
        audio = mutagen.File(file_path, easy=True)
        if audio is None:
            return False, "Unsupported media file format for metadata tagging."
            
        audio["title"] = title
        audio["artist"] = artist
        audio["album"] = album
        audio["date"] = str(date)
        audio.save()
        return True, "Metadata saved successfully."
    except Exception as e:
        return False, f"Failed to save metadata: {str(e)}"

def get_file_timestamps(file_path: str) -> dict:
    """Retrieves OS-level file creation, modification, and access timestamps."""
    if not os.path.exists(file_path):
        return {}
    stat = os.stat(file_path)
    return {
        "created": datetime.datetime.fromtimestamp(stat.st_ctime),
        "modified": datetime.datetime.fromtimestamp(stat.st_mtime),
        "accessed": datetime.datetime.fromtimestamp(stat.st_atime)
    }

def set_file_timestamps(file_path: str, c_time: datetime.datetime, m_time: datetime.datetime, a_time: datetime.datetime) -> tuple[bool, str]:
    """Uses Windows Kernel API to forcefully rewrite file system timestamps."""
    if not os.path.exists(file_path):
        return False, "File does not exist."
        
    try:
        # Convert standard Python datetimes to PyWinTypes Time objects
        c_time_w = pywintypes.Time(c_time)
        m_time_w = pywintypes.Time(m_time)
        a_time_w = pywintypes.Time(a_time)
        
        # Open file handle with explicit write-attributes access
        handle = win32file.CreateFile(
            file_path,
            win32con.GENERIC_WRITE,
            win32con.FILE_SHARE_READ | win32con.FILE_SHARE_WRITE | win32con.FILE_SHARE_DELETE,
            None,
            win32con.OPEN_EXISTING,
            win32con.FILE_ATTRIBUTE_NORMAL,
            None
        )
        
        # Inject new timestamps into the file handle (Created, Accessed, Modified)
        win32file.SetFileTime(handle, c_time_w, a_time_w, m_time_w)
        win32file.CloseHandle(handle)
        
        return True, "OS Timestamps updated successfully."
    except Exception as e:
        return False, f"Timestamp Kernel Error: {str(e)}"