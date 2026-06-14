import streamlit as st
from utilities.util_expense import extract_receipt_data
from utilities.util_persistent import apply_footer

st.header("🧾 AI Expense Tracker (Donut Scanner)")
st.markdown("Upload a receipt or invoice image. The Hugging Face **Donut VLM** will scan and parse the document locally into structured JSON.")

# --- Optimization Settings ---
with st.container(border=True):
    st.subheader("⚙️ Model Settings")
    optimization = st.selectbox(
        "Hardware Optimization",
        options=["PyTorch (Standard)", "FP16 (GPU Speedup)", "INT8 (Max GPU Memory Save)"],
        index=0,
        help="Select hardware optimization. INT8 requires the `bitsandbytes` library."
    )

with st.container(border=True):
    uploaded_file = st.file_uploader(
        "Upload Receipt Image", 
        type=["png", "jpg", "jpeg", "webp"],
        help="Make sure the text is well-lit and clearly readable."
    )
    
    if uploaded_file:
        col_img, col_data = st.columns([1, 2])
        
        with col_img:
            st.image(uploaded_file, caption="Scanned Receipt", width="stretch")
            
        with col_data:
            if st.button("🔍 Extract Data", type="primary", width="stretch"):
                with st.spinner("Processing with Donut Model... (This may take a moment on the first run)"):
                    success, result = extract_receipt_data(uploaded_file.getvalue(), optimization)
                    
                    if success:
                        st.success("Extraction Complete!")
                        
                        # Display parsed metrics
                        met1, met2 = st.columns(2)
                        met1.metric("Date", result.get("date", "Not Found"))
                        met2.metric("Total Amount", result.get("total", "Not Found"))
                        
                        st.divider()
                        
                        # Display raw Donut JSON in an expander
                        with st.expander("Show Raw JSON Output", expanded=False):
                            st.code(result.get("raw_text", ""), language="json")
                    else:
                        st.error(result)

apply_footer()