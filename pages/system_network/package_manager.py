import time
import threading
import streamlit as st
from streamlit.runtime.scriptrunner import add_script_run_ctx

# --- Aliased Imports to prevent collisions ---
from utilities.util_package_manager import load_local_cache, save_local_cache, fetch_all_fresh_data
from utilities.util_package_scoop import (
    is_scoop_installed, install_scoop, search_scoop,
    install_packages as install_scoop_pkgs, uninstall_package as uninstall_scoop_pkg,
    update_package as update_scoop_pkg, update_all as update_all_scoop,
    update_scoop, cleanup_scoop
)
from utilities.util_package_winget import (
    is_winget_installed, install_winget, search_winget,
    install_packages as install_winget_pkgs, uninstall_package as uninstall_winget_pkg,
    update_package as update_winget_pkg, upgrade_all as upgrade_all_winget
)
from utilities.util_package_choco import (
    is_choco_installed, install_choco, search_choco,
    install_packages as install_choco_pkgs, uninstall_package as uninstall_choco_pkg,
    update_package as update_choco_pkg, upgrade_all as upgrade_all_choco
)


# --- Page Configuration ---
st.set_page_config(page_title="Universal Package Manager", page_icon=":material/package:", layout="wide")

# --- SWR Background Thread Logic ---
def run_revalidation_thread():
    """Runs the CLI fetches in the background, updates JSON, and signals the main thread."""
    fresh_data = fetch_all_fresh_data(st.session_state.swr_cache)
    save_local_cache(fresh_data)
    
    st.session_state.swr_cache = fresh_data
    st.session_state.is_revalidating = False
    st.session_state.swr_finished = True

def trigger_background_refresh():
    """Kicks off the SWR thread if one isn't already running."""
    if not st.session_state.get("is_revalidating", False):
        st.session_state.is_revalidating = True
        t = threading.Thread(target=run_revalidation_thread)
        add_script_run_ctx(t)
        t.start()

def is_pm_installed(pm_name: str, cli_check_func) -> bool:
    """
    Checks if a package manager is installed by checking the JSON cache first.
    Falls back to the CLI function if the cache is empty.
    Caches the result in session_state so it runs instantly on future UI re-renders.
    """
    state_key = f"{pm_name}_is_installed"
    
    if state_key not in st.session_state:
        # 1. Fast Path: If we have cached packages, the manager is definitely installed
        if len(st.session_state.swr_cache.get(pm_name, [])) > 0:
            st.session_state[state_key] = True
        else:
            # 2. Slow Path: Fall back to the actual CLI check
            st.session_state[state_key] = cli_check_func()
            
    return st.session_state[state_key]

# --- Dynamic State Initialization ---
prefixes = ["winget", "scoop", "choco"]
for pfx in prefixes:
    if f"{pfx}_search_results" not in st.session_state:
        st.session_state[f"{pfx}_search_results"] = []
    if f"{pfx}_selected_pkgs" not in st.session_state:
        st.session_state[f"{pfx}_selected_pkgs"] = set()

if "is_processing" not in st.session_state:
    st.session_state.is_processing = False

# --- Initialize SWR State ---
if "swr_cache" not in st.session_state:
    st.session_state.swr_cache = load_local_cache()
    trigger_background_refresh()

# --- NEW: SWR Watcher Fragment ---
@st.fragment(run_every=1)
def swr_watcher():
    """Silently watches the background thread and safely refreshes the UI when done."""
    if st.session_state.get("swr_finished", False):
        # Reset the flag so we don't get stuck in an infinite loop
        st.session_state.swr_finished = False
        st.rerun()

# Activate the watcher
swr_watcher()

# --- Main Header ---
st.title(":material/package_2: Universal Package Manager")
st.markdown("Search, install, and manage your Windows software from a single interface.")

if st.session_state.get("is_revalidating", False):
    st.caption(":material/sync: Revalidating installed packages in the background...")
else:
    st.write("")

