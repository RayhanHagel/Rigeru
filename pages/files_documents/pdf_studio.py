import os
import sys
import subprocess
import threading
import streamlit as st
from streamlit.runtime.scriptrunner import add_script_run_ctx

from utilities.util_persistent import THEMES


# Fetch the active theme (fallback to Default if not set)
current_theme_name = st.session_state.get("selected_theme", "Nebula (Default)")
theme_colors = THEMES[current_theme_name]


# --- UI Rendering Functions ---
def _render_redact_ui():
    """Renders the PDF redaction interface."""
    from utilities.util_pdf_redact import redact_pdf_text
    
    st.header(":material/ink_eraser: PDF Redactor")
    st.markdown("Permanently censor sensitive words or phrases from your PDF documents locally. The underlying text data is completely removed.")

    with st.container(border=True):
        uploaded_file = st.file_uploader(
            "Upload PDF Document", 
            type=["pdf"],
            help="Make sure the PDF contains actual text, not just scanned images of text.",
            label_visibility="collapsed"
        )

        if uploaded_file:
            st.markdown("### Words to Redact")
            target_words_input = st.text_area(
                "Enter words or phrases to censor (separated by commas)",
                placeholder="e.g., John Doe, Password123, Confidential, Account Number",
                label_visibility="collapsed"
            )
            
            st.info("Note: This process is case-sensitive and requires exact matches.", icon=":material/info:")

            if st.button("Redact Document", type="primary", icon=":material/lock:", use_container_width=True):
                if not target_words_input.strip():
                    st.warning("Please enter at least one word to redact.", icon=":material/warning:")
                else:
                    words_list = [w.strip() for w in target_words_input.split(",") if w.strip()]
                    
                    with st.spinner(f"Scanning document for {len(words_list)} term(s)..."):
                        success, result, total_count = redact_pdf_text(uploaded_file.getvalue(), words_list)
                        
                        if success:
                            if total_count == 0:
                                st.warning("No matches found. No redactions were made.", icon=":material/warning:")
                            else:
                                st.success(f"Successfully made {total_count} redaction(s)!", icon=":material/check_circle:")
                                
                                st.download_button(
                                    label="Download Redacted PDF",
                                    data=result,
                                    file_name=f"redacted_{uploaded_file.name}",
                                    mime="application/pdf",
                                    type="primary",
                                    icon=":material/download:",
                                    use_container_width=True
                                )
                        else:
                            st.error(result, icon=":material/error:")


def _render_diff_ui():
    """Renders the document diff interface with lazy backend loading."""
    from utilities.util_pdf_diff import extract_text, generate_diff_html

    st.header(":material/difference: Document & Text Diff Checker")
    st.markdown(
        "Compare two texts or documents locally to highlight additions, deletions, and changes.")

    input_method = st.radio("Input Method", [
                            "Paste Text", "Upload Files"], horizontal=True, label_visibility="collapsed")

    text_a, text_b = "", ""
    col1, col2 = st.columns(2)

    if input_method == "Paste Text":
        with col1:
            text_a = st.text_area("Original Text (Document A)", height=250)
        with col2:
            text_b = st.text_area("Modified Text (Document B)", height=250)

    else:
        with col1:
            file_a = st.file_uploader("Upload Original (Document A)", type=[
                                      "txt", "pdf", "docx"])
            if file_a:
                success, result = extract_text(file_a.getvalue(), file_a.name)
                if success:
                    text_a = result
                    st.success(
                        f"Extracted {len(text_a)} characters.", icon=":material/check_circle:")
                else:
                    st.error(result, icon=":material/error:")

        with col2:
            file_b = st.file_uploader("Upload Modified (Document B)", type=[
                                      "txt", "pdf", "docx"])
            if file_b:
                success, result = extract_text(file_b.getvalue(), file_b.name)
                if success:
                    text_b = result
                    st.success(
                        f"Extracted {len(text_b)} characters.", icon=":material/check_circle:")
                else:
                    st.error(result, icon=":material/error:")

    st.divider()

    if st.button("Compare Documents", type="primary", icon=":material/search:", use_container_width=True):
        if not text_a and not text_b:
            st.warning(
                "Please provide content for both documents to compare.", icon=":material/warning:")
        else:
            with st.spinner("Analyzing differences..."):
                diff_html = generate_diff_html(text_a, text_b)

                st.markdown("### Comparison Results")
                # Using native Streamlit markdown colors for a cleaner UI
                st.markdown(
                    f"""
                    <div style="color: {theme_colors['TEXT']};">
                        <b>Added</b> | <b>Deleted</b> | <b>Changed</b>
                    </div>
                    """, 
                    unsafe_allow_html=True
                )

                with st.container(height=600, border=True):
                    st.html(diff_html)


