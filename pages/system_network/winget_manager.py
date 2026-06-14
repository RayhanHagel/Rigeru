import streamlit as st
from utilities.util_winget import (
    is_winget_installed, install_winget,
    search_winget, install_packages, uninstall_package,
    update_package, upgrade_all, list_installed
)
from utilities.util_persistent import apply_footer

# --- State Initialization ---
if "winget_search_results" not in st.session_state:
    st.session_state.winget_search_results = []
if "winget_selected_pkgs" not in st.session_state:
    st.session_state.winget_selected_pkgs = set()
if "winget_installed_list" not in st.session_state:
    st.session_state.winget_installed_list = []

st.header("🪟 Winget Package Manager")
st.markdown("Visually search, install, and manage your Windows applications using the official Windows Package Manager.")

# --- Install winget if missing ---
if not is_winget_installed():
    st.warning("⚠️ Winget (App Installer) is not detected on this system.")
    st.markdown(
        "Winget is included with **Windows 10/11** via the **App Installer** package.")
    if st.button("📦 Open Microsoft Store (App Installer)", type="primary", width="stretch"):
        ok, msg = install_winget()
        st.info(msg)
    st.stop()

tab_search, tab_manage, tab_update = st.tabs(
    ["🔍 Search & Install", "📦 Manage Installed", "⚙️ Batch Upgrades"])

# --- TAB 1: Search & Install ---
with tab_search:
    with st.container(border=True):
        col_search, col_btn = st.columns([4, 1], vertical_alignment="bottom")
        search_query = col_search.text_input(
            "Search Winget Repository",
            placeholder="e.g., VLC, PowerToys, Firefox...",
            key="winget_search_input"
        )

        if col_btn.button("🔍 Search", type="primary", width="stretch", key="winget_search_btn"):
            if search_query:
                with st.spinner(f"Searching for '{search_query}'..."):
                    success, results = search_winget(search_query)
                    if success:
                        st.session_state.winget_search_results = results
                        st.session_state.winget_selected_pkgs = set()
                    else:
                        st.error("No results found.")
                        st.session_state.winget_search_results = []
            else:
                st.warning("Please enter a software name to search.")

    # --- Checkable Results ---
    if st.session_state.winget_search_results:
        st.markdown(
            f"### Results ({len(st.session_state.winget_search_results)} found)")

        for idx, pkg in enumerate(st.session_state.winget_search_results):
            pkg_id = pkg["id"]
            label = f"**{pkg['name']}** `{pkg_id}` — `{pkg['version']}` — source: `{pkg['source']}`"

            # FIX: Append an enumerate index (_idx) to guarantee absolute uniqueness
            safe_key = f"{pkg_id.replace('.', '_').replace(' ', '_')}_{idx}"

            checked = st.checkbox(label, key=f"winget_chk_{safe_key}", value=(
                pkg_id in st.session_state.winget_selected_pkgs))
            if checked:
                st.session_state.winget_selected_pkgs.add(pkg_id)
            else:
                st.session_state.winget_selected_pkgs.discard(pkg_id)

        selected = list(st.session_state.winget_selected_pkgs)
        if selected:
            st.divider()
            st.markdown(
                f"**Selected for install:** {', '.join(f'`{p}`' for p in selected)}")
            if st.button(f"⬇️ Install {len(selected)} Package(s)", type="primary", width="stretch", key="winget_install_selected"):
                with st.spinner(f"Installing {len(selected)} package(s)..."):
                    success, log = install_packages(selected)
                if success:
                    st.success("Installation complete!")
                    st.session_state.winget_installed_list = []
                    st.session_state.winget_selected_pkgs = set()
                else:
                    st.error("Installation encountered errors.")
                st.code(log, language="text")

# --- TAB 2: Manage Installed ---
with tab_manage:
    col_hdr, col_ref = st.columns([4, 1], vertical_alignment="center")
    col_hdr.markdown("### Currently Installed Software")

    if col_ref.button("Refresh List", key="winget_refresh", width="stretch", icon=":material/refresh:") or not st.session_state.winget_installed_list:
        with st.spinner("Fetching installed packages..."):
            success, apps = list_installed()
            if success:
                st.session_state.winget_installed_list = apps
            else:
                st.error("Failed to fetch installed packages.")

    for idx, pkg in enumerate(st.session_state.winget_installed_list):
        target_id = pkg.get('id', pkg.get('name', ''))

        # FIX: Append an enumerate index (_idx) to guarantee absolute uniqueness for duplicate names like Microsoft.DirectX
        safe_key = f"{target_id.replace('.', '_').replace(' ', '_')}_{idx}"

        with st.container(border=True):
            col_name, col_ver, col_upd, col_un = st.columns(
                [2, 2, 1, 1], vertical_alignment="center")
            col_name.markdown(f"**{pkg.get('name', 'Unknown')}**")
            col_name.caption(f"`{target_id}`")

            if pkg.get('is_outdated'):
                col_ver.markdown(
                    f"~~`{pkg.get('version', 'N/A')}`~~ → :green[`{pkg.get('new_version', '?')}`]"
                )
                if col_upd.button("⬆️ Update", key=f"upd_{safe_key}", width="stretch"):
                    with st.spinner(f"Updating {target_id}..."):
                        success, log = update_package(target_id)
                    if success:
                        st.success(f"Updated {target_id}")
                        st.session_state.winget_installed_list = []
                        st.rerun()
                    else:
                        st.error(f"Failed to update {target_id}")
                        st.code(log)
            else:
                col_ver.caption(f"Ver: {pkg.get('version', 'N/A')}")
                col_upd.write("")  # spacer

            if col_un.button("🗑️ Uninstall", key=f"un_{safe_key}", width="stretch"):
                with st.spinner(f"Uninstalling {target_id}..."):
                    success, log = uninstall_package(target_id)
                if success:
                    st.success(f"Uninstalled {target_id}")
                    st.session_state.winget_installed_list = []
                    st.rerun()
                else:
                    st.error(f"Failed to uninstall {target_id}")
                    st.code(log)

# --- TAB 3: Upgrades ---
with tab_update:
    st.markdown("### Batch Software Upgrades")
    st.info(
        "Winget will scan your system for outdated software and upgrade them silently.")

    if st.button("🚀 Upgrade All Outdated Packages", type="primary", key="winget_upgrade_all"):
        with st.spinner("Scanning and upgrading packages..."):
            success, log = upgrade_all()
        if success:
            st.success("All packages upgraded!")
            st.session_state.winget_installed_list = []
        else:
            st.warning("No upgrades available or errors occurred.")
        st.code(log, language="text", height=400)

apply_footer()