# --- Unified Task Execution (Synchronous & Reliable) ---
def execute_task(task_name, func, success_msg, error_msg, placeholder, *args, trigger_reval=False):
    """Executes a task synchronously, updates the progress bar, triggers SWR refresh if needed."""
    st.session_state.is_processing = True

    try:
        placeholder.progress(10, text=f":material/hourglass_empty: **{task_name}**: Initializing...")
        time.sleep(0.5) 
        
        placeholder.progress(50, text=f":material/hourglass_empty: **{task_name}**: Executing command (this may take a moment)...")
        
        # Execute the actual utility function
        success, log = func(*args)
        
        if success:
            if trigger_reval:
                # Fire off the background thread to update the JSON
                trigger_background_refresh()
                
            placeholder.progress(100, text=f":material/check_circle: **{task_name}**: Complete!")
            st.toast(success_msg, icon=":material/check_circle:")
            time.sleep(1.5)
        else:
            placeholder.progress(100, text=f":material/cancel: **{task_name}**: Failed.")
            st.toast(error_msg, icon=":material/cancel:")
            if log:
                placeholder.error(f"**Error Details:**\n{log}")
            time.sleep(4) 
            
    finally:
        st.session_state.is_processing = False
        placeholder.empty()
        st.rerun()

# --- Top Level Tabs for Package Managers ---
tab_winget, tab_scoop, tab_choco = st.tabs([
    ":material/desktop_windows: Winget", 
    ":material/icecream: Scoop", 
    ":material/cookie: Chocolatey"
])

