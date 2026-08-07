import traceback

def topological_sort(nodes, edges):
    in_degree = {n["id"]: 0 for n in nodes}
    for e in edges:
        if e["target"] in in_degree:
            in_degree[e["target"]] += 1
            
    queue = [n["id"] for n in nodes if in_degree[n["id"]] == 0]
    sorted_nodes = []
    
    while queue:
        curr = queue.pop(0)
        sorted_nodes.append(curr)
        
        for e in edges:
            if e["source"] == curr and e["target"] in in_degree:
                in_degree[e["target"]] -= 1
                if in_degree[e["target"]] == 0:
                    queue.append(e["target"])
                    
    return sorted_nodes

def sample_tuned_params(layers, trial, sampled_keys):
    """
    Scans all layers for `mode == 'tune'`, queries Optuna for values,
    and returns a resolved layers dictionary.
    """
    resolved_layers = {}
    for node in layers:
        layer_id = node["id"]
        resolved_layers[layer_id] = {"type": node["data"].get("layerType", ""), "params": {}}
        params = node["data"].get("params", {})
        
        for p_name, p_config in params.items():
            if p_config.get("mode") == "tune" and trial is not None:
                tune_key = p_config.get("tuneKey", f"{layer_id}_{p_name}")
                if tune_key not in sampled_keys:
                    # sample it
                    p_type = p_config.get("type", "int")
                    if p_type == "int":
                        sampled_keys[tune_key] = trial.suggest_int(tune_key, int(p_config.get("min", 0) or 0), int(p_config.get("max", 100) or 100))
                    elif p_type == "float":
                        sampled_keys[tune_key] = trial.suggest_float(tune_key, float(p_config.get("min", 0.0) or 0.0), float(p_config.get("max", 1.0) or 1.0))
                    elif p_type == "categorical":
                        sampled_keys[tune_key] = trial.suggest_categorical(tune_key, p_config.get("choices", []))
                
                resolved_layers[layer_id]["params"][p_name] = sampled_keys.get(tune_key, 0)
            else:
                # static
                val = p_config.get("value")
                resolved_layers[layer_id]["params"][p_name] = val
                
    return resolved_layers

def compile_pytorch_model(resolved_layers, edges):
    try:
        import torch
        import torch.nn as nn
    except ImportError:
        class MockPyTorchModel:
            def __init__(self, layers, edges):
                self.framework = "PyTorch"
                self.layers = layers
                self.edges = edges
            def fit(self, *args, **kwargs):
                pass
            def predict(self, X, *args, **kwargs):
                import numpy as np
                return np.random.randn(len(X))
        return MockPyTorchModel(resolved_layers, edges)
        
    class DynamicDAG(nn.Module):
        def __init__(self, layers, edges):
            super().__init__()
            self.layers = nn.ModuleDict()
            self.edges = edges
            self.sorted_ids = topological_sort([{"id": k} for k in layers.keys()], edges)
            
            for l_id, l_info in layers.items():
                l_type = l_info["type"]
                p = l_info["params"]
                
                if l_type == "Input":
                    continue
                elif l_type == "Linear / Dense":
                    in_feat = p.get("in_features")
                    out_feat = int(p.get("out_features") or 1)
                    if in_feat:
                        self.layers[l_id] = nn.Linear(int(in_feat), out_feat)
                    else:
                        self.layers[l_id] = nn.LazyLinear(out_feat)
                elif l_type == "Conv2D":
                    in_ch = p.get("in_channels")
                    out_ch = int(p.get("out_channels") or 1)
                    ks = int(p.get("kernel_size") or 3)
                    st = int(p.get("stride") or 1)
                    pad = int(p.get("padding") or 0)
                    if in_ch:
                        self.layers[l_id] = nn.Conv2d(int(in_ch), out_ch, ks, st, pad)
                    else:
                        self.layers[l_id] = nn.LazyConv2d(out_ch, ks, st, pad)
                elif l_type == "Flatten":
                    self.layers[l_id] = nn.Flatten()
                elif l_type == "Dropout":
                    self.layers[l_id] = nn.Dropout(float(p.get("p") or 0.5))
                else:
                    self.layers[l_id] = nn.Identity()

        def forward(self, x):
            outs = {}
            for l_id in self.sorted_ids:
                if resolved_layers[l_id]["type"] == "Input":
                    outs[l_id] = x
                    continue
                
                in_edges = [e for e in self.edges if e["target"] == l_id]
                in_tensors = [outs[e["source"]] for e in in_edges if e["source"] in outs]
                
                if len(in_tensors) == 1:
                    outs[l_id] = self.layers[l_id](in_tensors[0])
                elif len(in_tensors) > 1:
                    outs[l_id] = self.layers[l_id](torch.cat(in_tensors, dim=-1))
            
            return outs[self.sorted_ids[-1]] if outs else x

    return DynamicDAG(resolved_layers, edges)

def compile_tf_model(resolved_layers, edges, input_shape=(10,)):
    try:
        import tensorflow as tf
    except ImportError:
        class MockTFModel:
            def __init__(self, layers, edges):
                self.framework = "TensorFlow"
                self.layers = layers
                self.edges = edges
            def fit(self, *args, **kwargs):
                pass
            def predict(self, X, *args, **kwargs):
                import numpy as np
                return np.random.randn(len(X))
        return MockTFModel(resolved_layers, edges)
        
    inputs = tf.keras.Input(shape=input_shape)
    outs = {}
    
    sorted_ids = topological_sort([{"id": k} for k in resolved_layers.keys()], edges)
    for l_id in sorted_ids:
        l_info = resolved_layers[l_id]
        l_type = l_info["type"]
        p = l_info["params"]
        
        if l_type == "Input":
            outs[l_id] = inputs
            continue
            
        in_edges = [e for e in edges if e["target"] == l_id]
        in_tensors = [outs[e["source"]] for e in in_edges if e["source"] in outs]
        
        if len(in_tensors) == 1:
            x = in_tensors[0]
        elif len(in_tensors) > 1:
            x = tf.keras.layers.Concatenate()(in_tensors)
        else:
            x = inputs # fallback
            
        if l_type == "Linear / Dense":
            out_feat = int(p.get("out_features") or 1)
            act = str(p.get("activation") or "None").lower()
            if act == "none": act = None
            outs[l_id] = tf.keras.layers.Dense(out_feat, activation=act)(x)
        elif l_type == "Conv2D":
            out_ch = int(p.get("out_channels") or 1)
            ks = int(p.get("kernel_size") or 3)
            st = int(p.get("stride") or 1)
            pad = "same" if p.get("padding") else "valid"
            outs[l_id] = tf.keras.layers.Conv2D(out_ch, ks, strides=st, padding=pad)(x)
        elif l_type == "Flatten":
            outs[l_id] = tf.keras.layers.Flatten()(x)
        elif l_type == "Dropout":
            outs[l_id] = tf.keras.layers.Dropout(float(p.get("p") or 0.5))(x)
        else:
            outs[l_id] = x
            
    final_node = sorted_ids[-1] if sorted_ids else None
    if not final_node or final_node not in outs:
        return tf.keras.Model(inputs=inputs, outputs=inputs)
        
    model = tf.keras.Model(inputs=inputs, outputs=outs[final_node])
    return model

def compile_dynamic_model(framework, layers, edges, trial=None, sampled_keys=None):
    if sampled_keys is None: sampled_keys = {}
    resolved = sample_tuned_params(layers, trial, sampled_keys)
    if framework == "PyTorch":
        return compile_pytorch_model(resolved, edges)
    else:
        return compile_tf_model(resolved, edges)
