import streamlit as st
import threading
import os
import time
from utilities.util_price_monitor import load_tracked_items, add_item, delete_item, refresh_all_prices

FLAG_FILE = "cache/refresh_done.flag"

def run_background_refresh():
    refresh_all_prices()
    with open(FLAG_FILE, "w") as f:
        f.write("done")

def toggle_state(key):
    st.session_state[key] = not st.session_state.get(key, False)

st.header(":material/monitoring: Price Drop Monitor")
st.markdown("Track product prices locally from Amazon, eBay, Shopee, Tokopedia, and Steam.")

with st.expander(":material/add: Add New Product to Track", expanded=False):
    with st.form("add_product_form", clear_on_submit=True):
        col_name, col_url = st.columns([1, 2])
        prod_name = col_name.text_input("Product Name", placeholder="e.g., Sony WH-1000XM5")
        prod_url = col_url.text_input("Product URL", placeholder="https://www.amazon.com/dp/...")
        
        if st.form_submit_button("Start Tracking", type="primary", width="stretch"):
            if not prod_name or not prod_url:
                st.warning("Please fill in both fields.")
            else:
                success, msg = add_item(prod_name, prod_url)
                if success:
                    st.success(msg)
                else:
                    st.error(msg)

st.divider()

col_title, col_btn = st.columns([3, 1], vertical_alignment="center")
col_title.subheader("Your Tracked Items")

if "is_refreshing" not in st.session_state:
    st.session_state.is_refreshing = False

if col_btn.button(":material/sync: Refresh All Prices", type="primary", width="stretch", disabled=st.session_state.is_refreshing):
    st.session_state.is_refreshing = True
    if os.path.exists(FLAG_FILE):
        os.remove(FLAG_FILE)
    
    thread = threading.Thread(target=run_background_refresh)
    thread.start()
    st.rerun()

if getattr(st.session_state, 'is_refreshing', False):
    if os.path.exists(FLAG_FILE):
        st.session_state.is_refreshing = False
        os.remove(FLAG_FILE)
        st.success(":material/check_circle: Refresh complete! Displaying updated prices.")
        time.sleep(2)
        st.rerun()
    else:
        st.info(":material/sync: Launching local stealth browser to check prices in the background... You can continue using the app.")
        if st.button(":material/refresh: Update View"):
            st.rerun()

items = load_tracked_items()

if not items:
    st.info("You aren't tracking any items yet. Add one above!")