# ==========================================
#               WINGET UI 
# ==========================================
@st.fragment
def render_winget_ui():
    if not is_pm_installed("winget", is_winget_installed):
        st.warning("Winget (App Installer) is not detected on this system.", icon=":material/warning:")
        if st.button("Open Microsoft Store (App Installer)", type="primary", icon=":material/store:"):
            ok, msg = install_winget()
            st.info(msg, icon=":material/info:")
    else:
        st.subheader(":material/search: Search & Install")
        with st.container(border=True):
            col_s, col_b = st.columns([4, 1], vertical_alignment="bottom")
            w_query = col_s.text_input("Search Winget Repository", placeholder="e.g., VLC, PowerToys...", key="w_search_input")
            if col_b.button("Search", type="primary", use_container_width=True, key="w_search_btn", disabled=st.session_state.is_processing, icon=":material/search:"):
                if w_query:
                    with st.spinner(f"Searching for '{w_query}'..."):
                        success, results = search_winget(w_query)
                        if success:
                            st.session_state.winget_search_results = results
                            st.session_state.winget_selected_pkgs = set()
                        else:
                            st.error("No results found.", icon=":material/error:")
                            st.session_state.winget_search_results = []
        
        if st.session_state.winget_search_results:
            st.markdown(f"**Results ({len(st.session_state.winget_search_results)} found)**")
            
            with st.container(height=400, border=True):
                for idx, pkg in enumerate(st.session_state.winget_search_results):
                    pkg_id = pkg["id"]
                    label = f"**{pkg['name']}** `{pkg_id}` — `{pkg['version']}` (Source: `{pkg['source']}`)"
                    safe_key = f"{pkg_id.replace('.', '_').replace(' ', '_')}_{idx}"
                    if st.checkbox(label, key=f"w_chk_{safe_key}", value=(pkg_id in st.session_state.winget_selected_pkgs)):
                        st.session_state.winget_selected_pkgs.add(pkg_id)
                    else:
                        st.session_state.winget_selected_pkgs.discard(pkg_id)

            selected = list(st.session_state.winget_selected_pkgs)
            if selected:
                st.info(f"**Selected:** {', '.join(f'`{p}`' for p in selected)}", icon=":material/info:")
                for p in selected:
                    c1, c2 = st.columns([10, 1], vertical_alignment="center")
                    c1.code(p)
                    if c2.button(" ", key=f"w_del_{p}", help="Remove from queue", icon=":material/close:"):
                        st.session_state.winget_selected_pkgs.remove(p)
                        st.rerun()

                st.write("")
                btn_w_inst = st.button(f"Install {len(selected)} Package(s)", type="primary", key="w_inst_btn", icon=":material/download:", disabled=st.session_state.is_processing)
                if btn_w_inst:
                    ph = st.empty() 
                    st.session_state.winget_selected_pkgs = set()
                    st.session_state.winget_search_results = []
                    execute_task(
                        "Winget Installation", install_winget_pkgs, "Winget installation complete!", "Winget installation encountered errors.", 
                        ph, selected, trigger_reval=True
                    )

        st.divider()

        st.subheader(":material/rocket_launch: Batch Upgrades")
        btn_w_upd_all = st.button("Upgrade All Outdated Packages", type="primary", key="w_upd_all", icon=":material/rocket_launch:", disabled=st.session_state.is_processing)
        if btn_w_upd_all:
            ph = st.empty()
            execute_task("Winget Batch Upgrade", upgrade_all_winget, "All Winget packages upgraded!", "Winget upgrades finished (errors or none available).", ph, trigger_reval=True)

        st.divider()

        st.subheader(":material/inventory_2: Manage Installed")
        col_hdr, col_ref = st.columns([4, 1], vertical_alignment="center")
        
        # Trigger background SWR thread explicitly
        if col_ref.button("Refresh List", key="w_ref", use_container_width=True, icon=":material/refresh:", disabled=(st.session_state.is_processing or st.session_state.get("is_revalidating", False))):
            trigger_background_refresh()
            st.rerun()
            
        # SWR Load: Grab instantly from JSON state
        winget_installed_list = st.session_state.swr_cache.get("winget", [])

        search_manage_w = st.text_input("Find an installed package", placeholder="Type to filter visually...", key="w_manage_search")
        
        sorted_apps = sorted(winget_installed_list, key=lambda x: (not x.get('is_outdated', False), x.get('name', '').lower()))
        
        if search_manage_w:
            term = search_manage_w.lower()
            display_apps = [app for app in sorted_apps if term in app.get('name', '').lower() or term in app.get('id', '').lower()]
        else:
            display_apps = sorted_apps

        if not display_apps and winget_installed_list:
            st.warning("No packages match your search.", icon=":material/search_off:")

        for idx, pkg in enumerate(display_apps):
            target_id = pkg.get('id', pkg.get('name', ''))
            safe_key = f"{target_id.replace('.', '_').replace(' ', '_')}_{idx}"
            
            with st.container(border=True):
                c1, c2, c3, c4 = st.columns([2, 2, 1, 1], vertical_alignment="center")
                c1.markdown(f"**{pkg.get('name', 'Unknown')}**<br><sub>`{target_id}`</sub>", unsafe_allow_html=True)
                
                btn_w_update = False
                btn_w_uninst = False

                if pkg.get('is_outdated'):
                    c2.markdown(f"~~`{pkg.get('version', 'N/A')}`~~ → :orange[`{pkg.get('new_version', '?')}`]")
                    btn_w_update = c3.button("Update", key=f"w_upd_{safe_key}", use_container_width=True, icon=":material/update:", disabled=st.session_state.is_processing)
                else:
                    c2.caption(f"Ver: {pkg.get('version', 'N/A')}")
                
                btn_w_uninst = c4.button("Uninstall", key=f"w_un_{safe_key}", use_container_width=True, icon=":material/delete:", disabled=st.session_state.is_processing)

                if btn_w_update or btn_w_uninst:
                    ph = st.empty()
                    if btn_w_update:
                        execute_task(f"Updating {target_id}", update_winget_pkg, f"{target_id} updated successfully!", f"Failed to update {target_id}.", ph, target_id, trigger_reval=True)
                    elif btn_w_uninst:
                        execute_task(f"Uninstalling {target_id}", uninstall_winget_pkg, f"{target_id} uninstalled successfully!", f"Failed to uninstall {target_id}.", ph, target_id, trigger_reval=True)

with tab_winget:
    render_winget_ui()


