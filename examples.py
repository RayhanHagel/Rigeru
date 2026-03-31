import streamlit as st
import pandas as pd


df = pd.DataFrame({
  'first column': [1, 2, 3, 4],
  'second column': [10, 20, 30, 40]
})

# https://docs.streamlit.io/develop/api-reference
# https://extras.streamlit.app

# NORMAL WRITE
st.write("This is a normal write")
st.write(df)


# INTERACTIVE TABLE
st.write("This is an interactive table")
st.dataframe(df.style.highlight_max(axis=0)) # can use style based on pandas.style


# STATIC TABLE
st.write("This is a static table")
st.table(df)


# SLIDER
st.write("This is a slider")
x = st.slider('x')
st.write(x, 'squared is', x * x)


# TEXT INPUT
st.write("This is a text input")
st.text_input("Your name", key="name")
st.session_state.name


# CHECKBOX
st.write("This is a checkbox")
check = st.checkbox("Show hidden text")
if check:
    st.write("This is hidden text")


# MORE ADVANCED CHECKBOX
is_checked = st.session_state.get("adv_checkbox", False)
checkbox_label = "Uncheck to hide" if is_checked else "Check to reveal"
check2 = st.sidebar.checkbox(checkbox_label, key="adv_checkbox")
if check2:
    st.sidebar.write("The checkbox is checked.")
    
    
# SELECT BOX TABLE
selected_index = st.selectbox(
    'Which number do you like best?',
    df.melt()['value'].to_frame()
)
st.write("You selected the following row:", selected_index)


# COLUMNS ONE OBJECT
left_column, right_column = st.columns(2)
left_column.button('Press me!')


# COLUMNS WITH MULTIPLE OBJECTS
with right_column:
    chosen = st.radio(
        'Sorting hat',
        ("Gryffindor", "Ravenclaw", "Hufflepuff", "Slytherin"))
    st.write(f"You are in {chosen} house!")
    
    
# PROGRESS BAR
import time
st.write("This is a progress bar")
left2_column, right2_column = st.columns(2)
latest_iteration = left2_column.empty()
bar = right2_column.progress(0)

for i in range(100):
    latest_iteration.text(f'Iteration {i+1}')
    bar.progress(i + 1)
    time.sleep(0.1)

