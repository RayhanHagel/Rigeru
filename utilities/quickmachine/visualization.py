import io
import base64
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns

def generate_plot(df: pd.DataFrame, plot_type: str) -> str:
    plt.figure(figsize=(10, 6))
    
    # Simple heuristic to pick columns if not specified
    num_cols = df.select_dtypes(include=np.number).columns.tolist()
    cat_cols = df.select_dtypes(exclude=np.number).columns.tolist()
    
    if plot_type == 'Box Plot':
        if num_cols:
            sns.boxplot(data=df[num_cols[:10]])
    elif plot_type == 'Violin Plot':
        if num_cols:
            sns.violinplot(data=df[num_cols[:10]])
    elif plot_type == 'Distribution Plot':
        if num_cols:
            sns.histplot(data=df, x=num_cols[0], kde=True)
    elif plot_type == 'Scatter Plot':
        if len(num_cols) >= 2:
            sns.scatterplot(data=df, x=num_cols[0], y=num_cols[1])
    elif plot_type == 'Bar Plot':
        if cat_cols and num_cols:
            sns.barplot(data=df, x=cat_cols[0], y=num_cols[0])
    elif plot_type == 'Heatmap':
        if len(num_cols) > 1:
            sns.heatmap(df[num_cols].corr(), annot=True, cmap='coolwarm')
    elif plot_type == 'Silhouette Plot':
        # Need clustering labels, skip for now
        plt.text(0.5, 0.5, 'Silhouette Plot requires clustering', ha='center', va='center')
    else:
        plt.text(0.5, 0.5, f'{plot_type} not implemented', ha='center', va='center')

    plt.title(f'{plot_type}')
    plt.tight_layout()
    
    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight')
    plt.close()
    buf.seek(0)
    img_b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
    return f"data:image/png;base64,{img_b64}"

def run_visualization(nodes: list, edges: list, target_node_id: str) -> str:
    # 1. Find the Visualize node
    vis_node = next((n for n in nodes if n["id"] == target_node_id), None)
    if not vis_node:
        raise ValueError("Visualize node not found")
        
    plot_type = vis_node.get("data", {}).get("plotType", "Distribution Plot")
    
    # 2. Trace back to DataNode
    # Simplified for now: just find the first DataNode
    data_node = next((n for n in nodes if n["type"] == "dataNode"), None)
    if not data_node:
        raise ValueError("No data source found")
        
    filepath = data_node.get("data", {}).get("filepath")
    if not filepath:
        raise ValueError("Data source has no filepath configured")
        
    import os
    abs_path = os.path.realpath(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), filepath))
    
    if not os.path.exists(abs_path):
        raise ValueError(f"File not found: {filepath}")
        
    if filepath.endswith('.csv'):
        df = pd.read_csv(abs_path)
    elif filepath.endswith(('.xls', '.xlsx')):
        df = pd.read_excel(abs_path)
    else:
        raise ValueError("Unsupported file type")
        
    # TODO: Apply filters/splits if they exist in the path between DataNode and VisualizeNode
        
    return generate_plot(df, plot_type)
