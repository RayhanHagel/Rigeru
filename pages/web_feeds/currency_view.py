import streamlit as st
import pandas as pd
from utilities.util_currency import get_available_currencies, convert_currency, get_historical_trend
from utilities.util_persistent import apply_footer

st.header("💱 Currency Converter & Tracker")
st.markdown("Check real-time exchange rates, historical trends, and an extrapolated 7-day forecast.")

# Fetching currencies is cached and threaded, so it's non-blocking
with st.spinner("Initializing..."):
    success, currencies = get_available_currencies()

if not success:
    st.error(f"Failed to load currencies: {currencies}")
    st.stop()

currency_options = [f"{code} - {name}" for code, name in currencies.items()]
default_base_idx = next((i for i, c in enumerate(currency_options) if c.startswith('USD')), 0)
default_target_idx = next((i for i, c in enumerate(currency_options) if c.startswith('EUR')), 1)

with st.container(border=True):
    st.subheader("Conversion Calculator")

    col_amt, col_from, col_swap, col_to = st.columns([2, 3, 0.5, 3], vertical_alignment="bottom")

    amount = col_amt.number_input("Amount", min_value=0.0, value=1.0, step=1.0)
    base_selection = col_from.selectbox("From", currency_options, index=default_base_idx)

    col_swap.markdown(
        "<div style='text-align: center; font-size: 24px; padding-bottom: 5px;'>➡️</div>",
        unsafe_allow_html=True
    )

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

# --- Fragment for Lazy Loading ---
# This runs independently of the main thread UI, meaning the calculator 
# above paints instantly while this chart loads in the background.
@st.fragment
def render_historical_tracker(base_code, target_code):
    st.subheader(f"📈 30-Day Trend & 7-Day Forecast: {base_code} to {target_code}")

    if base_code == target_code:
        st.info("Select two different currencies to view a trend chart.")
        return

    with st.spinner("Calculating historical data & projections..."):
        trend_success, trend_data = get_historical_trend(base_code, target_code, days=30, forecast_days=7)

        if trend_success:
            try:
                import altair as alt

                # Format DataFrame for Altair
                df_plot = trend_data.reset_index()
                df_plot.columns = ["date", "rate", "type"]
                df_plot["date"] = pd.to_datetime(df_plot["date"])

                # Calculate Y-axis domain
                v_min, v_max = df_plot['rate'].min(), df_plot['rate'].max()
                margin = max((v_max - v_min) * 0.5, v_max * 0.02)
                y_min, y_max = v_min - margin, v_max + margin

                # Plot with conditional formatting for Extrapolation
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
                            alt.value([5, 5]),  # Dashed line for extrapolation
                            alt.value([0])      # Solid line for historical
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
                st.dataframe(trend_data) # Fallback
        else:
            st.warning(f"Could not load trend data: {trend_data}")

# Call the lazy-loaded fragment
render_historical_tracker(base_code, target_code)

apply_footer()