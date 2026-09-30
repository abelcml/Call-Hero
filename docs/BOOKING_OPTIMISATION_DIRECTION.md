# Exploratory Product Direction: From Call Handling to Booking Optimisation

> Status: **idea for team discussion, not a decided product direction**.
>
> This note assumes Call Hero is primarily an AI front-desk / booking operations product rather than a healthcare decision-support system.

This direction is a possible action inside the **one-screen, 90-second Monday Morning Screen** brief. The current screen design keeps the booked-appointment list as its main area; booking recovery would appear as a reviewable action, not replace that agreed layout. The 31-call JSON shared in the project discussion and the repository's `data/weekend_calls.json` are different datasets. Examples below refer to the shared 31-call JSON; they are not claims about the current app's output.

## 1. Core idea

A possible next step is to connect booking information across calls and the clinic schedule. Whether Jade already does this is a question for Call Hero, not an established product gap. The proposed decision would use:

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

The shared 31-call JSON supports these observations:

- `c002`: Sarah cancelled an appointment described as Monday 9:00; `c023` shows that she later booked a different date. Her rebooking closes her own callback need, but does not establish whether the original slot is now available in the live calendar.
- `c007`: David wanted an appointment in the coming week, found nothing suitable, and said he would try elsewhere. His exact available times and current booking status are unknown.
- `c024` and `c026`: Grace tried twice for an appointment before month-end, found nothing suitable, and asked about a waiting list. Her exact days, times, practitioner flexibility, and notice requirement are unknown.
- `c011`, `c013`, and `c017`: Chris tried twice without success, then booked. He should not remain in an unresolved booking queue.

This creates a useful **review opportunity**: check whether Sarah's former slot is actually open, then ask whether David or Grace could take it. The source does not establish that either patient is eligible. It also labels `2026-11-17` as Monday although that ISO date is Tuesday, so the slot's date must be reconciled before any offer.

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

For a future system with verified patient preferences and a live schedule, patient-slot allocation could be formulated as an optimisation problem. For patient i and slot j, define a binary decision variable x_ij that is 1 when patient i is assigned to slot j and 0 otherwise.

A simple objective is to maximise total patient-slot compatibility:

**max sum(i,j) s_ij * x_ij**

where s_ij is a patient-slot compatibility score.

Possible score components **after hard eligibility checks**:

- time preference fit;
- preferred practitioner fit;
- waiting time;
- repeat booking attempts;
- likelihood of conversion, only if supported by an evaluated estimate.

Subject to constraints such as:

- each slot can be offered / assigned to at most one patient;
- each patient can receive at most one assignment;
- patient availability must match the slot;
- practitioner / appointment type must be compatible;
- slot duration must be sufficient;
- patients already resolved should not be re-targeted;
- the patient must have agreed to receive an offer through the selected channel, and the contact route must be usable.

An offer is not an assignment: sending an invitation, receiving acceptance, and recording a confirmed booking are distinct states. The supplied 31-call JSON lacks several hard-constraint inputs, so a numeric compatibility score or "best candidate" would imply unsupported precision. For this hackathon data, show possible contacts with explicit unknowns and let a person verify eligibility. A solver or ranked eligible list belongs to a later demo with those inputs present.

### Information Jade would need when no suitable booking is found

Ask only for information the booking system and conversation have not already supplied:

1. Whether the caller wants to receive cancellation offers, and through which contact channel.
2. The appointment type or booking requirement, if not already established.
3. Acceptable dates and time windows, including any firm exclusions.
4. Whether the requested practitioner is required or another suitable practitioner is acceptable.
5. Minimum notice needed to attend a newly opened slot.
6. Confirmation of the number or other contact route to use; a caller-ID number and an unconfirmed spoken callback number are different evidence.

Store unknown answers as unknown rather than treating them as flexible. The current 31-call JSON does not contain these structured answers, so this is a proposed future intake step, not a feature Jade is known to perform today.

## 5. Why this matters for the Monday Morning Screen

The Monday screen could surface a booking recovery action alongside its existing booked-appointment list and higher-priority work.

Instead of:

    31 calls
    3 cancellations
    5 no-availability calls

show:

    TODAY'S BOOKING OPPORTUNITIES

    9:00 AM cancellation recorded — calendar/date needs checking
    David: wanted an appointment this week; availability unknown
    Grace: requested a waiting list; availability unknown

    [Check slot and contact preferences]

This connects events across the weekend and gives the owner a specific next step without asserting a confirmed match.

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

1. link repeat calls and remove booking requests later resolved by a booking;
2. surface one cancellation as a **potential** opening, with its date/calendar uncertainty;
3. show David and Grace as possible contacts, with the missing eligibility information beside each;
4. let the owner review the slot and record a follow-up action; update the on-screen state after that action.

No live telephony or production database is required to demonstrate the idea.

## 10. Fit with the current screen design

The existing screen specification puts the **booked-appointment list** in the main area and reserves visible space for the most important human action. Booking recovery can occupy one such action after the urgent and unresolved items have been considered. A full booking control tower remains a separate product direction and should not silently replace the current one-screen design.
