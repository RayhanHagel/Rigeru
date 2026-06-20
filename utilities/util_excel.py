def load_data(file_bytes: bytes, filename: str, has_header: bool = True) -> tuple:
    import pandas as pd
    import numpy as np
    import io
    
    try:
        header_opt = 'infer' if has_header else None
        
        if filename.endswith('.csv'):
            try:
                # Attempt pyarrow C++ Multithreaded parser engine first
                df = pd.read_csv(io.BytesIO(file_bytes), header=header_opt, engine='pyarrow')
            except Exception:
                try:
                    df = pd.read_csv(io.BytesIO(file_bytes), header=header_opt)
                except pd.errors.ParserError:
                    df = pd.read_csv(io.BytesIO(file_bytes), header=header_opt, engine='python', on_bad_lines='skip')
                    
        elif filename.endswith(('.xls', '.xlsx')):
            df = pd.read_excel(io.BytesIO(file_bytes), header=header_opt)
        else:
            return False, "Unsupported file format. Please upload CSV or Excel."
            
        # --- VECTORIZED COLUMN SANITATION ---
        if not has_header:
            df.columns = [f"Col_{i+1}" for i in range(len(df.columns))]
        else:
            # Enforce C string vector math vs python loop
            col_strs = df.columns.astype(str).str.strip().str.lower()
            condition = (col_strs == "") | col_strs.str.startswith("unnamed")
            default_cols = [f"Col_{i+1}" for i in range(len(df.columns))]
            df.columns = np.where(condition, default_cols, df.columns.astype(str))
            
        return True, df
    except Exception as e:
        return False, f"Error loading file: {str(e)}"

def process_dataframe(
    df, 
    drop_na: bool = False, 
    drop_duplicates: bool = False, 
    filter_query: str = ""
) -> tuple:
    try:
        new_df = df.copy()
        
        # O(N) ram safety through inplace memory overrides 
        if drop_na:
            new_df.dropna(how='all', inplace=True)
        if drop_duplicates:
            new_df.drop_duplicates(inplace=True)
        if filter_query.strip():
            new_df.query(filter_query, inplace=True)
            
        new_df.reset_index(drop=True, inplace=True)
        return True, new_df
        
    except Exception as e:
        return False, f"Error applying filters: {str(e)}\nMake sure your query uses valid column names."

def export_data(df, format_type: str = "CSV") -> bytes:
    import pandas as pd
    import io
    
    output = io.BytesIO()
    if format_type == "CSV":
        df.to_csv(output, index=False)
    else:
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Cleaned_Data')
    return output.getvalue()