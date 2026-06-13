import streamlit as st
from utilities.util_scoop import (
    is_scoop_installed, install_scoop,
    search_scoop, install_packages, uninstall_package,
    update_package, update_all, update_scoop, cleanup_scoop, list_installed
)
from utilities.util_persistent import apply_footer

# --- State Initialization ---
if "scoop_search_results" not in st.session_state:
    st.session_state.scoop_search_results = []
if "scoop_selected_pkgs" not in st.session_state:
    st.session_state.scoop_selected_pkgs = set()
if "scoop_installed_list" not in st.session_state:
    st.session_state.scoop_installed_list = []

st.header("🍦 Scoop Package Manager")
st.markdown("Visually search, install, and manage your Windows command-line utilities via Scoop.")

# --- Install Scoop if missing ---
if not is_scoop_installed():
    st.warning("⚠️ Scoop is not installed on this system.")
    if st.button("⬇️ Install Scoop Now", type="primary", width="stretch"):
        with st.spinner("Running Scoop bootstrap via PowerShell..."):
            success, log = install_scoop()
        if success:
            st.success("Scoop installed successfully! Please restart the app.")
        else:
            st.error("Installation failed.")
            st.code(log)
    st.stop()

tab_search, tab_manage, tab_update = st.tabs(["🔍 Search & Install", "📦 Manage Installed", "⚙️ Maintenance"])

# --- TAB 1: Search & Install ---
with tab_search:
    with st.container(border=True):
        col_search, col_btn = st.columns([4, 1], vertical_alignment="bottom")
        search_query = col_search.text_input(
            "Search Scoop Buckets",
            placeholder="e.g., ffmpeg, nodejs, python...",
            key="scoop_search_input"
        )

        if col_btn.button("🔍 Search", type="primary", width="stretch", key="scoop_search_btn"):
            if search_query:
                with st.spinner(f"Searching for '{search_query}'..."):
                    success, results = search_scoop(search_query)
                    if success:
                        st.session_state.scoop_search_results = results
                        st.session_state.scoop_selected_pkgs = set()
                    else:
                        st.error("No results found or Scoop search failed.")
                        st.session_state.scoop_search_results = []
            else:
                st.warning("Please enter a package name to search.")

    # --- Checkable Results ---
    if st.session_state.scoop_search_results:
        st.markdown(f"### Results ({len(st.session_state.scoop_search_results)} found)")

        for pkg in st.session_state.scoop_search_results:
            pkg_name = pkg["name"]
            label = f"**{pkg_name}** `{pkg['version']}` — bucket: `{pkg['bucket']}`"
            checked = st.checkbox(label, key=f"scoop_chk_{pkg_name}", value=(pkg_name in st.session_state.scoop_selected_pkgs))
            if checked:
                st.session_state.scoop_selected_pkgs.add(pkg_name)
            else:
                st.session_state.scoop_selected_pkgs.discard(pkg_name)

        selected = list(st.session_state.scoop_selected_pkgs)
        if selected:
            st.divider()
            st.markdown(f"**Selected for install:** {', '.join(f'`{p}`' for p in selected)}")
            if st.button(f"⬇️ Install {len(selected)} Package(s)", type="primary", width="stretch", key="scoop_install_selected"):
                with st.spinner(f"Installing {', '.join(selected)}..."):
                    success, log = install_packages(selected)
                if success:
                    st.success("Installation complete!")
                    st.session_state.scoop_installed_list = []
                    st.session_state.scoop_selected_pkgs = set()
                else:
                    st.error("Installation encountered errors.")
                st.code(log, language="text")

# --- TAB 2: Manage Installed ---
with tab_manage:
    col_hdr, col_ref = st.columns([4, 1], vertical_alignment="center")
    col_hdr.markdown("### Currently Installed Packages")

    if col_ref.button("🔄 Refresh List", width="stretch", key="scoop_refresh_installed") or not st.session_state.scoop_installed_list:
        with st.spinner("Fetching installed packages..."):
            success, apps = list_installed()
            if success:
                st.session_state.scoop_installed_list = apps
            else:
                st.error("Failed to fetch installed packages.")

    for pkg in st.session_state.scoop_installed_list:
        with st.container(border=True):
            col_name, col_ver, col_act1, col_act2 = st.columns([2, 2, 1, 1], vertical_alignment="center")
            col_name.markdown(f"**{pkg.get('name', 'Unknown')}**")

            if pkg.get('is_outdated'):
                col_ver.markdown(
                    f"~~`{pkg.get('version', 'N/A')}`~~ → :green[`{pkg.get('new_version', '?')}`]"
                )
                if col_act1.button("⬆️ Update", key=f"upd_{pkg['name']}", width="stretch"):
                    with st.spinner(f"Updating {pkg['name']}..."):
                        success, log = update_package(pkg['name'])
                    if success:
                        st.success(f"Updated {pkg['name']}")
                        st.session_state.scoop_installed_list = []
                        st.rerun()
                    else:
                        st.error(f"Failed to update {pkg['name']}")
                        st.code(log)
            else:
                col_ver.caption(f"Version: {pkg.get('version', 'N/A')}")
                col_act1.write("")  # spacer

            if col_act2.button("🗑️ Uninstall", key=f"unin_{pkg['name']}", width="stretch"):
                with st.spinner(f"Uninstalling {pkg['name']}..."):
                    success, log = uninstall_package(pkg['name'])
                if success:
                    st.success(f"Uninstalled {pkg['name']}")
                    st.session_state.scoop_installed_list = []
                    st.rerun()
                else:
                    st.error(f"Failed to uninstall {pkg['name']}")
                    st.code(log)

# --- TAB 3: Maintenance ---
with tab_update:
    st.markdown("### System Maintenance")

    col_a, col_b, col_c = st.columns(3)

    if col_a.button("🔄 Update Manifests", width="stretch", key="scoop_update_manifests"):
        with st.spinner("Updating Scoop..."):
            success, log = update_scoop()
        st.code(log, language="text", height=200)

    if col_b.button("⬆️ Update All Packages", type="primary", width="stretch", key="scoop_update_all"):
        with st.spinner("Updating all packages..."):
            success, log = update_all()
        st.session_state.scoop_installed_list = []
        st.code(log, language="text", height=200)

    if col_c.button("🧹 Cleanup Old Versions", width="stretch", key="scoop_cleanup"):
        with st.spinner("Running scoop cleanup..."):
            success, log = cleanup_scoop()
        st.code(log, language="text", height=200)

apply_footer()
