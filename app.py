import json
from pathlib import Path

import pandas as pd
import streamlit as st

from src.prioritise import action_label, owner_visible, score_call


st.set_page_config(
    page_title="Call Hero — Monday Morning",
    page_icon="☎️",
    layout="wide",
)

DATA_PATH = Path(__file__).parent / "data" / "weekend_calls.json"


@st.cache_data
def load_calls():
    with DATA_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


calls = load_calls()
for call in calls:
    call["score"] = score_call(call)
    call["action"] = action_label(call)

total = len(calls)
resolved = sum(c.get("resolved", False) for c in calls)
needs_attention = sum(owner_visible(c) and not c.get("resolved", False) for c in calls)
urgent = sum(c.get("priority") == "urgent" and not c.get("resolved", False) for c in calls)
bookings = sum(c.get("outcome") == "booked" for c in calls)

st.title("Monday morning, in 90 seconds")
st.caption("Harbourside Dental · Weekend calls handled by Jade · 8:00 am Monday")

c1, c2, c3, c4 = st.columns(4)
c1.metric("Calls answered", total, help="Every weekend call was answered by Jade.")
c2.metric("Resolved by Jade", resolved)
c3.metric("Needs your attention", needs_attention)
c4.metric("Bookings secured", bookings)

if urgent:
    st.error(
        f"**{urgent} item(s) need immediate human review.** "
        "These are surfaced because Jade should not close the loop autonomously."
    )
else:
    st.success("No immediate human-review items detected.")

st.subheader("Do these first")

queue = sorted(
    [c for c in calls if owner_visible(c) and not c.get("resolved", False)],
    key=lambda c: c["score"],
    reverse=True,
)

if not queue:
    st.info("Nothing requires attention. Jade resolved the weekend queue.")
else:
    for i, call in enumerate(queue[:6], start=1):
        left, mid, right = st.columns([5, 2, 2])
        with left:
            priority = call.get("priority", "low").upper()
            st.markdown(
                f"**{i}. {call['caller_name']} · {call['intent']}**  \n"
                f"{call['summary']}  \n"
                f":gray[Priority: {priority} · {call.get('patient_status', 'unknown patient')}]"
            )
        with mid:
            st.markdown(f"**Next action**  \n{call['action']}")
        with right:
            key = f"done-{call['call_id']}"
            if st.button("Mark handled", key=key, use_container_width=True):
                st.toast(f"{call['caller_name']} marked handled for this demo session.")
        st.divider()

st.subheader("What happened over the weekend")

df = pd.DataFrame(calls)
intent_counts = (
    df.groupby("intent", dropna=False)
    .size()
    .sort_values(ascending=False)
    .rename("calls")
    .reset_index()
)

left, right = st.columns([1, 1.5])
with left:
    st.dataframe(intent_counts, hide_index=True, use_container_width=True)
with right:
    resolved_pct = round((resolved / total) * 100) if total else 0
    st.markdown(
        f"""
**Jade handled {resolved_pct}% of calls without Monday-morning work.**

- **{bookings}** calls ended in a confirmed booking.
- **{needs_attention}** unresolved calls were compressed into the action queue above.
- Low-value transcripts stay hidden unless the owner wants to drill down.
- The dashboard prioritises **actionability**, not call volume.
"""
    )

with st.expander("See all 31 calls"):
    visible_cols = [
        "caller_name",
        "intent",
        "priority",
        "outcome",
        "resolved",
        "suggested_action",
    ]
    st.dataframe(
        df[visible_cols].sort_values(["resolved", "priority"]),
        hide_index=True,
        use_container_width=True,
    )
