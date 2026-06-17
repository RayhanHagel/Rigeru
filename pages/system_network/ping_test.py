import streamlit as st
import pandas as pd
import re
from utilities.util_ping import run_ping, check_all_dns_speeds, set_windows_dns, get_network_interfaces, DNS_PRESETS
from utilities.util_persistent import apply_footer

# --- Header ---
st.title(":material/network_check: Network Ping Test")
st.markdown(
    "Check the latency and reachability of a domain or IP address, or benchmark DNS servers. "
    "Use the tabs below to navigate between tools."
)
st.divider()

tab_ping, tab_dns = st.tabs([":material/terminal: Standard Ping", ":material/dns: DNS Speed Test & Changer"])

# ─────────────────────────────────────────────
# TAB 1 — Standard Ping
# ─────────────────────────────────────────────
with tab_ping:
    st.subheader("Target Reachability")
    
    with st.container(border=True):
        col1, col2 = st.columns([1, 2])
        
        with col1:
            # Removed the IPv6 preset
            ping_preset = st.selectbox(
                "Select Target", 
                ["Custom Target", "Google (8.8.8.8)", "Cloudflare (1.1.1.1)", "Quad9 (9.9.9.9)"],
                label_visibility="collapsed"
            )
        
        with col2:
            if ping_preset == "Custom Target":
                target_host = st.text_input(
                    "Target", 
                    placeholder="e.g., google.com or 192.168.1.1",
                    label_visibility="collapsed"
                )
            else:
                target_host = ping_preset.split("(")[1].strip(")")
                st.text_input("Target", value=target_host, disabled=True, label_visibility="collapsed")
        
        # Action Button
        if st.button(":material/speed: Ping Target", type="primary", width="stretch"):
            if target_host:
                with st.spinner(f"Pinging {target_host}..."):
                    success, result = run_ping(target_host, count=10)
                    
                st.markdown("### :material/bar_chart: Results")
                if success:
                    times_raw = re.findall(r'time[=<]([\d\.]+)\s*ms', result, re.IGNORECASE)
                    ttls_raw = re.findall(r'TTL=(\d+)', result, re.IGNORECASE)
                    packet_loss_match = re.search(r'(\d+)%\s*loss', result, re.IGNORECASE)
                    
                    if times_raw:
                        st.success("Ping successful! See summary and chart below:", icon=":material/check_circle:")
                        
                        times = [float(t) for t in times_raw]
                        avg_ping = sum(times) / len(times)
                        min_ping = min(times)
                        max_ping = max(times)
                        avg_ttl = int(sum(int(ttl) for ttl in ttls_raw) / len(ttls_raw)) if ttls_raw else "N/A"
                        packet_loss = f"{packet_loss_match.group(1)}%" if packet_loss_match else "0%"
                        
                        m1, m2, m3, m4, m5 = st.columns(5)
                        m1.metric("Avg Latency", f"{avg_ping:.1f} ms")
                        m2.metric("Min Latency", f"{min_ping:.1f} ms")
                        m3.metric("Max Latency", f"{max_ping:.1f} ms")
                        m4.metric("Average TTL", f"{avg_ttl}")
                        m5.metric("Packet Loss", f"{packet_loss}")
                        
                        st.divider()
                        
                        st.markdown("#### Latency per Sequence")
                        ping_data = pd.DataFrame({
                            "Ping Sequence": range(1, len(times) + 1),
                            "Latency (ms)": times
                        }).set_index("Ping Sequence")
                        
                        st.bar_chart(ping_data, y="Latency (ms)", width="stretch")
                    else:
                        st.info("Ping successful, but could not parse latency times for graphing.", icon=":material/info:")
                    
                    with st.expander(":material/terminal: View Raw Terminal Output"):
                        st.code(result, language="bash")
                        
                else:
                    st.error(f"Ping failed.\n\n{result}", icon=":material/error:")
            else:
                st.warning("Please enter a valid IP address or domain name.", icon=":material/warning:")

