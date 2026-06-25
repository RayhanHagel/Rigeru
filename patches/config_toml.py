import os

CONFIG_CONTENT = """\
[browser]
gatherUsageStats = false

[theme]
base = "dark"

[server]
enableStaticServing = true
"""

def write_streamlit_config():
    streamlit_dir = os.path.join(os.path.expanduser("~"), ".streamlit")
    config_path = os.path.join(streamlit_dir, "config.toml")

    os.makedirs(streamlit_dir, exist_ok=True)

    with open(config_path, "w") as f:
        f.write(CONFIG_CONTENT)

    print(f"✅ config.toml written to: {config_path}")

if __name__ == "__main__":
    write_streamlit_config()