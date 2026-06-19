import streamlit as st
from utilities.util_excel import load_data, process_dataframe, export_data


st.header("🧹 Excel & CSV Cleaner")
st.markdown("Upload a dataset, clean up rows, apply logic filters, and export the result.")

if "cleaned_df" not in st.session_state:
    st.session_state.cleaned_df = None
    st.session_state.uploaded_filename = ""

col_header, col_upload = st.columns([1, 3], vertical_alignment="center")
has_header = col_header.checkbox("File has Headers", value=True, help="Uncheck if your data doesn't have a header row. We will assign Col_1, Col_2 placeholders.")
uploaded_file = col_upload.file_uploader("Upload Data File", type=["csv", "xlsx", "xls"], label_visibility="collapsed")

if uploaded_file:
    if st.session_state.uploaded_filename != uploaded_file.name:
        st.session_state.cleaned_df = None
        st.session_state.uploaded_filename = uploaded_file.name

    # Pass the header flag to the loader
    success, result = load_data(uploaded_file.getvalue(), uploaded_file.name, has_header)
    
    if not success:
        st.error(result)
    else:
        df = result
        st.markdown(f"**Original Data Preview** ({df.shape[0]} rows, {df.shape[1]} columns)")
        st.dataframe(df.head(50), width='stretch')
        
        st.divider()
        st.subheader("🗑️ Cleaning Options")
        
        col1, col2 = st.columns(2)
        drop_na = col1.checkbox("Drop Empty Rows", help="Removes rows where all values are missing.")
        drop_dupes = col2.checkbox("Drop Duplicates", help="Removes identical repeating rows.")
        
        st.markdown("### 🧮 Python Expression Filter")
        st.markdown(
            "Filter rows using a pandas query string. Examples: \n"
            "* `Age > 30`\n"
            "* `Status == 'Active' and Score >= 85`\n"
            "* `Department in ['IT', 'HR']`"
        )
        
        if not has_header:
            st.info("💡 **Tip:** Since your file has no headers, use the placeholder column names assigned above (e.g., `Col_1 > 50` or `Col_2 == 'Active'`).")
            
        query_str = st.text_input("Filter Expression (Leave blank to skip)", placeholder="e.g., Col_3 < 50")
        
        if st.button("Apply Cleaning & Filters", type="primary", width='stretch'):
            with st.spinner("Processing data..."):
                proc_success, proc_result = process_dataframe(df, drop_na, drop_dupes, query_str)
                
                if not proc_success:
                    st.error(proc_result)
                else:
                    st.session_state.cleaned_df = proc_result
                    st.success("Successfully processed!")
                    
        if st.session_state.cleaned_df is not None:
            cleaned_df = st.session_state.cleaned_df
            
            st.markdown(f"**Processed Data Preview** ({cleaned_df.shape[0]} rows, {cleaned_df.shape[1]} columns)")
            st.dataframe(cleaned_df.head(50), width='stretch')
            
            st.divider()
            st.subheader("💾 Download Cleaned Data")
            
            col_dl1, col_dl2 = st.columns(2)
            
            csv_bytes = export_data(cleaned_df, "CSV")
            col_dl1.download_button(
                label="Download as CSV",
                data=csv_bytes,
                file_name=f"cleaned_{uploaded_file.name.split('.')[0]}.csv",
                mime="text/csv",
                width='stretch'
            )
            
            try:
                excel_bytes = export_data(cleaned_df, "Excel")
                col_dl2.download_button(
                    label="Download as Excel",
                    data=excel_bytes,
                    file_name=f"cleaned_{uploaded_file.name.split('.')[0]}.xlsx",
                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    width='stretch'
                )
            except ModuleNotFoundError:
                col_dl2.error("Install `openpyxl` to enable Excel exports.")