# ─────────────────────────────────────────────
# TAB 2 — DNS Speed Test
# ─────────────────────────────────────────────
with tab_dns:
    st.subheader("DNS Benchmark")
    st.markdown("Test the latency of popular DNS servers from your current network.")
    
    if st.button(":material/timer: Run DNS Benchmark", width="stretch"):
        with st.spinner("Pinging DNS servers..."):
            results = check_all_dns_speeds()
            
            # Filter out IPv6 data entirely
            df_data = []
            for name, data in results.items():
                df_data.append({
                    "DNS Provider": name, 
                    "Latency (ms)": data["ipv4"] if data["ipv4"] != float('inf') else None
                })
            
            st.session_state.dns_results = pd.DataFrame(df_data)
            st.toast("Benchmark complete!", icon=":material/check_circle:")
            
    if "dns_results" in st.session_state:
        df = st.session_state.dns_results
        
        # Filter out timeouts for the calculations and charts
        df_valid = df.dropna(subset=["Latency (ms)"])
        
        if not df_valid.empty:
            # Calculate metrics
            fastest_row = df_valid.loc[df_valid["Latency (ms)"].idxmin()]
            fastest_provider = fastest_row["DNS Provider"]
            fastest_ping = fastest_row["Latency (ms)"]
            avg_ping = df_valid["Latency (ms)"].mean()
            
            # Render Metrics
            st.success("Benchmark complete! Here is how the providers stack up from your network.", icon=":material/check_circle:")
            m1, m2, m3 = st.columns(3)
            m1.metric("Fastest Provider", fastest_provider)
            m2.metric("Best Latency", f"{fastest_ping:.1f} ms")
            m3.metric("Average Latency", f"{avg_ping:.1f} ms")
            
            st.divider()
            
            # Render Bar Chart
            st.markdown("#### Provider Comparison")
            chart_data = df_valid.set_index("DNS Provider")
            st.bar_chart(chart_data, y="Latency (ms)", width="stretch")
            
        # Render Data Table
        st.markdown("#### Raw Data")
        st.dataframe(
            df, 
            width="stretch", 
            hide_index=True,
            column_config={
                "Latency (ms)": st.column_config.NumberColumn(
                    "Latency (ms)",
                    help="Lower is better",
                    format="%.1f ms",
                )
            }
        )
        
    st.divider()
    st.subheader(":material/security: Apply Custom DNS (Windows Only)")
    st.markdown("Select a network adapter and a DNS provider to apply it to your system.")
    
    with st.form("apply_dns_form", border=True):
        col_adapter, col_provider = st.columns(2)
        
        interfaces = get_network_interfaces()
        adapter_name = col_adapter.selectbox(
            "Network Interface", 
            interfaces if interfaces else ["Wi-Fi", "Ethernet"]
        )
        
        provider_choices = list(DNS_PRESETS.keys()) + ["Custom"]
        provider_selection = col_provider.selectbox("Select DNS Provider", provider_choices)
        
        if provider_selection == "Custom":
            col_c1, col_c2 = st.columns(2)
            custom_primary = col_c1.text_input("Primary DNS", placeholder="1.1.1.1")
            custom_secondary = col_c2.text_input("Secondary DNS", placeholder="1.0.0.1")
        
        submitted = st.form_submit_button(
            ":material/save: Apply DNS Configuration (Requires Administrator Privilege)", 
            type="primary", 
            width="stretch"
        )
        
        if submitted:
            if provider_selection == "Custom":
                primary, secondary = custom_primary, custom_secondary
            else:
                primary = DNS_PRESETS[provider_selection]["primary"]
                secondary = DNS_PRESETS[provider_selection]["secondary"]
            
            if primary:
                with st.spinner(f"Applying {provider_selection} DNS to {adapter_name}..."):
                    dns_success, dns_msg = set_windows_dns(adapter_name, primary, secondary)
                    if dns_success:
                        st.success(dns_msg, icon=":material/check_circle:")
                    else:
                        st.error(dns_msg, icon=":material/error:")
            else:
                st.warning("Please provide at least a primary DNS IP address.", icon=":material/warning:")

apply_footer()