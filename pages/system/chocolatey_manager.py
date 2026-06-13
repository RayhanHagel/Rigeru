import streamlit as st
from utilities.util_choco import (
    is_choco_installed, install_choco,
    search_choco, install_packages, uninstall_package,
    update_package, upgrade_all, list_installed
)
from utilities.util_persistent import apply_footer

# --- State Initialization ---
if "choco_search_results" not in st.session_state:
    st.session_state.choco_search_results = []
if "choco_selected_pkgs" not in st.session_state:
    st.session_state.choco_selected_pkgs = set()
if "choco_installed_list" not in st.session_state:
    st.session_state.choco_installed_list = []

st.header("🍫 Chocolatey Package Manager")
st.markdown("Visually search, install, and manage Windows software packages via Chocolatey.")

# --- Install Chocolatey if missing ---
if not is_choco_installed():
    st.warning("⚠️ Chocolatey is not installed on this system.")
    st.info("**Note:** Installing Chocolatey requires an **Administrator** PowerShell session. Make sure this app is running as Administrator.")
    if st.button("⬇️ Install Chocolatey Now", type="primary", width="stretch"):
        with st.spinner("Running Chocolatey bootstrap via PowerShell (this may take a minute)..."):
            success, log = install_choco()
        if success:
            st.success("Chocolatey installed successfully! Please restart the app.")
        else:
            st.error("Installation failed. Make sure you're running as Administrator.")
            st.code(log)
    st.stop()

tab_search, tab_manage, tab_update = st.tabs(["🔍 Search & Install", "📦 Manage Installed", "⚙️ Batch Upgrades"])

# --- TAB 1: Search & Install ---
with tab_search:
    with st.container(border=True):
        col_search, col_btn = st.columns([4, 1], vertical_alignment="bottom")
        search_query = col_search.text_input(
            "Search Chocolatey Community Repository",
            placeholder="e.g., 7zip, git, vlc, notepadplusplus...",
            key="choco_search_input"
        )

        if col_btn.button("🔍 Search", type="primary", width="stretch", key="choco_search_btn"):
            if search_query:
                with st.spinner(f"Searching for '{search_query}'..."):
                    success, results = search_choco(search_query)
                    if success:
                        st.session_state.choco_search_results = results
                        st.session_state.choco_selected_pkgs = set()
                    else:
                        st.error("No results found or Chocolatey search failed.")
                        st.session_state.choco_search_results = []
            else:
                st.warning("Please enter a package name to search.")

    # --- Checkable Results ---
    if st.session_state.choco_search_results:
        st.markdown(f"### Results ({len(st.session_state.choco_search_results)} found)")

        for pkg in st.session_state.choco_search_results:
            pkg_name = pkg["name"]
            label = f"**{pkg_name}** — `{pkg['version']}`"
            safe_key = pkg_name.replace(".", "_").replace(" ", "_")
            checked = st.checkbox(label, key=f"choco_chk_{safe_key}", value=(pkg_name in st.session_state.choco_selected_pkgs))
            if checked:
                st.session_state.choco_selected_pkgs.add(pkg_name)
            else:
                st.session_state.choco_selected_pkgs.discard(pkg_name)

        selected = list(st.session_state.choco_selected_pkgs)
        if selected:
            st.divider()
            st.markdown(f"**Selected for install:** {', '.join(f'`{p}`' for p in selected)}")
            if st.button(f"⬇️ Install {len(selected)} Package(s)", type="primary", width="stretch", key="choco_install_selected"):
                with st.spinner(f"Installing {', '.join(selected)} (requires admin)..."):
                    success, log = install_packages(selected)
                if success:
                    st.success("Installation complete!")
                    st.session_state.choco_installed_list = []
                    st.session_state.choco_selected_pkgs = set()
                else:
                    st.error("Installation encountered errors.")
                st.code(log, language="text")

# --- TAB 2: Manage Installed ---
with tab_manage:
    col_hdr, col_ref = st.columns([4, 1], vertical_alignment="center")
    col_hdr.markdown("### Currently Installed Packages")

    if col_ref.button("🔄 Refresh List", width="stretch", key="choco_refresh") or not st.session_state.choco_installed_list:
        with st.spinner("Fetching installed packages..."):
            success, apps = list_installed()
            if success:
                st.session_state.choco_installed_list = apps
            else:
                st.error("Failed to fetch installed packages.")

    for pkg in st.session_state.choco_installed_list:
        pkg_name = pkg.get('name', 'Unknown')
        safe_key = pkg_name.replace(".", "_").replace(" ", "_")

        with st.container(border=True):
            col_name, col_ver, col_upd, col_un = st.columns([2, 2, 1, 1], vertical_alignment="center")
            col_name.markdown(f"**{pkg_name}**")

            if pkg.get('is_outdated'):
                col_ver.markdown(
                    f"~~`{pkg.get('version', 'N/A')}`~~ → :green[`{pkg.get('new_version', '?')}`]"
                )
                if col_upd.button("⬆️ Update", key=f"choco_upd_{safe_key}", width="stretch"):
                    with st.spinner(f"Updating {pkg_name}..."):
                        success, log = update_package(pkg_name)
                    if success:
                        st.success(f"Updated {pkg_name}")
                        st.session_state.choco_installed_list = []
                        st.rerun()
                    else:
                        st.error(f"Update failed: {pkg_name}")
                        st.code(log)
            else:
                col_ver.caption(f"Version: {pkg.get('version', 'N/A')}")
                col_upd.write("")

            if col_un.button("🗑️ Uninstall", key=f"choco_un_{safe_key}", width="stretch"):
                with st.spinner(f"Uninstalling {pkg_name}..."):
                    success, log = uninstall_package(pkg_name)
                if success:
                    st.success(f"Uninstalled {pkg_name}")
                    st.session_state.choco_installed_list = []
                    st.rerun()
                else:
                    st.error(f"Failed to uninstall {pkg_name}")
                    st.code(log)

# --- TAB 3: Batch Upgrades ---
with tab_update:
    st.markdown("### Batch Software Upgrades")
    st.info("Chocolatey will scan your system for outdated software and upgrade them all.")

    if st.button("🚀 Upgrade All Packages", type="primary", key="choco_upgrade_all"):
        with st.spinner("Upgrading all packages (requires admin)..."):
            success, log = upgrade_all()
        if success:
            st.success("All packages upgraded!")
            st.session_state.choco_installed_list = []
        else:
            st.warning("No upgrades available or errors occurred.")
        st.code(log, language="text", height=400)

apply_footer()
