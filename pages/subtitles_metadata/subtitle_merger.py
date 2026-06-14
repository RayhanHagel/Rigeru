import os
import streamlit as st
from utilities.util_ass_merger import merge_ass_files, TEMP_DIR
from utilities.util_persistent import apply_footer

st.header("🎞️ ASS Subtitle Merger")
st.markdown("Combine two `.ass` subtitle files together. Perfect for merging AI censor boxes with your existing translated subtitles. Automatically handles coordinate/resolution scaling.")

with st.container(border=True):
    col1, col2 = st.columns(2)
    with col1:
        base_file = st.file_uploader("1️⃣ Upload Base Subtitle (.ass)", type=['ass'], help="Your main text subtitle. Its resolution will be kept.")
    with col2:
        overlay_file = st.file_uploader("2️⃣ Upload Overlay (.ass)", type=['ass'], help="The subtitle you want to paste on top (e.g. Censor Boxes).")

    if st.button("🔄 Merge Subtitles", type="primary", width='stretch'):
        if not base_file or not overlay_file:
            st.warning("Please upload both `.ass` files.")
        else:
            os.makedirs(TEMP_DIR, exist_ok=True)
            base_path = os.path.join(TEMP_DIR, "base_" + base_file.name)
            overlay_path = os.path.join(TEMP_DIR, "overlay_" + overlay_file.name)
            
            with open(base_path, "wb") as f: f.write(base_file.getbuffer())
            with open(overlay_path, "wb") as f: f.write(overlay_file.getbuffer())
            
            with st.spinner("Calculating coordinate scaling and merging files..."):
                success, result = merge_ass_files(base_path, overlay_path)
                
                if success:
                    st.success("Successfully merged subtitles!")
                    with open(result, "rb") as f:
                        st.download_button(
                            label="💾 Download Merged Subtitle",
                            data=f,
                            file_name=os.path.basename(result),
                            mime="text/plain",
                            width='stretch',
                            type="primary"
                        )
                else:
                    st.error(result)

apply_footer()