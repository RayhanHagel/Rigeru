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
            
        # --- AUTO-DETECT DATETIME COLUMNS ---
        for col in df.columns:
            if df[col].dtype == 'object' or df[col].dtype == 'string':
                sample = df[col].dropna().head(10)
                if not sample.empty:
                    try:
                        if sample.astype(str).str.contains(r'[-/:]').any():
                            import warnings
                            with warnings.catch_warnings():
                                warnings.simplefilter("ignore", UserWarning)
                                # If sample parses successfully, parse the whole column
                                pd.to_datetime(sample, errors='raise')
                                parsed_col = pd.to_datetime(df[col], errors='coerce')
                            
                            if sample.astype(str).str.contains(r':').any() and not sample.astype(str).str.contains(r'[-/]').any():
                                # Purely time
                                df[col] = parsed_col.dt.time
                            else:
                                df[col] = parsed_col
                    except Exception:
                        pass
                        
        return True, df
    except Exception as e:
        return False, f"Error loading file: {str(e)}"

def process_dataframe(
    df, 
    drop_na: bool = False, 
    drop_duplicates: bool = False, 
    rules: list = None
) -> tuple:
    if rules is None:
        rules = []
    
    try:
        new_df = df.copy()
        
        # O(N) ram safety through inplace memory overrides 
        if drop_na:
            new_df.dropna(how='all', inplace=True)
        if drop_duplicates:
            new_df.drop_duplicates(inplace=True)
            
        if rules:
            queries = []
            for r in rules:
                col = r.get("column")
                op = r.get("operator")
                val = r.get("value")
                
                if not col or not op or val is None or str(val).strip() == "":
                    continue
                    
                # Format column name with backticks to handle spaces
                col_str = f"`{col}`"
                
                # Check if value is numeric, if not, treat as string
                try:
                    float(val)
                    is_numeric = True
                except ValueError:
                    is_numeric = False
                    
                val_str = str(val) if is_numeric else f"'{val}'"
                
                if op == "contains":
                    # str.contains requires string column
                    queries.append(f"{col_str}.astype('str').str.contains({val_str}, case=False, na=False)")
                elif op in ["==", "!=", ">", "<", ">=", "<="]:
                    # If it's a datetime.time object, pandas query needs string comparison
                    import datetime
                    sample = new_df[col].dropna().head(1)
                    if not sample.empty and isinstance(sample.iloc[0], datetime.time):
                        # Ensure value has seconds if it doesn't
                        if len(str(val)) == 5: # HH:MM
                            val_str = f"'{val}:00'"
                        queries.append(f"{col_str}.astype('str') {op} {val_str}")
                    else:
                        queries.append(f"{col_str} {op} {val_str}")
                    
            if queries:
                final_query = " and ".join(queries)
                new_df.query(final_query, inplace=True)
            
        new_df.reset_index(drop=True, inplace=True)
        return True, new_df
        
    except Exception as e:
        return False, f"Error applying filters: {str(e)}\nCheck your rules."

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