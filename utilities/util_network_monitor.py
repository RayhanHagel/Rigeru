import psutil
import json

def get_active_connections() -> list[dict]:
    """Scans for active, established external connections and maps them to apps."""
    connections = []
    
    # Needs to handle AccessDenied gracefully since some SYSTEM processes hide their PIDs
    for conn in psutil.net_connections(kind='inet'):
        if conn.status == 'ESTABLISHED' and conn.pid:
            try:
                proc = psutil.Process(conn.pid)
                app_name = proc.name()
                
                # Ignore generic local loopback to focus on real internet traffic
                if conn.raddr and conn.raddr.ip not in ('127.0.0.1', '::1'):
                    connections.append({
                        "app": app_name,
                        "pid": conn.pid,
                        "local_port": conn.laddr.port,
                        "remote_ip": conn.raddr.ip,
                        "remote_port": conn.raddr.port
                    })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
                
    # Sort and return a clean list
    return sorted(connections, key=lambda x: x['app'].lower())

def generate_cyberpunk_graph_html(connections: list[dict]) -> str:
    """Generates a self-contained HTML/JS physics graph with flowing data animations."""
    nodes = [{"id": "PC", "label": "💻 My Local PC", "shape": "hexagon", "color": "#FF0055", "size": 30}]
    edges = []
    
    apps_added = set()
    targets_added = set()
    
    # Limit to top 25 to prevent the physics engine from lagging
    for conn in connections[:25]:
        app_id = f"APP_{conn['app']}"
        target_id = f"TGT_{conn['remote_ip']}:{conn['remote_port']}"
        
        if app_id not in apps_added:
            nodes.append({"id": app_id, "label": f"⚙️ {conn['app']}", "shape": "dot", "color": "#00FFCC", "size": 20})
            edges.append({"from": "PC", "to": app_id, "dashes": True, "color": {"color": "#00FFCC"}})
            apps_added.add(app_id)
            
        if target_id not in targets_added:
            nodes.append({"id": target_id, "label": f"🌐 {conn['remote_ip']}:{conn['remote_port']}", "shape": "square", "color": "#B829FF", "size": 15})
            edges.append({"from": app_id, "to": target_id, "dashes": True, "color": {"color": "#B829FF"}})
            targets_added.add(target_id)

    nodes_json = json.dumps(nodes)
    edges_json = json.dumps(edges)

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <script type="text/javascript" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
        <style type="text/css">
            body {{ margin: 0; background-color: #0E1117; color: #00FFCC; font-family: monospace; overflow: hidden; }}
            #mynetwork {{ width: 100vw; height: 100vh; border: none; background: radial-gradient(circle, #1a1c23 0%, #0E1117 100%); }}
        </style>
    </head>
    <body>
        <div id="mynetwork"></div>
        <script type="text/javascript">
            var nodes = new vis.DataSet({nodes_json});
            var edges = new vis.DataSet({edges_json});
            var container = document.getElementById('mynetwork');
            
            var data = {{ nodes: nodes, edges: edges }};
            var options = {{
                nodes: {{ font: {{ color: '#FFFFFF', face: 'monospace', strokeWidth: 2, strokeColor: '#000000' }} }},
                edges: {{ width: 2, smooth: {{ type: 'continuous' }} }},
                physics: {{ barnesHut: {{ gravitationalConstant: -3000, centralGravity: 0.3, springLength: 120 }} }},
                interaction: {{ hover: true, tooltipDelay: 200, zoomView: true }}
            }};
            
            var network = new vis.Network(container, data, options);
            
            var offset = 0;
            function animateEdges() {{
                offset -= 1; 
                if (offset < -20) offset = 0;
                
                var newEdges = [];
                edges.forEach(function(edge) {{
                    newEdges.push({{ id: edge.id, dashes: [10, 10], dashOffset: offset }});
                }});
                edges.update(newEdges);
                requestAnimationFrame(animateEdges);
            }}
            animateEdges(); 
        </script>
    </body>
    </html>
    """
    return html_content