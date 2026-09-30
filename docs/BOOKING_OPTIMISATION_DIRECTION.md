# Exploratory Product Direction: From Call Handling to Booking Optimisation

> Status: **idea for team discussion, not a decided product direction**.
>
> This note assumes Call Hero is primarily an AI front-desk / booking operations product rather than a healthcare decision-support system.

## 1. Core idea

Jade already handles calls one at a time. A possible next step is to let Jade understand more of the **booking context across the whole clinic**:

- current schedule and open slots;
- a caller's booking request and flexibility;
- preferred practitioner;
- preferred date / time window;
- whether the caller is already booked;
- whether they asked for a waiting list or callback;
- previous unsuccessful booking attempts;
- cancellations and newly opened slots.

The shift is:

**call-level automation -> system-level booking intelligence**

Instead of only asking:

> "What does this caller want?"

we also ask:

> "Given all callers and the current schedule, what is the best next booking action?"

## 2. Example

Suppose the weekend contains:

    Friday:
    Grace wants Monday morning -> no availability

    Saturday:
    David wants Monday -> no availability

    Sunday:
    Sarah cancels Monday 9:00

A call-by-call system sees three separate events.

A system-level layer can connect them on Monday morning:

    Monday 9:00 slot opened

    Potential recovery candidates:
    1. Grace — asked twice for Monday morning, flexible practitioner
    2. David — wants Monday, but only after 3 pm

The owner does not need to rediscover this manually.

## 3. Proposed architecture

    Patient call
        |
        v
    Jade / LLM
    understands natural language
        |
        v
    Structured booking context
    - intent
    - preferred day/time
    - practitioner preference
    - flexibility
    - booking status
    - waiting-list / callback request
        |
        v
    Clinic scheduling state
    - open slots
    - cancellations
    - practitioner availability
    - existing bookings
        |
        v
    Decision / optimisation layer
        |
        v
    Recommended next action
        |
        +--> offer a slot
        +--> keep on waiting list
        +--> request human follow-up
        +--> no action needed

The LLM is useful for converting conversation into structured preferences. It does **not** need to solve the allocation problem itself.

## 4. Scheduling as an optimisation problem

For patient i and slot j, define a binary decision variable x_ij that is 1 when patient i is assigned to slot j and 0 otherwise.

A simple objective is to maximise total patient-slot compatibility:

**max sum(i,j) s_ij * x_ij**

where s_ij is a patient-slot compatibility score.

Possible score components:

- time preference fit;
- preferred practitioner fit;
- waiting time;
- repeat booking attempts;
- likelihood of conversion.

Subject to constraints such as:

- each slot can be offered / assigned to at most one patient;
- each patient can receive at most one assignment;
- patient availability must match the slot;
- practitioner / appointment type must be compatible;
- slot duration must be sufficient;
- patients already resolved should not be re-targeted.

For the hackathon prototype, this does **not** need to become a full production solver. A transparent compatibility score and ranked candidate list may be enough to prove the product concept.

## 5. Why this matters for the Monday Morning Screen

The dashboard could evolve from a call summary into a **booking control tower**.

Instead of:

    31 calls
    3 cancellations
    5 no-availability calls

show:

    TODAY'S BOOKING OPPORTUNITIES

    9:00 AM slot opened
    2 previous callers may fit

    Best candidate:
    Grace Scott
    - requested Monday morning twice
    - flexible practitioner
    - currently unbooked

    [Review and offer slot]

This connects events across the weekend and converts raw activity into a specific action.

## 6. Product framing

Possible framing for the presentation:

> **Jade handles each booking conversation. We want Jade to understand the whole booking system.**

or:

> **Don't just answer every call. Close every booking loop.**

The value is not more call analytics. It is reducing lost booking opportunities and improving schedule utilisation.

## 7. Important distinction

This direction should stay focused on **administrative booking context**, not clinical reasoning.

Useful inputs:
- requested time;
- practitioner preference;
- flexibility;
- booking status;
- waiting-list status;
- cancellation / availability state.

Not required:
- symptoms;
- diagnosis;
- medical urgency scoring;
- treatment recommendations.

## 8. What we should validate with the founders

Before building this deeply, ask:

1. What booking context can Jade already read today?
2. Does Jade currently reason across multiple calls / callers, or only within one conversation?
3. Can Jade see cancellations and schedule changes after an earlier caller failed to book?
4. Does Call Hero already maintain a waiting-list / recovery workflow?
5. Is improving booking conversion or schedule utilisation a meaningful business metric for them?
6. Would they want the Monday screen to surface **recommended booking actions**, or only summarise what happened?

If the answer to these is "we already do this", this direction should be dropped quickly.

## 9. Smallest demoable version

For the hackathon, the smallest convincing prototype is:

1. parse weekend calls into structured booking preferences;
2. detect one newly opened slot;
3. rank unresolved callers against that slot;
4. show the best candidate and **why**;
5. let the owner mark the recommendation as reviewed / handled.

No live telephony or production database is required to demonstrate the idea.

## 10. Open team question

Should the Monday Morning Screen be primarily:

**A. Action-first dashboard**
- urgent operational items;
- booking recovery opportunities;
- schedule changes;
- Jade's completed work.

or

**B. Booking control tower**
- today's schedule as the main object;
- open slots and conflicts;
- unresolved callers ranked against those slots;
- action recommendations generated from the full weekend state.

Both satisfy the brief, but B is the more ambitious product extension.
