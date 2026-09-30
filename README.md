# Call Hero — Monday Morning Screen

Hackathon prototype for the **Monday Morning Screen** challenge.

## Brief

Harbourside Dental closed at 5 pm Friday. Over the weekend, **31 calls** came in and Jade answered every one. At 8:00 am Monday, the practice owner has **90 seconds** before the first patient arrives.

The product question is not "what happened on every call?" It is:

> **What does the owner need to know, and what does she need to do about it?**

## Product principle

The screen compresses 31 conversations into three layers:

1. **What happened?** — weekend summary.
2. **What needs attention now?** — prioritised action queue.
3. **What can wait?** — resolved / low-priority calls stay out of the owner's way.

The prototype deliberately separates **decision logic** from the UI so we can later replace the simple scoring rules with JEV / an LLM classifier without redesigning the dashboard.

## Run locally

```bash
pip install -r requirements.txt
streamlit run app.py
```

## Current structure

```
.
├── app.py
├── requirements.txt
├── data/
│   └── weekend_calls.json
└── src/
    └── prioritise.py
```

## Next build steps

- Replace synthetic calls with the official hackathon dataset.
- Validate the priority logic against Call Hero's actual Jade rules.
- Add structured AI classification (JEV / LLM) only where rules are insufficient.
- Add action persistence (Supabase) if useful for the live demo.
- Polish the single-screen hierarchy after we learn the judging criteria.