else:
    processed_items = []
    for item in items:
        history = item.get('history', [])
        is_cheapest = False
        price_never_changed = False
        cheapest_val = None
        current_price = None

        if history:
            prices = [h['price'] for h in history]
            cheapest_val = min(prices)
            highest_val = max(prices)
            current_price = history[-1]['price']
            
            price_fluctuated = highest_val > cheapest_val
            if not price_fluctuated:
                price_never_changed = True
            if current_price <= cheapest_val and price_fluctuated:
                is_cheapest = True
                
        item['_current_price'] = current_price
        item['_cheapest_val'] = cheapest_val
        item['_is_cheapest'] = is_cheapest
        item['_price_never_changed'] = price_never_changed
        
        processed_items.append(item)

    search_query = st.text_input(":material/search: Search Tracked Products", placeholder="Type a product name...")
    
    col_filter, col_sort = st.columns(2)
    with col_filter:
        filter_option = st.selectbox(
            "Filter Category", 
            ["All Items", "Best Value Items :material/local_fire_department:", "No Price Change :material/remove:", "Other Items"]
        )
    with col_sort:
        sort_option = st.selectbox(
            "Sort By", 
            ["Date Added (Default)", "Current Price (Low to High)", "Current Price (High to Low)"]
        )
        
    if search_query:
        processed_items = [i for i in processed_items if search_query.lower() in i['name'].lower()]
        
    if filter_option == "Best Value Items :material/local_fire_department:":
        processed_items = [i for i in processed_items if i['_is_cheapest']]
    elif filter_option == "No Price Change :material/remove:":
        processed_items = [i for i in processed_items if i['_price_never_changed']]
    elif filter_option == "Other Items":
        processed_items = [i for i in processed_items if not i['_is_cheapest'] and not i['_price_never_changed'] and i['_current_price'] is not None]
        
    if sort_option == "Current Price (Low to High)":
        priced = [i for i in processed_items if i['_current_price'] is not None]
        unpriced = [i for i in processed_items if i['_current_price'] is None]
        priced.sort(key=lambda x: x['_current_price'])
        processed_items = priced + unpriced
        
    elif sort_option == "Current Price (High to Low)":
        priced = [i for i in processed_items if i['_current_price'] is not None]
        unpriced = [i for i in processed_items if i['_current_price'] is None]
        priced.sort(key=lambda x: x['_current_price'], reverse=True)
        processed_items = priced + unpriced

    st.write("") 

    if not processed_items:
        st.info("No items match your current search or filter settings.")
    else:
        for item in processed_items:
            history = item.get('history', [])
            current_price = item['_current_price']
            cheapest_val = item['_cheapest_val']
            is_cheapest = item['_is_cheapest']
            price_never_changed = item['_price_never_changed']

            graph_key = f"show_graph_{item['id']}"
            if graph_key not in st.session_state:
                st.session_state[graph_key] = False

            with st.container(border=True):
                
                if is_cheapest:
                    st.success(":material/local_fire_department: **Great News!** This item is currently at its lowest tracked price!")

                col_info, col_price, col_low, col_graph, col_del = st.columns([2, 1.5, 1.5, 1, 0.5], vertical_alignment="center")
                
                with col_info:
                    if is_cheapest:
                        title_icon = ":material/local_fire_department: "
                    elif price_never_changed and len(history) > 1:
                        title_icon = ":material/remove: "
                    else:
                        title_icon = ""
                        
                    st.markdown(f"**[{title_icon}{item['name']}]({item['url']})**")
                    domain = item['url'].split('/')[2] if '//' in item['url'] else "Unknown Platform"
                    st.caption(f"Platform: {domain}")
                    
                with col_price:
                    if not history:
                        st.warning("No price history yet.")
                    else:
                        latest = history[-1]
                        original_price = latest.get('original_price')
                        discount = latest.get('discount')
                        
                        delta = None
                        if len(history) > 1:
                            previous_price = history[-2]['price']
                            delta = current_price - previous_price
                            
                        st.metric(
                            label="Latest Price", 
                            value=f"{current_price:,.2f}", 
                            delta=f"{delta:,.2f}" if delta else None,
                            delta_color="inverse"
                        )
                        
                        if original_price:
                            disc_str = f" **({discount} OFF)**" if discount else ""
                            st.markdown(f"<span style='color:gray; font-size: 0.9em;'>~~{original_price:,.2f}~~</span>{disc_str}", unsafe_allow_html=True)
                
                with col_low:
                    if history and cheapest_val is not None:
                        if is_cheapest:
                             st.metric(label="All-Time Low", value=f"{cheapest_val:,.2f}", delta="Best Price", delta_color="normal")
                        elif price_never_changed:
                             st.metric(label="All-Time Low", value=f"{cheapest_val:,.2f}", delta="Constant", delta_color="off")
                        else:
                             diff = current_price - cheapest_val
                             pct_diff = (diff / cheapest_val) * 100 if cheapest_val > 0 else 0
                             st.metric(
                                 label="All-Time Low", 
                                 value=f"{cheapest_val:,.2f}", 
                                 delta=f"+{pct_diff:.1f}% more exp.",
                                 delta_color="inverse"
                             )
                
                with col_graph:
                    if history and len(history) > 1:
                        btn_label = ":material/trending_down: Hide Graph" if st.session_state[graph_key] else ":material/trending_up: View Graph"
                        st.button(
                            btn_label, 
                            key=f"btn_{item['id']}", 
                            on_click=toggle_state, 
                            args=(graph_key,), 
                            width="stretch"
                        )
                             
                with col_del:
                    if st.button(":material/delete:", key=f"del_{item['id']}", help="Stop tracking", width="stretch"):
                        delete_item(item['id'])
                        st.rerun()

                if history and len(history) > 1 and st.session_state[graph_key]:
                    st.divider()
                    import pandas as pd
                    df = pd.DataFrame(history)
                    df['date'] = pd.to_datetime(df['date'])
                    df.set_index('date', inplace=True)
                    st.line_chart(df['price'])