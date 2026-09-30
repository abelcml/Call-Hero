# Monday Morning Screen

## Demo design for the Call Hero Hackathon

## The problem

Harbourside Dental was closed over the weekend. Jade answered 31 calls while no staff were present. At 8:00 am, the practice owner has 90 seconds before the day starts to understand what happened and decide what needs attention.

The screen should not ask her to inspect 31 transcripts. It should turn those calls into a short, reliable action list.

Our design question is:

> What does the owner need to know now, and what does she need to do next?

## Product decision

We will build an action-first dashboard rather than an analytics dashboard or a call inbox.

The screen will answer three questions in order:

1. What needs attention now?
2. What changed in today's schedule?
3. What did Jade already resolve?

This prioritises decisions over call volume. The owner can still open the complete call list, but it is not the first thing she sees.

## What the source data shows

The supplied JSON contains 31 call records from 26 caller numbers. Several records belong to the same caller and should be read as one unfolding case rather than separate tasks.

- Chris Martin called three times after failing to find a suitable appointment. His third call ended in a successful booking.
- Sarah Johnson cancelled an appointment and later rebooked. Her case is resolved, although the original appointment slot remains open.
- Michael Brown called twice about the same disputed invoice. No callback is recorded and his sentiment worsened.
- Grace Scott called twice about availability. She remains unbooked and asked to join the waiting list.

Jade completed 12 bookings, including 7 new-patient bookings and 5 existing-patient bookings. Jade also answered 3 general clinic questions.

The proposed staff follow-up queue contains 7 caller cases:

| Priority | Caller | Why it appears | Proposed action |
| --- | --- | --- | --- |
| Urgent | Peter Young | Reported significant pain at 2:14 am and was flagged for Monday follow-up | Call now and send for clinical review |
| Immediate | Michael Brown | Called twice about a disputed invoice and has not received the promised callback | Assign to the practice manager and call |
| Opportunity | Grace Scott | Called twice, remains unbooked and requested the waiting list | Review against open appointments and call |
| Opportunity | David Miller | Could not find a suitable appointment and said he might try another clinic | Attempt recovery callback |
| Follow-up | James Anderson | Wanted a first appointment but supplied an invalid callback number | Try the incoming caller number |
| Follow-up | Rachel Lewis | Cancelled and explicitly requested help to rebook | Call to rebook |
| Follow-up | Daniel Clark | Jade promised a callback with an orthodontic referral | Provide referral callback |

This queue is a product decision derived from the supplied fields and summaries. It is not a clinical assessment.

## Important source-data issue

The narrative and ISO dates disagree about weekdays. For example, the source describes 17 November 2026 as Monday, but that calendar date is Tuesday. The same one-day mismatch appears in other appointment summaries.

For the hackathon demo, we will preserve the challenge narrative and show relative operational labels such as **Today at 9:00 am**. We will not calculate weekday names from the ISO dates or silently rewrite the supplied records.

## Screen hierarchy

### 1. Header

The header provides orientation, not analysis.

```text
Monday, 8:00 am
31 weekend calls · 26 callers · 7 need follow-up
```

### 2. Do these first

The main area contains three large cards. These are deliberately specific rather than generic categories.

#### Urgent patient concern

```text
Peter Young
Significant pain reported at 2:14 am.
Jade advised emergency care and flagged a Monday follow-up.

[Call Peter]  [Listen to recording]
```

The screen repeats what Jade recorded. It does not diagnose the patient or claim that the case is safe to wait.

#### Unresolved complaint

```text
Michael Brown
Two calls about a disputed invoice.
No callback recorded. Frustration is increasing.

[Call Michael]  [Assign to manager]
```

The two calls are combined into one case. The repeated call raises its position without creating duplicate work.

#### Today's schedule gap

```text
Today at 9:00 am · Dr Rebecca Foster
The original appointment was cancelled and later rebooked for another day.
This slot remains open.

Possible contacts: Grace Scott, David Miller
[Review candidates]  [Mark handled]
```

The candidates are suggestions for contact, not automatic matches. The source data does not establish that their treatment needs and availability fit this slot.

### 3. Next follow-ups

A compact list shows the remaining four cases:

```text
James Anderson  · Invalid callback number · Try incoming number
Rachel Lewis    · Rebooking requested      · Call to arrange
Daniel Clark    · Referral promised        · Provide referral
Grace or David  · Open-slot opportunity    · Review after priority calls
```

If Grace or David has already been handled through the open-slot card, that case disappears from this list rather than appearing twice.

### 4. Jade handled

Completed work is shown as a quiet summary below the action queue:

```text
12 appointments booked
3 clinic questions answered
1 repeat caller recovered and booked
```

This section demonstrates Jade's value without competing with unresolved work.

### 5. Full call history

A secondary **View all 31 calls** control opens the complete history. It is useful for audit and recordings but is not part of the 90-second reading path.

## Prioritisation rules

The demo uses a small, explicit rule set:

1. Patient-safety flags appear first.
2. Changes affecting today's schedule appear next.
3. Repeated complaints or unfulfilled callback promises are elevated.
4. Recoverable patients and ordinary follow-ups come after immediate work.
5. Completed bookings and answered questions are summarised, not placed in the action queue.
6. Calls from the same caller number are grouped before priority is calculated.
7. The interface never infers a diagnosis or represents a suggested appointment as confirmed.

These rules are deterministic for the prototype. The demo does not need an LLM to rank the supplied records.

## Data model for the prototype

The implementation should use the following concepts:

- `calls`: the 31 supplied call records.
- `callerCases`: records grouped by caller number and ordered by call time.
- `actionItems`: caller cases that still require a staff response.
- `priority`: one of `urgent`, `immediate`, `opportunity`, `follow_up` or `resolved`.
- `recommendedAction`: the next staff action displayed on a card.
- `todayImpacts`: schedule changes that affect the current clinic day.
- `resolvedSummary`: counts of work Jade completed without staff intervention.

The names describe the screen's responsibilities. They do not introduce a general workflow engine.

## Demo interaction

The prototype only needs three interactions:

1. Open a priority card to read the call summary and recording metadata.
2. Mark or assign an action, causing it to leave the immediate queue.
3. Open the full call list for audit.

The first version can keep state in the browser. A live voice agent, telephony, authentication and a production database are not required to prove the screen concept.

## Ninety-second demo script

1. Start with the headline: Jade answered 31 calls, but the owner does not need 31 notifications.
2. Point to Peter. Patient safety comes first, so this call is placed at the top with a direct callback action.
3. Point to the open 9:00 am slot. The screen connects a cancellation to potential recovery candidates but does not book anyone without confirmation.
4. Point to Michael. His two calls are grouped into one escalating complaint instead of two unrelated messages.
5. Close with the completed-work summary. Jade handled routine work and left a short queue that a human can act on.

The intended message is simple:

> Jade does not just answer weekend calls. By Monday morning, it turns them into the next decisions for the practice.

## Out of scope

The hackathon prototype will not include:

- a new voice assistant;
- Twilio, Vapi or Retell integration;
- automated diagnosis or treatment advice;
- automatic booking from suggested candidates;
- production authentication or permissions;
- a general analytics suite;
- a complete practice-management integration.

These features do not help validate whether the owner can understand and act on the weekend in 90 seconds.

## Success criteria

The demo succeeds if a viewer can determine, without opening the full call list:

1. who requires the first callback;
2. what changed in today's schedule;
3. which complaint is still unresolved;
4. how many bookings Jade completed;
5. what action to take from each priority card.

The test is comprehension, not feature count.
