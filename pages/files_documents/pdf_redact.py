import streamlit as st
from utilities.util_pdf_redact import redact_pdf_text
from utilities.util_persistent import apply_footer

st.header("⬛ PDF Redactor")
st.markdown("Permanently censor sensitive words or phrases from your PDF documents locally. The underlying text data is completely removed.")

with st.container(border=True):
    uploaded_file = st.file_uploader(
        "Upload PDF Document", 
        type=["pdf"],
        help="Make sure the PDF contains actual text, not just scanned images of text."
    )

    if uploaded_file:
        st.markdown("### Words to Redact")
        target_words_input = st.text_area(
            "Enter words or phrases to censor (separated by commas)",
            placeholder="e.g., John Doe, Password123, Confidential, Account Number"
        )
        
        st.info("⚠️ **Note:** This process is case-sensitive and requires exact matches.")

        if st.button("🔐 Redact Document", type="primary", width="stretch"):
            if not target_words_input.strip():
                st.warning("Please enter at least one word to redact.")
            else:
                # Parse the input string into a clean list of words
                words_list = [w.strip() for w in target_words_input.split(",") if w.strip()]
                
                with st.spinner(f"Scanning document for {len(words_list)} term(s)..."):
                    success, result, total_count = redact_pdf_text(uploaded_file.getvalue(), words_list)
                    
                    if success:
                        if total_count == 0:
                            st.warning("No matches found. No redactions were made.")
                        else:
                            st.success(f"Successfully made {total_count} redaction(s)!")
                            
                            st.download_button(
                                label="💾 Download Redacted PDF",
                                data=result,
                                file_name=f"redacted_{uploaded_file.name}",
                                mime="application/pdf",
                                type="primary",
                                width="stretch"
                            )
                    else:
                        st.error(result)

apply_footer()