def _render_search_ui():
    """Renders the document search interface."""
    from utilities.util_pdf_search import build_index, search_documents
    if "ds_status" not in st.session_state:
        st.session_state.ds_status = "Ready."

    st.header(":material/search: Personal Document Search")
    st.markdown(
        "Instantly search inside your PDFs, Word documents, and text files offline.")

    with st.expander(":material/settings: Indexing Settings", expanded=False):
        st.info("You must build the index at least once before searching. Rebuild it when you add new files.",
                icon=":material/info:")
        col_path, col_btn = st.columns([3, 1], vertical_alignment="bottom")

        default_dir = os.path.join(os.path.expanduser('~'), 'Documents')
        target_dir = col_path.text_input("Folder to Index", value=default_dir)

        if col_btn.button("Build Index", icon=":material/build:", use_container_width=True):
            if not os.path.isdir(target_dir):
                st.session_state.ds_status = "Error: Directory not found."
            else:
                st.session_state.ds_status = "Building index in background..."

                def _build_index_bg():
                    indexed, skipped = build_index(target_dir)
                    st.session_state.ds_status = f"Indexed {indexed} new/modified files. Skipped {skipped} unchanged files."

                index_thread = threading.Thread(target=_build_index_bg)
                add_script_run_ctx(index_thread)
                index_thread.start()
                st.rerun()

        st.caption(st.session_state.ds_status)

    st.divider()

    col_search, col_exec = st.columns([4, 1], vertical_alignment="bottom")
    search_query = col_search.text_input(
        "Search Documents",
        placeholder="Type a keyword, phrase, or name...",
        key="ds_query",
        label_visibility="collapsed"
    )

    if col_exec.button("Search", type="primary", icon=":material/search:", use_container_width=True) or search_query:
        if search_query:
            with st.spinner("Searching index..."):
                success, msg, results = search_documents(search_query)

            if not success:
                st.warning(msg, icon=":material/warning:")
            elif len(results) == 0:
                st.info("No matching documents found.", icon=":material/info:")
            else:
                st.success(msg, icon=":material/check_circle:")

                for idx, res in enumerate(results):
                    with st.container(border=True):
                        r_col_title, r_col_btn = st.columns(
                            [4, 1], vertical_alignment="center")
                        r_col_title.markdown(
                            f"#### :material/description: {res['title']}")
                        r_col_title.caption(f"**Path:** `{res['path']}`")

                        if r_col_btn.button("Open File", key=f"open_{idx}", icon=":material/folder_open:", use_container_width=True):
                            try:
                                if sys.platform == "win32":
                                    os.startfile(res['path'])
                                elif sys.platform == "darwin":
                                    subprocess.call(["open", res['path']])
                                else:
                                    subprocess.call(["xdg-open", res['path']])
                            except Exception as e:
                                st.toast(
                                    f"Failed to open file: {e}", icon=":material/error:")

                        if res.get('snippet'):
                            st.markdown(f"> {res['snippet']}",
                                        unsafe_allow_html=True)
        else:
            st.warning("Please enter a search term.",
                       icon=":material/warning:")


