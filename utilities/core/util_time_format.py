def format_srt_time(seconds: float) -> str:
    """Formats a duration in seconds into an SRT timestamp string (HH:MM:SS,mmm).

    Args:
        seconds (float): Time offset in seconds.

    Returns:
        str: Formatted SRT timestamp string.
    """
    h  = int(seconds // 3600)
    m  = int((seconds % 3600) // 60)
    s  = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def format_ass_time(seconds: float) -> str:
    """Formats a duration in seconds into an ASS timestamp string (H:MM:SS.cs).

    Args:
        seconds (float): Time offset in seconds.

    Returns:
        str: Formatted ASS timestamp string.
    """
    h  = int(seconds // 3600)
    m  = int((seconds % 3600) // 60)
    s  = int(seconds % 60)
    cs = int((seconds % 1) * 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def rgba_to_ass_hex(color_hex: str, transparency: float) -> str:
    """Convert #RRGGBB + opacity float → ASS &H[AA][BB][GG][RR] string.

    Args:
        color_hex (str): Color hex code (e.g. '#FFFFFF').
        transparency (float): Opacity value between 0.0 (transparent) and 1.0 (opaque).

    Returns:
        str: Formatted ASS color code string.
    """
    h = color_hex.lstrip("#")
    r, g, b = (h[0:2], h[2:4], h[4:6]) if len(h) == 6 else ("FF", "FF", "FF")
    alpha = int((1.0 - transparency) * 255)
    return f"&H{alpha:02X}{b}{g}{r}"