# ==========================================
#               SCOOP UI 
# ==========================================
@st.fragment
def render_scoop_ui():
    if not is_pm_installed("scoop", is_scoop_installed):
        st.warning("Scoop is not installed on this system.", icon=":material/warning:")
        if st.button("Install Scoop Now", type="primary", icon=":material/download:", disabled=st.session_state.is_processing):
            with st.spinner("Running Scoop bootstrap via PowerShell..."):
                success, log = install_scoop()
                if success:
                    st.success("Scoop installed successfully! Please restart the app.", icon=":material/check_circle:")
                else:
                    st.error("Installation failed.", icon=":material/error:")
                    st.code(log)
    else:
        st.subheader(":material/search: Search & Install")
        with st.container(border=True):
            col_s, col_b = st.columns([4, 1], vertical_alignment="bottom")
            s_query = col_s.text_input("Search Scoop Buckets", placeholder="e.g., ffmpeg, nodejs...", key="s_search_input")
            if col_b.button("Search", type="primary", use_container_width=True, key="s_search_btn", disabled=st.session_state.is_processing, icon=":material/search:"):
                if s_query:
                    with st.spinner(f"Searching for '{s_query}'..."):
                        success, results = search_scoop(s_query)
                        if success:
                            st.session_state.scoop_search_results = results
                            st.session_state.scoop_selected_pkgs = set()
                        else:
                            st.error("No results found.", icon=":material/error:")
                            st.session_state.scoop_search_results = []
        
        if st.session_state.scoop_search_results:
            st.markdown(f"**Results ({len(st.session_state.scoop_search_results)} found)**")
            
            with st.container(height=400, border=True):
                for idx, pkg in enumerate(st.session_state.scoop_search_results):
                    pkg_name = pkg["name"]
                    label = f"**{pkg_name}** `{pkg['version']}` — Bucket: `{pkg['bucket']}`"
                    safe_key = f"{pkg_name.replace('.', '_')}_{idx}"
                    if st.checkbox(label, key=f"s_chk_{safe_key}", value=(pkg_name in st.session_state.scoop_selected_pkgs)):
                        st.session_state.scoop_selected_pkgs.add(pkg_name)
                    else:
                        st.session_state.scoop_selected_pkgs.discard(pkg_name)

            selected = list(st.session_state.scoop_selected_pkgs)
            if selected:
                st.info(f"**Selected:** {', '.join(f'`{p}`' for p in selected)}", icon=":material/info:")
                for p in selected:
                    c1, c2 = st.columns([10, 1], vertical_alignment="center")
                    c1.code(p)
                    if c2.button(" ", key=f"s_del_{p}", help="Remove from queue", icon=":material/close:"):
                        st.session_state.scoop_selected_pkgs.remove(p)
                        st.rerun()

                st.write("")
                btn_s_inst = st.button(f"Install {len(selected)} Package(s)", type="primary", key="s_inst_btn", icon=":material/download:", disabled=st.session_state.is_processing)
                if btn_s_inst:
                    ph = st.empty()
                    st.session_state.scoop_selected_pkgs = set()
                    st.session_state.scoop_search_results = []
                    execute_task("Scoop Installation", install_scoop_pkgs, "Scoop installation complete!", "Scoop installation failed.", ph, selected, trigger_reval=True)

        st.divider()

        st.subheader(":material/build: System Maintenance")
        c_a, c_b, c_c = st.columns(3)
        
        btn_s_manifest = c_a.button("Update Manifests", use_container_width=True, icon=":material/sync:", disabled=st.session_state.is_processing)
        btn_s_upd_all = c_b.button("Update All Packages", type="primary", use_container_width=True, icon=":material/update:", disabled=st.session_state.is_processing)
        btn_s_cleanup = c_c.button("Cleanup Old Versions", use_container_width=True, icon=":material/cleaning_services:", disabled=st.session_state.is_processing)
        
        if btn_s_manifest or btn_s_upd_all or btn_s_cleanup:
            ph = st.empty()
            if btn_s_manifest:
                execute_task("Scoop Manifest Update", update_scoop, "Scoop manifests updated successfully!", "Failed to update Scoop manifests.", ph)
            elif btn_s_upd_all:
                execute_task("Scoop Batch Upgrade", update_all_scoop, "All Scoop packages updated!", "Scoop update finished.", ph, trigger_reval=True)
            elif btn_s_cleanup:
                execute_task("Scoop Cleanup", cleanup_scoop, "Scoop cleanup complete! Reclaimed disk space.", "Scoop cleanup failed.", ph)

        st.divider()

        st.subheader(":material/inventory_2: Manage Installed")
        col_hdr, col_ref = st.columns([4, 1], vertical_alignment="center")
        
        if col_ref.button("Refresh List", key="s_ref", use_container_width=True, icon=":material/refresh:", disabled=(st.session_state.is_processing or st.session_state.get("is_revalidating", False))):
            trigger_background_refresh()
            st.rerun()
            
        scoop_installed_list = st.session_state.swr_cache.get("scoop", [])

        search_manage_s = st.text_input("Find an installed package", placeholder="Type to filter visually...", key="s_manage_search")
        
        sorted_apps = sorted(scoop_installed_list, key=lambda x: (not x.get('is_outdated', False), x.get('name', '').lower()))
        
        if search_manage_s:
            term = search_manage_s.lower()
            display_apps = [app for app in sorted_apps if term in app.get('name', '').lower()]
        else:
            display_apps = sorted_apps

        if not display_apps and scoop_installed_list:
            st.warning("No packages match your search.", icon=":material/search_off:")

        for idx, pkg in enumerate(display_apps):
            safe_key = f"{pkg.get('name', 'Unknown')}_{idx}"
            
            with st.container(border=True):
                c1, c2, c3, c4 = st.columns([2, 2, 1, 1], vertical_alignment="center")
                c1.markdown(f"**{pkg.get('name', 'Unknown')}**")
                
                btn_s_update = False
                btn_s_uninst = False

                if pkg.get('is_outdated'):
                    c2.markdown(f"~~`{pkg.get('version', 'N/A')}`~~ → :orange[`{pkg.get('new_version', '?')}`]")
                    btn_s_update = c3.button("Update", key=f"s_upd_{safe_key}", use_container_width=True, icon=":material/update:", disabled=st.session_state.is_processing)
                else:
                    c2.caption(f"Ver: {pkg.get('version', 'N/A')}")
                
                btn_s_uninst = c4.button("Uninstall", key=f"s_un_{safe_key}", use_container_width=True, icon=":material/delete:", disabled=st.session_state.is_processing)

                if btn_s_update or btn_s_uninst:
                    ph = st.empty()
                    if btn_s_update:
                        execute_task(f"Updating {pkg['name']}", update_scoop_pkg, f"{pkg['name']} updated successfully!", f"Failed to update {pkg['name']}.", ph, pkg['name'], trigger_reval=True)
                    elif btn_s_uninst:
                        execute_task(f"Uninstalling {pkg['name']}", uninstall_scoop_pkg, f"{pkg['name']} uninstalled successfully!", f"Failed to uninstall {pkg['name']}.", ph, pkg['name'], trigger_reval=True)

