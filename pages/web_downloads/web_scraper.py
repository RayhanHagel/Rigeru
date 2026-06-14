import os
import streamlit as st
from utilities.util_scraper import run_headless_scraper, export_scraper_data, get_page_preview_image, TEMP_DIR
from utilities.util_persistent import apply_footer

st.header("🕸️ Visual Web Scraper")
st.markdown("Use a local headless browser to extract specific elements from a list of websites.")

with st.container(border=True):
    col_links, col_config = st.columns([2, 1])
    
    with col_links:
        links_input = st.text_area(
            "List of Target URLs", 
            placeholder="https://example.com\nhttps://anotherexample.com",
            height=150,
            help="Enter one URL per line."
        )
        
        show_preview = st.checkbox("👁️ Show Preview")
        
    with col_config:
        css_selector = st.text_input(
            "CSS Selector to Extract",
            placeholder="e.g., h1, .price, #main-content",
            help="Use standard CSS selectors to target the data you want to scrape."
        )
        
        st.markdown(
            """
            **Common Selectors:**
            * `h1`, `h2`, `p` (Tags)
            * `.product-title` (Class)
            * `#main-price` (ID)
            """
        )
        
    # --- Preview Logic ---
    if show_preview and links_input.strip():
        first_url = [line for line in links_input.split('\n') if line.strip()][0]
        if not first_url.startswith('http'):
            first_url = 'https://' + first_url
            
        st.markdown(f"**Previewing:** `{first_url}`")
        
        @st.fragment
        def load_preview():
            preview_path = os.path.join(TEMP_DIR, "preview_screenshot.png")
            with st.spinner("Generating live Playwright screenshot..."):
                success, result = get_page_preview_image(first_url, preview_path)
                if success:
                    st.image(result, width='stretch', caption="Target DOM Render")
                else:
                    st.error(result)
        
        load_preview()

    if st.button("🚀 Start Scraping", type="primary", width='stretch'):
        if not links_input.strip() or not css_selector.strip():
            st.warning("Please provide both a list of URLs and a CSS selector.")
        else:
            url_list = [line for line in links_input.split('\n') if line.strip()]
            
            with st.spinner(f"Scraping {len(url_list)} links using local Chromium browser..."):
                success, result_df = run_headless_scraper(url_list, css_selector)
                
                if success:
                    st.success("Scraping completed!")
                    st.dataframe(result_df, width='stretch', hide_index=True)
                    
                    st.download_button(
                        label="💾 Download Results as CSV",
                        data=export_scraper_data(result_df),
                        file_name="scraped_data.csv",
                        mime="text/csv",
                        type="primary",
                        width='stretch'
                    )
                else:
                    st.error(result_df)

apply_footer()