# Monday Morning Screen

## Demo design for the Call Hero Hackathon

> Design direction: the **booked appointments list is the main content of the first screen**. The owner sees each name, phone field, appointment time, and any uncertainty or need for human review. Detailed business and data rules are in [`MONDAY_MORNING_SCREEN_SPEC.md`](../../MONDAY_MORNING_SCREEN_SPEC.md).

The prototype has three linked views: **Appointments / Staff actions / Call summaries**. The first view must independently answer the 90-second challenge; the other two provide processing details and existing administrative call content.

## The problem and the 90-second decision

Jade answered calls while Harbourside Dental was closed. At 8:00 am on Monday, the practice owner has 90 seconds to understand the effect on appointments and decide what staff should handle first. The deliverable is one usable screen, not a transcript inbox.

The first view answers, in order:

1. **Who is booked, how can we contact them, and when are they expected?**
2. **Which booking details are incomplete or contradictory?**
3. **What unresolved matter needs a person now, and what is the next action?**

A compact priority alert remains visible without replacing the appointment list. This lets a source-marked urgent case reach the owner immediately while keeping the booked schedule as the visual centre.

## Evidence and scope

The challenge brief says Jade captures a caller's name, phone, intent and whether an appointment was made. It does not capture or store symptoms, health information, Medicare numbers or other clinical details as ordinary data. If a caller volunteers clinical information, the screen may show a neutral practitioner-follow-up flag, but not the clinical text. The screen must remain useful on a phone, with missing information, and when recordings are unavailable. Front-desk staff and a patient nearby may see the screen.

For every call, check those four categories individually. If any is absent, show a `Data incomplete` marker and name the missing field. An explicit `not booked` result is present information, not a missing result. Missing information is a data issue; it becomes a staff follow-up only when it affects an unresolved matter or blocks an action. For example, a hang-up without a usable name can be flagged as incomplete without creating an automatic callback task.

The provided `weekend-calls.pdf` describes 31 call events. It is a source for regression examples, not a fixed input size. The repository's existing `data/weekend_calls.json` is a separate synthetic array and does not contain all fields shown in that PDF. The original JSON corresponding to the PDF has not been supplied in this repository. Counts shown in a demo must name the dataset from which they were calculated.

The brief allows a clickable prototype and does not require live telephony, a production database, or a Cliniko integration. Do not describe a prototype click as a real callback or an appointment written to Cliniko.

## First-screen layout

