import streamlit as st
import pandas as pd
from utilities.util_ping import run_ping, check_all_dns_speeds, set_windows_dns, get_network_interfaces, DNS_PRESETS
from utilities.util_persistent import apply_footer

st.header("🏓 Network Ping Test")
st.markdown("Check the latency and reachability of a domain or IP address, or benchmark DNS servers.")

tab_ping, tab_dns = st.tabs(["🏓 Standard Ping", "🌐 DNS Speed Test & Changer"])

# ─────────────────────────────────────────────
# TAB 1 — Standard Ping
# ─────────────────────────────────────────────
with tab_ping:
    with st.container(border=True):
        ping_preset = st.selectbox(
            "Select Target", 
            ["Custom Target", "Google (8.8.8.8)", "Cloudflare (1.1.1.1)", "Quad9 (9.9.9.9)", "Google IPv6 (2001:4860:4860::8888)"]
        )
        
        if ping_preset == "Custom Target":
            target_host = st.text_input(
                "Target (IP, Domain, or IPv6)", 
                placeholder="e.g., google.com, 192.168.1.1, or 2606:4700:4700::1111"
            )
        else:
            target_host = ping_preset.split("(")[1].strip(")")
        
        # Check if the target is IPv6
        is_ipv6 = ":" in target_host and "http" not in target_host
        
        if st.button("Ping Target", type="primary", width="stretch"):
            if target_host:
                with st.spinner(f"Pinging {target_host} (IPv6: {is_ipv6})..."):
                    success, result = run_ping(target_host, count=4, ipv6=is_ipv6)
                    
                    st.markdown("### Results")
                    if success:
                        st.code(result, language="text")
                    else:
                        st.error(result)
            else:
                st.warning("Please enter a valid IP address or domain name.")

# ─────────────────────────────────────────────
# TAB 2 — DNS Speed Test
# ─────────────────────────────────────────────
with tab_dns:
    st.markdown("Test the latency of popular DNS servers from your current network.")
    
    if st.button("🚀 Run DNS Benchmark", width="stretch"):
        with st.spinner("Pinging DNS servers (IPv4 & IPv6)..."):
            results = check_all_dns_speeds()
            
            # Convert dictionary to a formatted dataframe
            df_results = pd.DataFrame([
                {
                    "DNS Provider": name, 
                    "IPv4 Latency (ms)": data["ipv4"] if data["ipv4"] != float('inf') else "Timeout",
                    "IPv6 Latency (ms)": data["ipv6"] if data["ipv6"] != float('inf') else "Timeout"
                }
                for name, data in results.items()
            ])
            st.session_state.dns_results = df_results
            st.success("Benchmark complete!")
            
    if "dns_results" in st.session_state:
        st.dataframe(st.session_state.dns_results, width="stretch", hide_index=True)
        
        st.divider()
        st.subheader("Apply Custom DNS (Windows Only)")
        st.markdown("Select a network adapter and a DNS provider to apply it to your system.")
        
        with st.form("apply_dns_form"):
            col_adapter, col_provider = st.columns(2)
            
            # Automatically grab available interfaces using psutil
            interfaces = get_network_interfaces()
            adapter_name = col_adapter.selectbox("Network Interface", interfaces if interfaces else ["Wi-Fi", "Ethernet"])
            
            # Custom input added to the choices
            provider_choices = list(DNS_PRESETS.keys()) + ["Custom"]
            provider_selection = col_provider.selectbox("Select DNS Provider", provider_choices)
            
            if provider_selection == "Custom":
                col_c1, col_c2 = st.columns(2)
                custom_primary = col_c1.text_input("Primary DNS", placeholder="1.1.1.1")
                custom_secondary = col_c2.text_input("Secondary DNS", placeholder="1.0.0.1")
            
            if st.form_submit_button("🛡️ Apply DNS (Requires Administrator Privilege)", type="primary", width="stretch"):
                if provider_selection == "Custom":
                    primary = custom_primary
                    secondary = custom_secondary
                else:
                    primary = DNS_PRESETS[provider_selection]["primary"]
                    secondary = DNS_PRESETS[provider_selection]["secondary"]
                
                if primary:
                    with st.spinner("Applying DNS..."):
                        dns_success, dns_msg = set_windows_dns(adapter_name, primary, secondary)
                        if dns_success:
                            st.success(dns_msg)
                        else:
                            st.error(dns_msg)
                else:
                    st.warning("Please provide at least a primary DNS.")

apply_footer()