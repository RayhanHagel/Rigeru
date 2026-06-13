import streamlit as st
from utilities.util_diff import extract_text, generate_diff_html
from utilities.util_persistent import apply_footer

st.header("📝 Document & Text Diff Checker")
st.markdown("Compare two texts or documents locally to highlight additions, deletions, and changes.")

# Input Method Selection
input_method = st.radio("Input Method", ["Paste Text", "Upload Files"], horizontal=True)

text_a = ""
text_b = ""

col1, col2 = st.columns(2)

if input_method == "Paste Text":
    with col1:
        text_a = st.text_area("Original Text (Document A)", height=250)
    with col2:
        text_b = st.text_area("Modified Text (Document B)", height=250)
        
else:
    with col1:
        file_a = st.file_uploader("Upload Original (Document A)", type=["txt", "pdf", "docx"])
        if file_a:
            success, result = extract_text(file_a.getvalue(), file_a.name)
            if success:
                text_a = result
                st.success(f"Extracted {len(text_a)} characters.")
            else:
                st.error(result)
                
    with col2:
        file_b = st.file_uploader("Upload Modified (Document B)", type=["txt", "pdf", "docx"])
        if file_b:
            success, result = extract_text(file_b.getvalue(), file_b.name)
            if success:
                text_b = result
                st.success(f"Extracted {len(text_b)} characters.")
            else:
                st.error(result)

st.divider()

if st.button("🔍 Compare Documents", type="primary", width="stretch"):
    if not text_a and not text_b:
        st.warning("Please provide content for both documents to compare.")
    else:
        with st.spinner("Analyzing differences..."):
            diff_html = generate_diff_html(text_a, text_b)
            
            st.markdown("### Comparison Results")
            st.markdown(
                "🟢 **Added** | 🔴 **Deleted** | 🟡 **Changed**"
            )
            
            # Wrap the diff in a scrollable container to preserve the UI
            with st.container(height=600, border=True):
                st.html(diff_html)

apply_footer()