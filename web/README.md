# Monday Morning Screen — web app (Next.js)

Live: https://ai-front-desk-black.vercel.app

Three linked views per `docs/MONDAY_MORNING_SCREEN_SPEC.md` §9–10: **Appointments · Staff actions · Call summaries**.

- Data: `data/weekend-calls.json` (official 31-call brief data)
- Logic: `lib/monday.ts` (pure, data-driven: ranking, open-slot matching, core-field checks, admin summaries)
- UI: `components/monday/`
- Clinical free text never reaches the browser: `app/page.tsx` replaces `summary` with an administrative summary server-side.
- `/jade` is an earlier AI triage prototype (DeepSeek); it needs `DEEPSEEK_API_KEY` in `.env.local`. The Monday screen needs no keys.

```bash
cd web && npm install && npm run dev   # http://localhost:3000
```