def _render_compress_ui():
    """Renders the PDF compression interface with lazy backend loading."""
    # Lazy Import the Backend
    from utilities.util_pdf_compress import compress_pdf

    st.header(":material/compress: Compress PDF")
    st.markdown(
        "Reduce the file size of your PDF documents locally. The optimized file will be prepared for download.")

    with st.container(border=True):
        uploaded_file = st.file_uploader(
            "Upload PDF to Compress",
            type=["pdf"],
            label_visibility="collapsed"
        )

        if uploaded_file:
            original_size_kb = len(uploaded_file.getvalue()) / 1024
            st.info(
                f"**Original Size:** {original_size_kb:.2f} KB", icon=":material/description:")

            if st.button("Optimize & Compress", type="primary", icon=":material/compress:", use_container_width=True):
                with st.spinner("Analyzing and compressing..."):
                    success, compressed_bytes, orig_size, new_size, percent, msg = compress_pdf(
                        uploaded_file.getvalue())

                    if not success:
                        st.error(msg, icon=":material/error:")
                    elif percent == 0.0:
                        st.warning(
                            "The PDF is already highly optimized. No further compression could be applied.", icon=":material/warning:")
                    else:
                        st.success("Compression successful!",
                                   icon=":material/check_circle:")

                        # Display clean metrics for the compression results
                        with st.container(border=True):
                            col_met1, col_met2, col_met3 = st.columns(3)
                            col_met1.metric("Original Size",
                                            f"{(orig_size / 1024):.2f} KB")
                            col_met2.metric(
                                "New Size", f"{(new_size / 1024):.2f} KB")
                            col_met3.metric("Space Saved", f"{percent:.1f}%")

                        st.download_button(
                            label="Save Compressed PDF",
                            data=compressed_bytes,
                            file_name=f"compressed_{uploaded_file.name}",
                            mime="application/pdf",
                            type="primary",
                            icon=":material/save:",
                            use_container_width=True
                        )


def _render_convert_ui():
    """Renders the PDF Conversion and OCR interface."""
    from utilities.util_pdf_convert import pdf_to_images, images_to_pdf, make_pdf_searchable

    st.header(":material/transform: Convert & OCR")
    st.markdown(
        "Transform documents between formats or make scanned PDFs searchable via OCR.")

    # Clean Sub-Navigation
    conversion_mode = st.radio(
        "Conversion Tool",
        ["PDF to Images", "Images to PDF", "Make Searchable (OCR)"],
        horizontal=True,
        label_visibility="collapsed"
    )

    st.divider()

    if conversion_mode == "PDF to Images":
        with st.container(border=True):
            st.markdown("#### :material/image: PDF to Images")
            pdf_file = st.file_uploader("Upload PDF", type=["pdf"], key="p2i")
            if pdf_file:
                if st.button("Convert to PNGs", type="primary", use_container_width=True):
                    with st.spinner("Extracting pages..."):
                        success, result = pdf_to_images(pdf_file.getvalue())
                        if success:
                            st.success(
                                f"Successfully extracted {len(result)} pages.", icon=":material/check_circle:")
                            for page_num, img_bytes in result:
                                st.download_button(
                                    label=f"Download Page {page_num}",
                                    data=img_bytes,
                                    file_name=f"page_{page_num}_{pdf_file.name.replace('.pdf', '.png')}",
                                    mime="image/png",
                                    icon=":material/download:",
                                    use_container_width=True
                                )
                        else:
                            st.error(result, icon=":material/error:")

    elif conversion_mode == "Images to PDF":
        with st.container(border=True):
            st.markdown("#### :material/picture_as_pdf: Images to PDF")
            img_files = st.file_uploader("Upload Images", type=[
                                         "png", "jpg", "jpeg"], accept_multiple_files=True, key="i2p")
            if img_files:
                st.info(
                    f"{len(img_files)} images staged for conversion.", icon=":material/info:")
                if st.button("Compile into PDF", type="primary", use_container_width=True):
                    with st.spinner("Compiling document..."):
                        bytes_list = [f.getvalue() for f in img_files]
                        success, result = images_to_pdf(bytes_list)
                        if success:
                            st.success("PDF compiled successfully!",
                                       icon=":material/check_circle:")
                            st.download_button(
                                label="Download Merged PDF",
                                data=result,
                                file_name="converted_images.pdf",
                                mime="application/pdf",
                                type="primary",
                                icon=":material/download:",
                                use_container_width=True
                            )
                        else:
                            st.error(result, icon=":material/error:")

    elif conversion_mode == "Make Searchable (OCR)":
        with st.container(border=True):
            st.markdown(
                "#### :material/document_scanner: Optical Character Recognition")
            st.caption("Adds a selectable text layer to scanned documents.")
            ocr_file = st.file_uploader(
                "Upload Scanned PDF", type=["pdf"], key="ocr")
            if ocr_file:
                if st.button("Run OCR Engine", type="primary", use_container_width=True):
                    with st.spinner("Analyzing text (this may take a moment)..."):
                        success, result = make_pdf_searchable(
                            ocr_file.getvalue())
                        if success:
                            st.success("Text layer generated successfully!",
                                       icon=":material/check_circle:")
                            st.download_button(
                                label="Download Searchable PDF",
                                data=result,
                                file_name=f"ocr_{ocr_file.name}",
                                mime="application/pdf",
                                type="primary",
                                icon=":material/download:",
                                use_container_width=True
                            )
                        else:
                            st.error(result, icon=":material/error:")


