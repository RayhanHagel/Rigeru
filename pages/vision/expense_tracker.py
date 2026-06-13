import streamlit as st
from utilities.util_expense import extract_receipt_data
from utilities.util_persistent import apply_footer

st.header("🧾 Local Expense Tracker (Receipt Scanner)")
st.markdown("Upload a receipt image. The AI will scan it locally to extract the date and total amount.")

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
                with st.spinner("Scanning locally with Tesseract OCR..."):
                    success, result = extract_receipt_data(uploaded_file.getvalue())
                    
                    if success:
                        st.success("Extraction Complete!")
                        
                        # Display parsed metrics
                        met1, met2 = st.columns(2)
                        met1.metric("Date", result["date"])
                        met2.metric("Total Amount", result["total"])
                        
                        st.divider()
                        
                        # Display raw text in an expander in case parsing missed something
                        with st.expander("Show Raw Extracted Text", expanded=False):
                            st.text(result["raw_text"])
                    else:
                        st.error(result)

apply_footer()