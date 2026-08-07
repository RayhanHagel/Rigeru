import uuid
import pandas as pd
import numpy as np
from typing import Dict, Any
import traceback

from sklearn.model_selection import train_test_split, KFold, StratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_absolute_error, r2_score, accuracy_score, f1_score
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.base import clone

import optuna

from utilities.quickmachine.registry import SCALER_MAP, ENCODER_MAP, get_model_class
from utilities.quickmachine.model_hyperparams import get_json
from utilities.quickmachine.dl_compiler import compile_dynamic_model
import os

# In-memory store for background jobs
# { job_id: { "status": "running"|"completed"|"failed", "progress": int, "logs": [], "result": dict } }
JOB_STORE: Dict[str, Dict[str, Any]] = {}

def update_job(job_id: str, status: str = None, progress: int = None, log: str = None, result: dict = None):
    if job_id not in JOB_STORE:
        JOB_STORE[job_id] = {"status": "starting", "progress": 0, "logs": [], "result": None}
    
    if status is not None:
        JOB_STORE[job_id]["status"] = status
    if progress is not None:
        JOB_STORE[job_id]["progress"] = progress
    if log is not None:
        JOB_STORE[job_id]["logs"].append(log)
    if result is not None:
        JOB_STORE[job_id]["result"] = result

def build_preprocessor(int_cols, cat_cols, scaler_name, encoder_name, missing_strategy):
    transformers = []
    if int_cols:
        num_steps = []
        if missing_strategy in ["mean", "median"]:
            num_steps.append(("imputer", SimpleImputer(strategy=missing_strategy)))
        elif missing_strategy == "drop":
            pass # Handled before
        
        if scaler_name and scaler_name in SCALER_MAP:
            num_steps.append(("scaler", clone(SCALER_MAP[scaler_name])))
            
        if num_steps:
            transformers.append(("num", Pipeline(num_steps), int_cols))
        else:
            transformers.append(("num", "passthrough", int_cols))
            
    if cat_cols:
        cat_steps = []
        if missing_strategy in ["mean", "median"]:
            cat_steps.append(("imputer", SimpleImputer(strategy="most_frequent")))
            
        if encoder_name and encoder_name in ENCODER_MAP:
            cat_steps.append(("encoder", clone(ENCODER_MAP[encoder_name])))
        else:
            cat_steps.append(("encoder", clone(ENCODER_MAP["Ordinal Encoder"]))) # Default
            
        transformers.append(("cat", Pipeline(cat_steps), cat_cols))
            
    if not transformers:
        return None
    return ColumnTransformer(transformers, remainder="passthrough")

def optuna_suggest(trial, target, model_name):
    model_options = get_json()
    library = None
    for lib, models in model_options[target].items():
        if model_name in models:
            library = lib
            break
    if library is None:
        return {}

    params_meta = model_options[target][library][model_name].get("params", {})
    resolved = {}
    
    # Simple heuristic to sample from the parameter spaces defined in QuickMachine
    for param_name, search_space in params_meta.items():
        opt_key = f"{model_name}_{param_name}"
        if isinstance(search_space, list):
            if all(isinstance(x, bool) for x in search_space):
                resolved[param_name] = trial.suggest_categorical(opt_key, search_space)
            elif all(isinstance(x, int) for x in search_space) and len(search_space) == 2:
                resolved[param_name] = trial.suggest_int(opt_key, search_space[0], search_space[1])
            elif all(isinstance(x, (int, float)) for x in search_space) and len(search_space) == 2:
                resolved[param_name] = trial.suggest_float(opt_key, float(search_space[0]), float(search_space[1]))
            else:
                resolved[param_name] = trial.suggest_categorical(opt_key, search_space)
    
    return resolved