def _render_security_ui():
    """Renders the PDF Security and Watermark interface."""
    from utilities.util_pdf_security import manage_pdf_password, add_pdf_watermark

    st.header(":material/lock: Security & Watermarks")
    st.markdown(
        "Protect your documents with encryption, unlock secured files, or apply custom watermarks.")

    # Clean Sub-Navigation
    security_mode = st.radio(
        "Security Tool",
        ["Lock/Unlock PDF", "Add Watermark"],
        horizontal=True,
        label_visibility="collapsed"
    )

    st.divider()

    if security_mode == "Lock/Unlock PDF":
        with st.container(border=True):
            action_type = st.radio(
                "Action", ["Lock (Add Password)", "Unlock (Remove Password)"], horizontal=True)
            sec_file = st.file_uploader(
                "Upload PDF", type=["pdf"], key="sec_file")

            if sec_file:
                password = st.text_input(
                    "Enter Password", type="password", placeholder="••••••••")

                btn_label = "Encrypt Document" if "Lock" in action_type else "Decrypt Document"
                btn_icon = ":material/lock:" if "Lock" in action_type else ":material/lock_open:"

                if st.button(btn_label, type="primary", use_container_width=True, icon=btn_icon):
                    if not password:
                        st.warning("Please enter a password.",
                                   icon=":material/warning:")
                    else:
                        action = "lock" if "Lock" in action_type else "unlock"
                        with st.spinner("Processing document..."):
                            success, result = manage_pdf_password(
                                sec_file.getvalue(), password, action)

                            if success:
                                st.success(
                                    f"Document successfully {'secured' if action == 'lock' else 'unlocked'}!", icon=":material/check_circle:")
                                st.download_button(
                                    label="Download Processed PDF",
                                    data=result,
                                    file_name=f"{'locked' if action == 'lock' else 'unlocked'}_{sec_file.name}",
                                    mime="application/pdf",
                                    type="primary",
                                    icon=":material/download:",
                                    use_container_width=True
                                )
                            else:
                                st.error(result, icon=":material/error:")

    elif security_mode == "Add Watermark":
        with st.container(border=True):
            st.markdown("#### :material/branding_watermark: Apply Watermark")
            wm_file = st.file_uploader(
                "Upload PDF", type=["pdf"], key="wm_file")

            if wm_file:
                watermark_text = st.text_input(
                    "Watermark Text", placeholder="e.g., CONFIDENTIAL")
                wm_opacity = st.slider(
                    "Opacity", min_value=0.1, max_value=1.0, value=0.3, step=0.1)

                if st.button("Apply Watermark", type="primary", icon=":material/format_paint:", use_container_width=True):
                    if not watermark_text:
                        st.warning("Please enter text for the watermark.",
                                   icon=":material/warning:")
                    else:
                        with st.spinner("Applying watermark..."):
                            success, result = add_pdf_watermark(
                                wm_file.getvalue(), watermark_text, wm_opacity)

                            if success:
                                st.success(
                                    "Watermark applied successfully!", icon=":material/check_circle:")
                                st.download_button(
                                    label="Download Watermarked PDF",
                                    data=result,
                                    file_name=f"watermarked_{wm_file.name}",
                                    mime="application/pdf",
                                    type="primary",
                                    icon=":material/download:",
                                    use_container_width=True
                                )
                            else:
                                st.error(result, icon=":material/error:")


