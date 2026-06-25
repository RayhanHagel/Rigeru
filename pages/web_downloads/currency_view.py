import streamlit as st
from utilities.util_currency import get_available_currencies, convert_currency, get_historical_trend

st.header(":material/currency_exchange: Currency Converter & Tracker")
st.markdown("Check real-time exchange rates, historical trends, and an extrapolated 7-day forecast.")

if "currencies_loaded" not in st.session_state:
    with st.spinner("Loading currency data..."):
        success, currencies = get_available_currencies()
        if success:
            st.session_state.currencies = currencies
            st.session_state.currencies_loaded = True
        else:
            st.error(f"Failed to load currencies: {currencies}")
            st.stop()
else:
    success = True
    currencies = st.session_state.currencies

currency_options = [f"{code} - {name}" for code, name in currencies.items()]
default_base_idx = next((i for i, c in enumerate(currency_options) if c.startswith('USD')), 0)
default_target_idx = next((i for i, c in enumerate(currency_options) if c.startswith('IDR')), 1)

with st.container(border=True):
    st.subheader("Conversion Calculator")

    col_amt, col_from, col_swap, col_to = st.columns([2, 3, 0.5, 3], vertical_alignment="bottom")

    amount = col_amt.number_input("Amount", min_value=0.0, value=1.0, step=1.0)
    base_selection = col_from.selectbox("From", currency_options, index=default_base_idx)

    col_swap.write(":material/arrow_forward:")

    target_selection = col_to.selectbox("To", currency_options, index=default_target_idx)

    base_code = base_selection.split(" - ")[0]
    target_code = target_selection.split(" - ")[0]

    if st.button("Convert", type="primary", width="stretch"):
        with st.spinner("Fetching latest rates..."):
            conv_success, result = convert_currency(amount, base_code, target_code)

            if conv_success:
                st.success(f"**{amount:,.2f} {base_code}** = **{result:,.2f} {target_code}**")
            else:
                st.error(result)

st.divider()

@st.fragment
def render_historical_tracker(base_code, target_code):
    st.subheader(f":material/trending_up: 30-Day Trend & 7-Day Forecast: {base_code} to {target_code}")

    if base_code == target_code:
        st.info("Select two different currencies to view a trend chart.")
        return

    with st.spinner("Loading historical data..."):
        # Unpack the new cached_time variable
        trend_success, trend_data, cached_time = get_historical_trend(base_code, target_code, days=30, forecast_days=7)

        if trend_success:
            # Display the cache information
            if cached_time != "Just now":
                st.caption(f":material/update: Displaying cached data from **{cached_time}**. Fetching latest data in background...")
            else:
                st.caption(":material/cloud_download: Displaying live data fetched just now.")

            try:
                import altair as alt
                import pandas as pd 

                df_plot = trend_data.reset_index()
                df_plot.columns = ["date", "rate", "type"]
                df_plot["date"] = pd.to_datetime(df_plot["date"])

                v_min, v_max = df_plot['rate'].min(), df_plot['rate'].max()
                margin = max((v_max - v_min) * 0.5, v_max * 0.02)
                y_min, y_max = v_min - margin, v_max + margin

                chart = (
                    alt.Chart(df_plot)
                    .mark_line(point=True)
                    .encode(
                        x=alt.X("date:T", title="Date"),
                        y=alt.Y("rate:Q", title=f"Rate ({base_code} → {target_code})", scale=alt.Scale(domain=[y_min, y_max])),
                        color=alt.Color(
                            "type:N", 
                            title="Data Type", 
                            scale=alt.Scale(domain=["Historical", "Extrapolation"], range=["#9b59b6", "#e74c3c"])
                        ),
                        strokeDash=alt.condition(
                            alt.datum.type == 'Extrapolation',
                            alt.value([5, 5]),
                            alt.value([0])
                        ),
                        tooltip=[
                            alt.Tooltip("date:T", title="Date"),
                            alt.Tooltip("rate:Q", title="Rate", format=",.4f"),
                            alt.Tooltip("type:N", title="Type"),
                        ],
                    )
                    .properties(height=320)
                )
                st.altair_chart(chart, width="stretch")

            except Exception as e:
                st.error(f"Chart rendering failed: {e}")
                st.dataframe(trend_data) 
        else:
            st.warning(f"Could not load trend data: {trend_data}")

render_historical_tracker(base_code, target_code)