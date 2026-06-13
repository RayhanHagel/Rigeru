def load_data(file_bytes: bytes, filename: str, has_header: bool = True) -> tuple:
    """Loads an uploaded Excel or CSV file into a pandas DataFrame, handling irregular structures."""
    import pandas as pd
    import io
    
    try:
        header_opt = 'infer' if has_header else None
        
        if filename.endswith('.csv'):
            try:
                # Attempt standard, fast C-engine parse
                df = pd.read_csv(io.BytesIO(file_bytes), header=header_opt)
            except pd.errors.ParserError:
                # Fallback for irregular structures (Tokenizing errors)
                df = pd.read_csv(io.BytesIO(file_bytes), header=header_opt, engine='python', on_bad_lines='skip')
                
        elif filename.endswith(('.xls', '.xlsx')):
            df = pd.read_excel(io.BytesIO(file_bytes), header=header_opt)
        else:
            return False, "Unsupported file format. Please upload CSV or Excel."
            
        # --- BRUTE FORCE COLUMN SANITATION ---
        if not has_header:
            df.columns = [f"Col_{i+1}" for i in range(len(df.columns))]
        else:
            new_columns = []
            for i, col in enumerate(df.columns):
                # Convert to string, strip whitespace, and make lowercase for bulletproof matching
                col_str = str(col).strip().lower()
                
                # If it's empty or starts with 'unnamed', force it to Col_X
                if not col_str or col_str.startswith("unnamed"):
                    new_columns.append(f"Col_{i+1}")
                else:
                    # Keep the original casing for valid columns
                    new_columns.append(str(col))
                    
            # Bruteforce overwrite the entire column header array
            df.columns = new_columns
            
        return True, df
    except Exception as e:
        return False, f"Error loading file: {str(e)}"


def process_dataframe(
    df, 
    drop_na: bool = False, 
    drop_duplicates: bool = False, 
    filter_query: str = ""
) -> tuple:
    """Applies cleaning operations and a python expression query to the dataframe."""
    import pandas as pd
    
    try:
        new_df = df.copy()
        
        if drop_na:
            new_df = new_df.dropna(how='all')
        
        if drop_duplicates:
            new_df = new_df.drop_duplicates()
            
        if filter_query.strip():
            new_df = new_df.query(filter_query)
            
        new_df = new_df.reset_index(drop=True)
        return True, new_df
        
    except Exception as e:
        return False, f"Error applying filters: {str(e)}\nMake sure your query uses valid column names."

def export_data(df, format_type: str = "CSV") -> bytes:
    """Converts the DataFrame back to downloadable bytes."""
    import pandas as pd
    import io
    
    output = io.BytesIO()
    if format_type == "CSV":
        df.to_csv(output, index=False)
    else:
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Cleaned_Data')
    return output.getvalue()