with tab_scoop:
    render_scoop_ui()


# ==========================================
#               CHOCOLATEY UI 
# ==========================================
@st.fragment
def render_choco_ui():
    if not is_pm_installed("choco", is_choco_installed):
        st.warning("Chocolatey is not installed on this system.", icon=":material/warning:")
        st.info("**Note:** Installing Chocolatey requires an **Administrator** session.", icon=":material/info:")
        if st.button("Install Chocolatey Now", type="primary", icon=":material/download:", disabled=st.session_state.is_processing):
            with st.spinner("Running bootstrap..."):
                success, log = install_choco()
                if success:
                    st.success("Chocolatey installed successfully! Please restart the app.", icon=":material/check_circle:")
                else:
                    st.error("Installation failed. Make sure you're running as Administrator.", icon=":material/error:")
                    st.code(log)
    else:
        st.subheader(":material/search: Search & Install")
        with st.container(border=True):
            col_s, col_b = st.columns([4, 1], vertical_alignment="bottom")
            c_query = col_s.text_input("Search Chocolatey Repo", placeholder="e.g., 7zip, git...", key="c_search_input")
            if col_b.button("Search", type="primary", use_container_width=True, key="c_search_btn", disabled=st.session_state.is_processing, icon=":material/search:"):
                if c_query:
                    with st.spinner(f"Searching for '{c_query}'..."):
                        success, results = search_choco(c_query)
                        if success:
                            st.session_state.choco_search_results = results
                            st.session_state.choco_selected_pkgs = set()
                        else:
                            st.error("No results found.", icon=":material/error:")
                            st.session_state.choco_search_results = []

        if st.session_state.choco_search_results:
            st.markdown(f"**Results ({len(st.session_state.choco_search_results)} found)**")
            
            with st.container(height=400, border=True):
                for idx, pkg in enumerate(st.session_state.choco_search_results):
                    pkg_name = pkg["name"]
                    label = f"**{pkg_name}** — `{pkg['version']}`"
                    safe_key = f"{pkg_name.replace('.', '_')}_{idx}"
                    if st.checkbox(label, key=f"c_chk_{safe_key}", value=(pkg_name in st.session_state.choco_selected_pkgs)):
                        st.session_state.choco_selected_pkgs.add(pkg_name)
                    else:
                        st.session_state.choco_selected_pkgs.discard(pkg_name)

            selected = list(st.session_state.choco_selected_pkgs)
            if selected:
                st.info(f"**Selected:** {', '.join(f'`{p}`' for p in selected)}", icon=":material/info:")
                for p in selected:
                    c1, c2 = st.columns([10, 1], vertical_alignment="center")
                    c1.code(p)
                    if c2.button(" ", key=f"c_del_{p}", help="Remove from queue", icon=":material/close:"):
                        st.session_state.choco_selected_pkgs.remove(p)
                        st.rerun()

                st.write("")
                btn_c_inst = st.button(f"Install {len(selected)} Package(s)", type="primary", key="c_inst_btn", icon=":material/download:", disabled=st.session_state.is_processing)
                if btn_c_inst:
                    ph = st.empty()
                    st.session_state.choco_selected_pkgs = set()
                    st.session_state.choco_search_results = []
                    execute_task("Chocolatey Installation", install_choco_pkgs, "Chocolatey installation complete!", "Chocolatey installation failed.", ph, selected, trigger_reval=True)

        st.divider()

        st.subheader(":material/rocket_launch: Batch Upgrades")
        btn_c_upd_all = st.button("Upgrade All Packages", type="primary", key="c_upd_all", icon=":material/rocket_launch:", disabled=st.session_state.is_processing)
        if btn_c_upd_all:
            ph = st.empty()
            execute_task("Chocolatey Batch Upgrade", upgrade_all_choco, "All Chocolatey packages upgraded!", "Chocolatey upgrades finished.", ph, trigger_reval=True)

        st.divider()

        st.subheader(":material/inventory_2: Manage Installed")
        col_hdr, col_ref = st.columns([4, 1], vertical_alignment="center")
        
        if col_ref.button("Refresh List", key="c_ref", use_container_width=True, icon=":material/refresh:", disabled=(st.session_state.is_processing or st.session_state.get("is_revalidating", False))):
            trigger_background_refresh()
            st.rerun()
            
        choco_installed_list = st.session_state.swr_cache.get("choco", [])

        search_manage_c = st.text_input("Find an installed package", placeholder="Type to filter visually...", key="c_manage_search")
        
        sorted_apps = sorted(choco_installed_list, key=lambda x: (not x.get('is_outdated', False), x.get('name', '').lower()))
        
        if search_manage_c:
            term = search_manage_c.lower()
            display_apps = [app for app in sorted_apps if term in app.get('name', '').lower()]
        else:
            display_apps = sorted_apps

        if not display_apps and choco_installed_list:
            st.warning("No packages match your search.", icon=":material/search_off:")

        for idx, pkg in enumerate(display_apps):
            pkg_name = pkg.get('name', 'Unknown')
            safe_key = f"{pkg_name.replace('.', '_')}_{idx}"
            
            with st.container(border=True):
                c1, c2, c3, c4 = st.columns([2, 2, 1, 1], vertical_alignment="center")
                c1.markdown(f"**{pkg_name}**")
                
                btn_c_update = False
                btn_c_uninst = False

                if pkg.get('is_outdated'):
                    c2.markdown(f"~~`{pkg.get('version', 'N/A')}`~~ → :orange[`{pkg.get('new_version', '?')}`]")
                    btn_c_update = c3.button("Update", key=f"c_upd_{safe_key}", use_container_width=True, icon=":material/update:", disabled=st.session_state.is_processing)
                else:
                    c2.caption(f"Ver: {pkg.get('version', 'N/A')}")
                
                btn_c_uninst = c4.button("Uninstall", key=f"c_un_{safe_key}", use_container_width=True, icon=":material/delete:", disabled=st.session_state.is_processing)

                if btn_c_update or btn_c_uninst:
                    ph = st.empty()
                    if btn_c_update:
                        execute_task(f"Updating {pkg_name}", update_choco_pkg, f"{pkg_name} updated successfully!", f"Failed to update {pkg_name}.", ph, pkg_name, trigger_reval=True)
                    elif btn_c_uninst:
                        execute_task(f"Uninstalling {pkg_name}", uninstall_choco_pkg, f"{pkg_name} uninstalled successfully!", f"Failed to uninstall {pkg_name}.", ph, pkg_name, trigger_reval=True)

with tab_choco:
    render_choco_ui()