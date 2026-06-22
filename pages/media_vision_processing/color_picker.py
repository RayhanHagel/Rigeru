import streamlit as st
from PIL import Image
from utilities.util_color_picker import get_color_from_coords

# Import the third-party click component
try:
    from streamlit_image_coordinates import streamlit_image_coordinates
except ImportError:
    streamlit_image_coordinates = None


# --- Fragment: Isolated Interactive Color Picker ---
@st.fragment
def render_interactive_picker(uploaded_file):
    st.markdown("### :material/ads_click: Click on the image below:")
    
    # ISSUE 17 FIX: Convert the uploaded file into a PIL Image object first
    pil_image = Image.open(uploaded_file)
    image_bytes = uploaded_file.getvalue()
    
    # Render the interactive image using the PIL object
    click_coords = streamlit_image_coordinates(pil_image, key="color_picker")
    
    # If the user has clicked somewhere
    if click_coords is not None:
        x, y = click_coords["x"], click_coords["y"]
        
        success, result = get_color_from_coords(image_bytes, x, y)
        
        if success:
            st.divider()
            st.subheader("Selected Color")
            
            col_swatch, col_data = st.columns([1, 4], vertical_alignment="center")
            
            # Display a visual swatch of the selected color
            with col_swatch:
                st.markdown(
                    f"""
                    <div style="
                        background-color: {result['hex']}; 
                        width: 80px; 
                        height: 80px; 
                        border-radius: 12px; 
                        border: 2px solid #555;
                        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    "></div>
                    """, 
                    unsafe_allow_html=True
                )
            
            # Display the copyable code text
            with col_data:
                st.markdown(f"**HEX:** `{result['hex']}`")
                st.markdown(f"**RGB:** `{result['rgb']}`")
        else:
            st.error(result)


# --- Main App ---
st.header(":material/palette: Image Color Picker")
st.markdown("Upload an image and **click anywhere on it** to extract the exact HEX and RGB color codes.")

if not streamlit_image_coordinates:
    st.error("Missing dependency. Please run: `pip install streamlit-image-coordinates`")
else:
    with st.container(border=True):
        # File uploader remains outside the fragment so uploading a new
        # image updates global state naturally.
        uploaded_file = st.file_uploader(
            "Upload Image", 
            type=["png", "jpg", "jpeg", "webp", "bmp"]
        )
        
        if uploaded_file:
            # Delegate rendering and interactions to the fragment
            render_interactive_picker(uploaded_file)