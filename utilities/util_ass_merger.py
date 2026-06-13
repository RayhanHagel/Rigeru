import os
import re

CACHE_DIR = os.path.join(".", "cache")
TEMP_DIR = os.path.join(CACHE_DIR, "temp")

def merge_ass_files(base_path: str, overlay_path: str) -> tuple[bool, str]:
    """Merges two ASS files by scaling the overlay coordinates to match the base file's resolution."""
    os.makedirs(TEMP_DIR, exist_ok=True)
    try:
        with open(base_path, 'r', encoding='utf-8') as f:
            base_content = f.read()
        with open(overlay_path, 'r', encoding='utf-8') as f:
            overlay_content = f.read()

        def get_res(content):
            rx = int(re.search(r"^PlayResX:\s*(\d+)", content, re.M|re.I).group(1)) if re.search(r"^PlayResX:\s*(\d+)", content, re.M|re.I) else 1920
            ry = int(re.search(r"^PlayResY:\s*(\d+)", content, re.M|re.I).group(1)) if re.search(r"^PlayResY:\s*(\d+)", content, re.M|re.I) else 1080
            return rx, ry

        base_rx, base_ry = get_res(base_content)
        over_rx, over_ry = get_res(overlay_content)

        scale_x = base_rx / over_rx
        scale_y = base_ry / over_ry

        def scale_drawing(match):
            """Dynamically scales ASS vector drawing commands (e.g. 'm 0 0 l 100 0')"""
            tokens = match.group(0).split()
            out = []
            is_x = True
            for t in tokens:
                if t.isalpha():
                    out.append(t)
                    is_x = True
                else:
                    val = int(t)
                    out.append(str(int(val * scale_x)) if is_x else str(int(val * scale_y)))
                    is_x = not is_x
            return " ".join(out)

        overlay_events = []
        overlay_styles = []
        
        in_events, in_styles = False, False
        for line in overlay_content.splitlines():
            if line.startswith("[Events]"):
                in_events, in_styles = True, False
                continue
            elif line.startswith("[V4+ Styles]"):
                in_styles, in_events = True, False
                continue
            elif line.startswith("["):
                in_events, in_styles = False, False
                continue
                
            if in_events and line.startswith("Dialogue:"):
                line = re.sub(r"\{\\pos\((-?\d+),(-?\d+)\)\}", lambda m: f"{{\\pos({int(int(m.group(1))*scale_x)},{int(int(m.group(2))*scale_y)})}}", line)
                line = re.sub(r"m\s+-?\d+\s+-?\d+(?:\s+[a-zA-Z]\s+-?\d+\s+-?\d+)+", scale_drawing, line)
                overlay_events.append(line)
                
            if in_styles and line.startswith("Style:"):
                if "CensorBox" in line:
                    overlay_styles.append(line)

        # Reconstruct Base File with injected overlay
        out_lines = []
        style_injected = False
        
        for line in base_content.splitlines():
            out_lines.append(line)
            if line.strip().startswith("Format:") and "Name" in line and "Fontname" in line and not style_injected:
                out_lines.extend(overlay_styles)
                style_injected = True
                
        out_lines.extend(overlay_events)
        final_ass = "\n".join(out_lines)
        
        out_name = os.path.basename(base_path).replace(".ass", "_merged.ass")
        out_path = os.path.join(TEMP_DIR, out_name)
        
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(final_ass)
            
        return True, out_path
    except Exception as e:
        return False, f"Merge Error: {str(e)}"