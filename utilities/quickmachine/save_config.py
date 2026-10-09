import pickle
import pandas as pd
from pathlib import Path
from typing import Optional, Dict, Any

def save_config(
    config_dict: Dict[str, Any],
    save_name: str,
    save_dir: str = "./cache/quickmachine_configs",
    feature_int: Optional[pd.DataFrame] = None,
    feature_cat: Optional[pd.DataFrame] = None,
    target: Optional[pd.DataFrame] = None
) -> Path:
    """Saves a QuickMachine pipeline configuration dictionary to a pickle file.

    Args:
        config_dict (Dict[str, Any]): Base configuration dictionary.
        save_name (str): Filename without extension.
        save_dir (str): Destination directory path. Defaults to "./cache/quickmachine_configs".
        feature_int (Optional[pd.DataFrame]): Optional numerical feature dataframe.
        feature_cat (Optional[pd.DataFrame]): Optional categorical feature dataframe.
        target (Optional[pd.DataFrame]): Optional target dataframe.

    Returns:
        Path: Filesystem path to the written pickle file.
    """
    config = dict(config_dict)

    if feature_int is not None and not feature_int.empty:
        config["dataset_feature_int"] = feature_int.reset_index(drop=True).copy()
    if feature_cat is not None and not feature_cat.empty:
        config["dataset_feature_cat"] = feature_cat.reset_index(drop=True).copy()
    if target is not None and not target.empty:
        config["dataset_target"] = target.reset_index(drop=True).copy()

    output_dir = Path(save_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{save_name}.pkl"

    with open(output_path, "wb") as f:
        pickle.dump(config, f)
    return output_path


def load_config(path: str | Path) -> dict:
    """Loads a saved pipeline configuration from a pickle file.

    Args:
        path (str | Path): Path to the saved pickle configuration file.

    Returns:
        dict: Deserialized configuration dictionary.
    """
    with open(path, "rb") as f:
        return pickle.load(f)