def run_ml_pipeline(job_id: str, nodes: list, edges: list):
    try:
        update_job(job_id, status="running", progress=5, log="Starting ML Pipeline Execution...")
        
        # 1. Parse Graph
        data_node = next((n for n in nodes if n["type"] == "dataNode"), None)
        split_node = next((n for n in nodes if n["type"] == "splitNode"), None)
        prep_node = next((n for n in nodes if n["type"] == "preprocessNode"), None)
        model_node = next((n for n in nodes if n["type"] == "modelNode"), None)
        custom_node = next((n for n in nodes if n["type"] == "customModelNode"), None)
        tune_node = next((n for n in nodes if n["type"] == "hypertuneNode"), None)
        eval_node = next((n for n in nodes if n["type"] == "evaluateNode"), None)

        if not data_node:
            raise ValueError("No Data Node found in the graph.")
        if not split_node:
            raise ValueError("No Train/Test Split Node found.")
        
        target_col = data_node["data"].get("targetCol")
        if not target_col:
            raise ValueError("No target column specified in Data Node.")

        update_job(job_id, progress=10, log="Graph parsed successfully. Generating synthetic data for preview...")

        # 2. Load Data (For MVP, generate synthetic data since we don't have the actual file upload logic fully wired to backend storage yet)
        # In a real scenario, we would read the file from `data_node["data"]["fileHash"]`
        update_job(job_id, progress=15, log="Loading dataset...")
        is_regression = True # Detect from target later
        
        np.random.seed(42)
        X = pd.DataFrame(np.random.rand(1000, 5), columns=[f"feature_{i}" for i in range(5)])
        
        # Determine if it's classification or regression based on the chosen model (heuristic for MVP)
        active_model = model_node["data"].get("model", "Random Forest") if model_node else "Random Forest"
        is_regression = "Regressor" in active_model or active_model in ["Linear Regression", "Ridge", "Lasso", "SVR"]
        
        if is_regression:
            y = pd.Series(X.sum(axis=1) + np.random.randn(1000) * 0.1, name=target_col)
        else:
            y = pd.Series((X.sum(axis=1) > 2.5).astype(int), name=target_col)
            
        update_job(job_id, progress=20, log=f"Data loaded. Target column: {target_col}")

        # 3. Split Data
        test_size = (split_node["data"].get("testSize") or 20) / 100.0
        random_state = split_node["data"].get("randomState") or 42
        stratify = split_node["data"].get("stratify")
        
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state,
            stratify=y if stratify and not is_regression else None
        )
        update_job(job_id, progress=30, log=f"Data split into {len(X_train)} train and {len(X_test)} test samples.")

        # 4. Preprocessing
        int_cols = list(X.select_dtypes(include=["number"]).columns)
        cat_cols = list(X.select_dtypes(exclude=["number"]).columns)
        
        scaler_name = prep_node["data"].get("scaler", "StandardScaler") if prep_node else None
        encoder_name = prep_node["data"].get("encoder", "OneHotEncoder") if prep_node else None
        missing_strategy = data_node["data"].get("missingVal", "drop")
        
        # Map frontend names to backend registry names
        scaler_mapping = {"StandardScaler": "Standard Scaler", "MinMaxScaler": "Min-Max Scaler", "RobustScaler": "Robust Scaler"}
        enc_mapping = {"OneHotEncoder": "One-Hot Encoder", "LabelEncoder": "Ordinal Encoder", "OrdinalEncoder": "Ordinal Encoder"}
        
        preprocessor = build_preprocessor(
            int_cols, cat_cols, 
            scaler_mapping.get(scaler_name), 
            enc_mapping.get(encoder_name),
            missing_strategy
        )
        update_job(job_id, progress=40, log="Preprocessor configured.")

        # 5. Model Execution / Tuning
        best_model = None
        target_type = "Regression" if is_regression else "Classification"

        if tune_node and model_node:
            update_job(job_id, progress=50, log="Starting Hyperparameter Tuning with Optuna...")
            n_trials = tune_node["data"].get("trials", 20)
            tuning_obj = tune_node["data"].get("objective", "val_loss")
            
            def objective(trial):
                hp = optuna_suggest(trial, target_type, active_model)
                cls = get_model_class(active_model, is_regression)
                if not cls: raise ValueError(f"Model {active_model} not found in registry.")
                
                # Try setting random state
                try: 
                    dummy = cls()
                    if "random_state" in dummy.get_params(): hp["random_state"] = random_state
                except: pass

                if custom_node and custom_node["data"].get("mode") == "visual":
                    # Build Dynamic Deep Learning DAG
                    fw = custom_node["data"].get("framework", "PyTorch")
                    mdl = compile_dynamic_model(fw, custom_node["data"].get("layers", []), custom_node["data"].get("layerEdges", []), trial)
                else:
                    mdl = cls(**hp)
                
                cv = KFold(n_splits=3, shuffle=True) if is_regression else StratifiedKFold(n_splits=3, shuffle=True)
                scores = []
                for train_idx, val_idx in cv.split(X_train, y_train):
                    pipe = Pipeline([("prep", clone(preprocessor)), ("model", clone(mdl))]) if preprocessor else clone(mdl)
                    pipe.fit(X_train.iloc[train_idx], y_train.iloc[train_idx])
                    preds = pipe.predict(X_train.iloc[val_idx])
                    
                    if is_regression:
                        scores.append(mean_absolute_error(y_train.iloc[val_idx], preds)) # minimize
                    else:
                        scores.append(accuracy_score(y_train.iloc[val_idx], preds)) # maximize
                return np.mean(scores)

            direction = "minimize" if is_regression else "maximize"
            study = optuna.create_study(direction=direction)
            
            for i in range(n_trials):
                study.optimize(objective, n_trials=1)
                update_job(job_id, progress=50 + int(30 * (i/n_trials)), log=f"Trial {i+1}/{n_trials} finished. Best: {study.best_value:.4f}")
            
            update_job(job_id, progress=85, log="Tuning complete. Building final model...")
            cls = get_model_class(active_model, is_regression)
            best_hp = study.best_params
            try: 
                dummy = cls()
                if "random_state" in dummy.get_params(): best_hp["random_state"] = random_state
            except: pass
            
            best_model = Pipeline([("prep", preprocessor), ("model", cls(**best_hp))]) if preprocessor else cls(**best_hp)
            
        elif model_node or custom_node:
            update_job(job_id, progress=70, log="Training standard model...")
            if custom_node and custom_node["data"].get("mode") == "visual":
                fw = custom_node["data"].get("framework", "PyTorch")
                mdl = compile_dynamic_model(fw, custom_node["data"].get("layers", []), custom_node["data"].get("layerEdges", []), None)
                best_model = Pipeline([("prep", preprocessor), ("model", mdl)]) if preprocessor else mdl
            else:
                cls = get_model_class(active_model, is_regression)
                if not cls: raise ValueError(f"Model {active_model} not found in registry.")
                best_model = Pipeline([("prep", preprocessor), ("model", cls(random_state=random_state))]) if preprocessor else cls(random_state=random_state)
        
        else:
            raise ValueError("No model configured to train.")

        # Train Final Model
        best_model.fit(X_train, y_train)
        update_job(job_id, progress=90, log="Final model trained.")

        # 6. Evaluation
        result_metrics = {}
        if eval_node:
            update_job(job_id, progress=95, log="Evaluating on test data...")
            preds = best_model.predict(X_test)
            if is_regression:
                result_metrics["MAE"] = float(mean_absolute_error(y_test, preds))
                result_metrics["R2"] = float(r2_score(y_test, preds))
            else:
                result_metrics["Accuracy"] = float(accuracy_score(y_test, preds))
                result_metrics["F1_Score"] = float(f1_score(y_test, preds, average="weighted", zero_division=0))
        
        update_job(job_id, status="completed", progress=100, log="Pipeline finished successfully!", result=result_metrics)

    except Exception as e:
        err_msg = f"Error: {str(e)}\n{traceback.format_exc()}"
        update_job(job_id, status="failed", log=err_msg)