Use a dark background and one screen with a clear reading path. The text below is layout guidance, not a claim that the current app implements it.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Appointments / Staff actions / Call summaries                          │
│ Monday 08:00  ·  weekend calls: [calculated]  ·  data status: [status] │
│ FIRST ACTION: [reason] → [next step]                    [Open details] │
├──────────────────────────────────────────┬──────────────────────────────┤
│ BOOKED APPOINTMENTS                      │ NEEDS A PERSON               │
│ Name  | Phone  | Time  | Status          │ Priority · reason · action   │
│ ...   | ...    | ...   | Recorded        │ ...                          │
│ ...   | ...    | ...   | Verify time     │                              │
│ ...   | ...    | ...   | Human review    │ DATA TO CHECK                │
│                                          │ Missing · invalid · conflict │
├──────────────────────────────────────────┴──────────────────────────────┤
│ Jade handled [calculated]  ·  Other calls [Open history]               │
└─────────────────────────────────────────────────────────────────────────┘
```

The appointment table gets the largest area. Every booking row has distinct **name**, **phone**, **appointment date and time**, and **status** fields. If a value is missing, keep the row and put an explicit placeholder in that field. A source outcome of `booked` means “Jade recorded a booking”; it is not proof that a live calendar or clinic opening hours have been checked.

The top alert shows one concrete next action and its reason. The remaining work appears in a compact side list with an accurate remaining count and an accessible expansion path. No urgent item may disappear because the visible list has a row limit. On a narrow phone screen, show the top alert, then the appointment list, then the remaining tasks as stacked sections.

### Status language and colour

| Meaning | Suggested treatment | Required text |
| --- | --- | --- |
| Booking recorded, no known issue | Quiet neutral row | `Booked by Jade` or `Booking recorded` |
| Missing or contradictory data | Amber row marker | The exact field and reason, e.g. `Time missing` |
| Human action needed | Purple or blue marker | The staff action, e.g. `Verify booking` |
| Source explicitly marked urgent | Red priority marker | `Source marked urgent; practitioner review` |

Colour is never the only signal: add a word label and, where useful, an icon. Distinguish data quality from business priority. An urgent case with no usable callback number stays urgent and also shows `Contact blocked`.

The name and phone columns must be easy for staff to use without making private details large enough for someone at the counter to read casually. The exact default phone masking and reveal behaviour remains a team decision; the phone field must still be present and the complete usable number accessible to an authorised staff member. Do not place clinical free text in a row, tooltip, details panel, export, or error message. A `recording_available` flag alone is not a playable recording.

## How the screen gets its rows

Treat **call events**, **contact matters**, **appointments**, and **staff work items** as separate objects. Do not use the number of calls as the number of patients or the number of open tasks. Link repeated calls only when the identity and matter can be established from reliable fields; a shared number may belong to more than one person.

The processing order is:

1. Read the clinic configuration and call events; validate structure and preserve allowed source values and source IDs.
2. Check name, phone, intent, and booking result on every call; create a field-specific data issue for each missing category. Then mark other fields as known, missing, invalid, conflicting, or unverified. Do not invent a name, phone digit, appointment time, weekday, or clinician.
3. Link call events that concern the same matter and find its latest supported state. A later booking can close an earlier “no availability” reminder for that matter; it cannot close a separate complaint or practitioner-follow-up item.
4. Build one appointment row for each source booking. Show its validation status separately from the source outcome.
5. Build unresolved human work items, assign an explainable priority category, and show the reason and next action.
6. Record a staff action only when the prototype state actually changes. A phone-link click alone does not mean the caller was reached.

The demo rules must work for 0, 1, 31, or more calls. Unknown outcomes and partly damaged records remain visible as data issues instead of becoming “all handled”. Failed data loading must not render as an empty, fully resolved morning.

## Source-data checks that affect the demo

The PDF data includes 31 calls, 12 outcomes marked `booked`, and 26 distinct caller numbers. These are **call, outcome, and number counts**, not verified patient or live-calendar counts. Multiple calls from one contact may end in a booking, while another matter from that contact can remain open. A cancellation followed by a new booking can close the rebooking matter while leaving the cancelled slot as a separate **possible** schedule change.

For this demo, the team treats the source year as a fixture typo and uses **Friday 14 to Monday 17 November 2025** as the working calendar. This is a documented demo assumption, not an inference made by the product for future datasets. Any remaining booking outside configured hours still needs review. A cancelled time is not guaranteed to be available without a current calendar. A caller ID and an incomplete verbal callback number are different pieces of evidence; do not present either as a verified replacement for the other.

These examples test general rules. The UI must not hardcode an exact queue size, a fixed list of callers, or a presumed open slot.

## Prototype interactions

All three views share clickable navigation. A navigation tab opens its list or unselected state; a record-specific link also carries the selected appointment, work item, or call and its supported ID relationships.

1. **Appointments:** show the booked list, source and validation status, and first staff action. A row links to its staff-action details and related call summaries when a reliable relationship exists.
2. **Staff actions:** show the selected matter's reason, missing fields, action blockers and available operations. Mark it in progress or handled, or reopen it. Show links back to the appointment and related calls.
3. **Call summaries:** show source-supported administrative content and outcomes, including parking, insurance, fee questions and wrong-number calls. Already answered questions remain here without becoming new staff tasks. This view presents existing data; it does not invent dialogue or create a new conversation archive.

The related-record links must not guess identity from a shared phone number. With no reliable relationship, show an unavailable link and reason; ordinary view navigation stays usable. Returning preserves the original filter and selected record, and where supported the list position. A staff update refreshes the same matter's labels and counts across all three views; separate matters for the same contact stay open.

Administrative summaries must exclude clinical details and must not render raw mixed-content `summary` fields. With no usable administrative content, show that it was not provided. The workflow works without recordings; only offer playback when an authorised, actual audio resource is present. The PDF provides availability flags but no audio file or URL. If action state only survives the current session, say so.

## Ninety-second demo script

1. Start at the booked-appointments list: the owner can see who Jade recorded as booked, the contact field, the appointment time, and which rows need verification.
2. Show one incomplete or contradictory booking. The interface gives the exact reason rather than silently fixing the source.
3. Move to the top alert and explain why this human matter comes first and what the next action is, without disclosing clinical details.
4. Show a repeat caller grouped into one current matter, then mark a task in progress and show the changed count.
5. Close with Jade's completed-work summary and one sentence about what was intentionally left off the first screen.

This demonstrates Jade's value while making the owner's next action explicit. It does not imply that every call became a confirmed booking or that all staff work is done.

## Success criteria

Without opening the full call history, a viewer can identify a booked person's name, contact field and appointment time; distinguish a booking with no known issue from one requiring review; identify the first staff action and why it is first; and find the remaining unfinished work. The same flow remains usable on a phone and when fields or recordings are missing.

The three navigation entries and related-record links must actually switch to the correct view and record. Updating or reopening a matter must synchronise its status across views and returning must preserve the user's context.

The detailed acceptance cases, open business decisions, three-person responsibility split, and submission checklist live in [`MONDAY_MORNING_SCREEN_SPEC.md`](../../MONDAY_MORNING_SCREEN_SPEC.md). This document describes the intended demo screen; it does not claim that the current Streamlit app already provides these behaviours.
