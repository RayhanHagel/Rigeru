import io
from PIL import Image, ImageDraw, ImageFilter
from pygments import highlight
from pygments.lexers import get_lexer_by_name, guess_lexer
from pygments.formatters import ImageFormatter

def generate_carbon_image(code: str, language: str = "python", theme: str = "monokai", bg_color: str = "#ABB8C3") -> bytes:
    """
    Generates a beautiful image of source code similar to carbon.now.sh
    """
    # 1. Guess or get the lexer
    try:
        if language.lower() == "auto":
            lexer = guess_lexer(code)
        else:
            lexer = get_lexer_by_name(language)
    except ValueError:
        lexer = get_lexer_by_name("text")

    # 2. Configure Pygments ImageFormatter
    formatter = ImageFormatter(
        font_name="Courier New",
        style=theme,
        line_numbers=True,
        line_number_bg="#282C34" if theme == "monokai" else None,
        font_size=18,
        line_pad=8,
        pad_x=20
    )
    
    # Generate the base code image
    code_png = highlight(code, lexer, formatter)
    code_img = Image.open(io.BytesIO(code_png)).convert("RGBA")

    # 3. Setup window dimensions (Code + Mac Top Bar)
    padding = 40
    top_bar_height = 45
    window_width = code_img.width
    window_height = code_img.height + top_bar_height

    # Get the background color of the chosen Pygments theme
    theme_bg_color = formatter.background_color
    window_img = Image.new("RGBA", (window_width, window_height), color=theme_bg_color)
    
    # Paste the code image below the top bar
    window_img.paste(code_img, (0, top_bar_height))

    # 4. Draw Mac Window Top Bar Buttons
    draw = ImageDraw.Draw(window_img)
    radius = 6
    spacing = 20
    start_x = 20
    start_y = 22 # Vertically centered in the top bar

    # Red, Yellow, Green circles
    draw.ellipse((start_x, start_y-radius, start_x+radius*2, start_y+radius), fill="#FF5F56")
    draw.ellipse((start_x+spacing, start_y-radius, start_x+spacing+radius*2, start_y+radius), fill="#FFBD2E")
    draw.ellipse((start_x+spacing*2, start_y-radius, start_x+spacing*2+radius*2, start_y+radius), fill="#27C93F")

    # 5. Create the final background canvas with padding
    bg_padding = 60
    final_width = window_width + bg_padding * 2
    final_height = window_height + bg_padding * 2
    final_img = Image.new("RGBA", (final_width, final_height), color=bg_color)

    # 6. Add Drop Shadow
    shadow = Image.new("RGBA", (final_width, final_height), color=(0,0,0,0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_rect = [bg_padding - 5, bg_padding - 5, bg_padding + window_width + 5, bg_padding + window_height + 5]
    shadow_draw.rounded_rectangle(shadow_rect, radius=12, fill=(0, 0, 0, 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(15))
    final_img.paste(shadow, (0, 0), shadow)

    # 7. Apply Rounded Corners to the code window and paste it
    mask = Image.new("L", (window_width, window_height), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle((0, 0, window_width, window_height), radius=10, fill=255)
    
    final_img.paste(window_img, (bg_padding, bg_padding), mask)

    # 8. Save to bytes buffer
    output_buffer = io.BytesIO()
    final_img.save(output_buffer, format="PNG")
    return output_buffer.getvalue()