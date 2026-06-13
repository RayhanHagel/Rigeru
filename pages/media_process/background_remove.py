import streamlit as st
from utilities.util_bg_remove import remove_image_background
from utilities.util_persistent import apply_footer

st.header("🪄 AI Background Remover")
st.markdown("Upload an image featuring a clear subject (person, animal, or object) to instantly remove its background locally.")

with st.container(border=True):
    uploaded_file = st.file_uploader(
        "Upload Image", 
        type=["png", "jpg", "jpeg", "webp"],
        help="Higher resolution images with clear contrast between subject and background work best."
    )
    
    if uploaded_file:
        col1, col2 = st.columns(2)
        
        with col1:
            st.markdown("### Original Image")
            st.image(uploaded_file, width="stretch")
            
        with col2:
            st.markdown("### Result (Transparent)")
            
            # Use a unique key in session state to hold the processed image 
            # so it doesn't disappear when the user clicks download
            state_key = f"bg_removed_{uploaded_file.name}"
            
            if state_key not in st.session_state:
                if st.button("✨ Remove Background", type="primary", width="stretch"):
                    with st.spinner("Processing image locally (this may take a few seconds)..."):
                        success, result = remove_image_background(uploaded_file.getvalue())
                        
                        if success:
                            st.session_state[state_key] = result
                            st.rerun()
                        else:
                            st.error(result)
            else:
                # Display the processed image
                processed_bytes = st.session_state[state_key]
                st.image(processed_bytes, width="stretch")
                
                # Download button for the new PNG
                st.download_button(
                    label="💾 Download Transparent PNG",
                    data=processed_bytes,
                    file_name=f"nobg_{uploaded_file.name.split('.')[0]}.png",
                    mime="image/png",
                    type="primary",
                    width="stretch"
                )
                
                if st.button("🗑️ Clear Result", width="stretch"):
                    del st.session_state[state_key]
                    st.rerun()

apply_footer()