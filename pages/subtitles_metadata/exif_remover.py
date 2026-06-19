import streamlit as st
from utilities.util_exif import get_exif_data, strip_exif


st.header("🕵️‍♂️ EXIF Metadata Stripper")
st.markdown("Upload a photo to view hidden metadata (like GPS coordinates or camera info) and strip it out for privacy.")

with st.container(border=True):
    uploaded_file = st.file_uploader("Upload Image", type=["jpg", "jpeg", "png", "webp", "tiff"])
    
    if uploaded_file:
        image_bytes = uploaded_file.getvalue()
        
        col_img, col_data = st.columns([1, 1.5])
        
        with col_img:
            st.image(image_bytes, caption="Original Image", width="stretch")
            
        with col_data:
            st.subheader("Extracted Metadata")
            
            with st.spinner("Analyzing EXIF data..."):
                success, exif_dict = get_exif_data(image_bytes)
                
            if not success:
                st.error(exif_dict)
            elif not exif_dict:
                st.success("✅ This image is completely clean! No EXIF data was found.")
            else:
                st.warning(f"⚠️ Found {len(exif_dict)} metadata tags in this image.")
                
                with st.expander("View Hidden Metadata Details", expanded=True):
                    # Convert dict to a clean table for viewing
                    st.dataframe(
                        [{"Tag": k, "Value": v} for k, v in exif_dict.items()],
                        width="stretch",
                        hide_index=True
                    )
                
                st.divider()
                
                if st.button("🧹 Strip Metadata & Download Clean Image", type="primary", width="stretch"):
                    with st.spinner("Sanitizing image locally..."):
                        strip_success, clean_bytes = strip_exif(image_bytes)
                        
                        if strip_success:
                            st.success("Metadata successfully stripped!")
                            st.download_button(
                                label="💾 Download Sanitized Image",
                                data=clean_bytes,
                                file_name=f"clean_{uploaded_file.name}",
                                mime=uploaded_file.type,
                                type="secondary",
                                width="stretch"
                            )
                        else:
                            st.error(clean_bytes)

