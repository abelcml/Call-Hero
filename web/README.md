# Monday Morning Screen — web app (Next.js)

Live: https://ai-front-desk-black.vercel.app

Three linked views per `docs/MONDAY_MORNING_SCREEN_SPEC.md` §9–10: **Appointments · Staff actions · Call summaries**.

- Data: `data/weekend-calls.json` (official 31-call brief data)
- Logic: `lib/monday.ts` (pure, data-driven: ranking, potential cancellation openings, unresolved follow-ups, core-field checks, admin summaries)
- UI: `components/monday/`
- Clinical free text never reaches the browser: `app/page.tsx` replaces `summary` with an administrative summary server-side.
- `/jade` is an earlier AI triage prototype (DeepSeek); it needs `DEEPSEEK_API_KEY` in `.env.local`. The Monday screen needs no keys.
- Booking recovery is a demo recommendation only: it does not assign a caller to a slot, hold a booking, call anyone, or write to a clinic system. Staff must confirm patient preferences and live diary availability.

```bash
cd web && npm install && npm run dev   # http://localhost:3000
```

Run the focused recommendation regression checks with `node --test tests/monday.test.mjs`.