def _render_metadata_ui():
    """Renders the PDF Metadata and Authenticity interface."""
    from utilities.util_pdf_metadata import get_pdf_metadata, update_pdf_metadata, check_pdf_authenticity

    st.header(":material/info: Metadata & Authenticity")
    st.markdown(
        "Inspect or modify hidden document properties, and verify file health and signatures.")

    mode = st.radio(
        "Tool Selection",
        ["Edit Metadata", "Health & Authenticity Check"],
        horizontal=True,
        label_visibility="collapsed"
    )

    st.divider()

    if mode == "Edit Metadata":
        with st.container(border=True):
            meta_file = st.file_uploader("Upload PDF to Inspect", type=[
                                         "pdf"], key="meta_file")

            if meta_file:
                success, metadata = get_pdf_metadata(meta_file.getvalue())

                if success:
                    st.markdown("### Document Properties")
                    with st.form("metadata_form"):
                        # We use default empty strings if metadata is missing
                        col1, col2 = st.columns(2)
                        with col1:
                            new_title = st.text_input(
                                "Title", value=metadata.get("title", ""))
                            new_author = st.text_input(
                                "Author", value=metadata.get("author", ""))
                            new_subject = st.text_input(
                                "Subject", value=metadata.get("subject", ""))
                        with col2:
                            new_keywords = st.text_input(
                                "Keywords", value=metadata.get("keywords", ""))
                            new_creator = st.text_input(
                                "Creator Tool", value=metadata.get("creator", ""))
                            new_producer = st.text_input(
                                "Producer", value=metadata.get("producer", ""))

                        st.caption(
                            "Creation and Modification dates are preserved automatically.")

                        if st.form_submit_button("Update Properties", type="primary", icon=":material/save:", use_container_width=True):
                            updated_meta = {
                                "title": new_title,
                                "author": new_author,
                                "subject": new_subject,
                                "keywords": new_keywords,
                                "creator": new_creator,
                                "producer": new_producer
                            }

                            with st.spinner("Applying changes..."):
                                update_success, new_bytes = update_pdf_metadata(
                                    meta_file.getvalue(), updated_meta)
                                if update_success:
                                    st.success(
                                        "Metadata updated successfully!", icon=":material/check_circle:")
                                    st.download_button(
                                        label="Download Updated PDF",
                                        data=new_bytes,
                                        file_name=f"updated_{meta_file.name}",
                                        mime="application/pdf",
                                        type="primary",
                                        icon=":material/download:",
                                        use_container_width=True
                                    )
                                else:
                                    st.error(
                                        new_bytes, icon=":material/error:")
                else:
                    st.error(metadata, icon=":material/error:")

    elif mode == "Health & Authenticity Check":
        with st.container(border=True):
            auth_file = st.file_uploader("Upload Document for Analysis", type=[
                                         "pdf"], key="auth_file")

            if auth_file:
                with st.spinner("Analyzing file structures..."):
                    success, report = check_pdf_authenticity(
                        auth_file.getvalue())

                    if success:
                        st.markdown("### Diagnostic Report")

                        # Render visual status indicators
                        if report["is_corrupt"]:
                            st.error(
                                "**File Status:** Corrupted or Invalid PDF Structure", icon=":material/warning:")
                        else:
                            st.success("**File Status:** Healthy",
                                       icon=":material/check_circle:")

                        if report["needs_password"]:
                            st.warning(
                                "**Encryption:** Document is locked with a password. Deep analysis restricted.", icon=":material/lock:")
                        else:
                            st.info("**Encryption:** Document is unlocked.",
                                    icon=":material/lock_open:")

                        if report["has_digital_signature"]:
                            st.success(
                                "**Signatures:** Digital Signature fields detected.", icon=":material/verified:")
                        elif not report["is_corrupt"] and not report["needs_password"]:
                            st.info(
                                "**Signatures:** No digital signatures found.", icon=":material/description:")

                        # File specs
                        if not report["is_corrupt"] and not report["needs_password"]:
                            st.divider()
                            c1, c2 = st.columns(2)
                            c1.metric("Page Count", report["page_count"])
                            c2.metric("PDF Version",
                                      f"v{report['pdf_version']}")
                    else:
                        st.error(report, icon=":material/error:")


def _render_ops_ui():
    """Renders the Page Operations interface, including MUI Drag & Drop."""
    from utilities.util_pdf_ops import merge_pdfs, split_pdf, remove_specific_pages, remove_blank_pages, resize_pdf_pages

    # Lazy load streamlit-elements for the drag-and-drop UI
    try:
        from streamlit_elements import elements, mui, dashboard
    except ImportError:
        st.error("Missing dependency for Drag & Drop UI. Run: `pip install streamlit-elements`",
                 icon=":material/error:")
        return

    st.header(":material/layers: Page Operations")
    st.markdown(
        "Reorganize, merge, split, and clean up the structural layout of your PDF documents.")

    ops_mode = st.radio(
        "Tool Selection",
        ["Merge PDFs", "Split / Extract", "Remove Pages",
            "Clean Blank Pages", "Resize Pages"],
        horizontal=True,
        label_visibility="collapsed"
    )

    st.divider()

    if ops_mode == "Merge PDFs":
        with st.container(border=True):
            st.markdown("#### :material/library_add: Drag & Drop Merge")
            st.caption(
                "Upload files, drag the cards to set the order (left-to-right, top-to-bottom), then merge.")

            uploaded_files = st.file_uploader("Upload PDFs to merge", type=[
                                              "pdf"], accept_multiple_files=True, key="merge_files")

            if uploaded_files:
                # Initialize layout state
                if "merge_layout" not in st.session_state:
                    st.session_state.merge_layout = []

                # Handle Drag and Drop callback
                def handle_layout_change(updated_layout):
                    st.session_state.merge_layout = updated_layout

                # Render MUI Elements
                with elements("pdf_drag_drop"):
                    layout = []
                    for i, file in enumerate(uploaded_files):
                        # Default layout: stack them in a grid
                        x_pos = (i % 3) * 4
                        y_pos = (i // 3) * 2
                        layout.append(dashboard.Item(
                            file.name, x_pos, y_pos, 4, 2))

                    with dashboard.Grid(layout, onLayoutChange=handle_layout_change, draggableHandle=".drag-handle"):
                        for file in uploaded_files:
                            with mui.Card(key=file.name, sx={"display": "flex", "flexDirection": "column", "boxShadow": 2}):
                                # The handle area
                                with mui.CardHeader(
                                    title=file.name,
                                    titleTypographyProps={
                                        "variant": "subtitle2", "noWrap": True},
                                    className="drag-handle",
                                    sx={"cursor": "grab", "bgcolor": theme_colors["UI_BG"], "p": 1}
                                ):
                                    pass
                                mui.CardContent(
                                    sx={"flex": 1, "display": "flex", "alignItems": "center", "justifyContent": "center"})

                # Determine the final order based on the user's dashboard layout coordinates
                st.markdown("---")
                if st.button("Merge in Configured Order", type="primary", icon=":material/call_merge:", use_container_width=True):
                    with st.spinner("Compiling document..."):
                        # Sort logic: Primary sort by Y (row), secondary sort by X (column)
                        current_layout = st.session_state.get(
                            "merge_layout", layout)
                        sorted_items = sorted(
                            current_layout, key=lambda item: (item['y'], item['x']))

                        # Map sorted filenames back to the file objects
                        file_dict = {f.name: f for f in uploaded_files}
                        ordered_bytes = [file_dict[item['i']].getvalue(
                        ) for item in sorted_items if item['i'] in file_dict]

                        success, result = merge_pdfs(ordered_bytes)
                        if success:
                            st.success("Successfully merged documents!",
                                       icon=":material/check_circle:")
                            st.download_button(
                                label="Download Merged PDF",
                                data=result,
                                file_name="merged_document.pdf",
                                mime="application/pdf",
                                type="primary",
                                icon=":material/download:",
                                use_container_width=True
                            )
                        else:
                            st.error(result, icon=":material/error:")

    elif ops_mode == "Split / Extract":
        with st.container(border=True):
            st.markdown("#### :material/content_cut: Extract Page Range")
            split_file = st.file_uploader(
                "Upload PDF", type=["pdf"], key="split_file")
            if split_file:
                c1, c2 = st.columns(2)
                start_p = c1.number_input("Start Page", min_value=1, value=1)
                end_p = c2.number_input("End Page", min_value=1, value=1)

                if st.button("Extract Pages", type="primary", icon=":material/cut:", use_container_width=True):
                    with st.spinner("Extracting..."):
                        success, result = split_pdf(
                            split_file.getvalue(), start_p, end_p)
                        if success:
                            st.success("Pages extracted!",
                                       icon=":material/check_circle:")
                            st.download_button("Download Extracted PDF", data=result,
                                               file_name=f"extracted_{split_file.name}", mime="application/pdf", type="primary", use_container_width=True)
                        else:
                            st.error(result, icon=":material/error:")

    elif ops_mode == "Remove Pages":
        with st.container(border=True):
            st.markdown("#### :material/delete: Remove Specific Pages")
            rm_file = st.file_uploader(
                "Upload PDF", type=["pdf"], key="rm_file")
            if rm_file:
                pages_str = st.text_input(
                    "Pages to remove (comma separated, e.g., 1, 3, 5)")
                if st.button("Delete Pages", type="primary", icon=":material/delete_forever:", use_container_width=True):
                    try:
                        pages_list = [int(p.strip()) for p in pages_str.split(
                            ",") if p.strip().isdigit()]
                        if not pages_list:
                            st.warning("Please enter valid numbers.")
                        else:
                            with st.spinner("Removing..."):
                                success, result = remove_specific_pages(
                                    rm_file.getvalue(), pages_list)
                                if success:
                                    st.success("Pages removed!",
                                               icon=":material/check_circle:")
                                    st.download_button(
                                        "Download Trimmed PDF", data=result, file_name=f"trimmed_{rm_file.name}", mime="application/pdf", type="primary", use_container_width=True)
                                else:
                                    st.error(result, icon=":material/error:")
                    except Exception:
                        st.error("Invalid format. Use comma separated numbers.")

    elif ops_mode == "Clean Blank Pages":
        with st.container(border=True):
            st.markdown(
                "#### :material/cleaning_services: Auto-Clean Blank Pages")
            blank_file = st.file_uploader(
                "Upload PDF", type=["pdf"], key="blank_file")
            if blank_file:
                if st.button("Scan and Clean", type="primary", icon=":material/auto_fix_high:", use_container_width=True):
                    with st.spinner("Scanning for empty pages..."):
                        success, result, count = remove_blank_pages(
                            blank_file.getvalue())
                        if success:
                            if count == 0:
                                st.info("No blank pages found.",
                                        icon=":material/info:")
                            else:
                                st.success(
                                    f"Removed {count} blank page(s)!", icon=":material/check_circle:")
                                st.download_button(
                                    "Download Cleaned PDF", data=result, file_name=f"cleaned_{blank_file.name}", mime="application/pdf", type="primary", use_container_width=True)
                        else:
                            st.error(result, icon=":material/error:")

    elif ops_mode == "Resize Pages":
        with st.container(border=True):
            st.markdown("#### :material/aspect_ratio: Standardize Page Size")
            rsz_file = st.file_uploader(
                "Upload PDF", type=["pdf"], key="rsz_file")
            if rsz_file:
                target = st.selectbox("Target Dimensions", ["A4", "Letter"])
                if st.button("Resize Document", type="primary", icon=":material/photo_size_select_large:", use_container_width=True):
                    with st.spinner(f"Scaling to {target}..."):
                        success, result = resize_pdf_pages(
                            rsz_file.getvalue(), target)
                        if success:
                            st.success(
                                f"Resized to {target}!", icon=":material/check_circle:")
                            st.download_button(
                                "Download Resized PDF", data=result, file_name=f"resized_{rsz_file.name}", mime="application/pdf", type="primary", use_container_width=True)
                        else:
                            st.error(result, icon=":material/error:")


def _render_placeholder(tool_name: str):
    """Temporary placeholder for tools under construction."""
    st.info(f"The {tool_name} module is currently under construction.",
            icon=":material/construction:")


# --- Main Application Router ---
st.title(":material/description: Document Studio")
st.markdown("A unified suite for document processing, analysis, and modification.")
tools = {
    "Search Documents": {"icon": ":material/search:", "func": _render_search_ui},
    "Redact PDF": {"icon": ":material/ink_eraser:", "func": _render_redact_ui},
    "Compare Documents": {"icon": ":material/difference:", "func": _render_diff_ui},
    "Compress PDF": {"icon": ":material/compress:", "func": _render_compress_ui},
    "Convert & OCR": {"icon": ":material/transform:", "func": _render_convert_ui},
    "Security & Watermarks": {"icon": ":material/lock:", "func": _render_security_ui},
    "Metadata & Authenticity": {"icon": ":material/info:", "func": _render_metadata_ui},
    "Page Operations": {"icon": ":material/layers:", "func": _render_ops_ui}
}

st.divider()

tab_labels = [f"{data['icon']} {name}" for name, data in tools.items()]
tabs = st.tabs(tab_labels)
for tab, (name, data) in zip(tabs, tools.items()):
    with tab:
        data["func"]()


