# REZA booking/conflict algorithm handoff

This document explains the end-to-end reservation algorithm used by REZA from the moment a client starts choosing a slot to the moment the booking is persisted.

The goal of this handoff is not to explain UI styling. It is to explain:

- the request flow,
- the payloads,
- the main backend algorithms,
- the conflict-resolution strategy,
- the meaning of the logs,
- and the exact data a visualization/debugging page should simulate.

The intended audience is another AI model or engineer building a standalone single-page visualizer/debugger for the booking algorithm.

---

## 1. Main files involved

Core public booking flow:

- `Backend/src/modules/public/public.controller.ts`
- `Backend/src/modules/public/schemas/public.schema.ts`
- `Backend/src/modules/public/services/booking.service.ts`
- `Backend/src/utils/schedulingValidation.ts`
- `Backend/src/modules/appointment/scheduling.service.ts`

Important frontend payload builders:

- `Mobile/reza_client_mobile/lib/screens/booking_screen.dart`
- `Mobile/reza_client_mobile/lib/services/discovery_service.dart`
- `Mobile/reza_client_mobile/lib/services/booking_service.dart`

---

## 2. High-level lifecycle

The booking lifecycle is split into 4 major stages:

1. The client asks: "Which dates / times are available?"
2. The client asks: "For this time, which employees are available?"
3. The client changes employee selections and the system resolves cross-participant conflicts.
4. The client submits the booking and the backend validates + persists it.

In practice, the public flow uses these endpoints:

- `GET/POST /api/public/tenant/:tenantId/available-slots`
- `GET /api/public/tenant/:tenantId/employee-availability`
- `POST /api/public/tenant/:tenantId/resolve-conflicts`
- `POST /api/public/bookings`

The same logical rules must hold across all 4 steps:

- employee skill compatibility,
- employee working hours,
- employee breaks,
- existing appointments,
- cross-participant same-employee overlap conflicts,
- and final race-condition revalidation before writing to DB.

---

## 3. Core business concept: participant, chain, interval

The algorithm thinks in 3 levels:

### 3.1 Participant

A participant is one person in the reservation:

- the booker,
- or an invited/family participant.

Each participant has:

- a start time,
- an ordered list of services,
- and either:
  - one employee for all services,
  - or one employee per service.

### 3.2 Service chain

If one participant books multiple services, the services are executed sequentially:

- Example:
  - `Épilation jambes` = 30 min
  - `Gommage argan` = 45 min
  - start = `09:00`
  - chain = `09:00-09:30`, then `09:30-10:15`

### 3.3 Interval

The real constraint solver operates on intervals.

If a participant is in:

- `sameEmployeeForAll = true`:
  - the participant may be modeled as one combined node spanning the total range.

- `sameEmployeeForAll = false` with `perServiceEmployeeIds`:
  - the participant is split into one interval node per service.

This distinction is critical and was the source of several earlier bugs.

---

## 4. Public payload shapes

### 4.1 Available slots payload

Single-participant:

```json
{
  "date": "2026-07-28",
  "serviceIds": ["svcA", "svcB"]
}
```

Multi-participant:

```json
{
  "date": "2026-07-28",
  "participants": [
    {
      "serviceIds": ["svcA", "svcB"],
      "startTime": "09:00"
    },
    {
      "serviceIds": ["svcC"],
      "startTime": "09:00"
    }
  ]
}
```

### 4.2 Employee availability payload

```http
GET /employee-availability?date=2026-07-28&startTime=09:00&serviceIds=svcA&serviceIds=svcB
```

### 4.3 Conflict-resolution payload

This is the important one.

```json
{
  "date": "2026-07-28",
  "changedParticipantIndex": 1,
  "selectedEmployeeId": "emp_sara",
  "participants": [
    {
      "index": 0,
      "serviceIds": ["svc_epilation", "svc_gommage"],
      "startTime": "09:00",
      "duration": 75,
      "currentEmployeeId": null,
      "sameEmployeeForAll": false,
      "perServiceEmployeeIds": {
        "svc_epilation": "emp_karim",
        "svc_gommage": "emp_sara"
      }
    },
    {
      "index": 1,
      "serviceIds": ["svc_massage"],
      "startTime": "09:00",
      "duration": 60,
      "currentEmployeeId": "emp_sara",
      "sameEmployeeForAll": true
    }
  ]
}
```

### 4.4 Final booking payload

This uses `serviceEmployees[]`, not `perServiceEmployeeIds`.

```json
{
  "tenantId": "tenant123",
  "firstName": "Omar",
  "lastName": "Client",
  "phone": "0600000000",
  "email": "omar@test.com",
  "serviceIds": ["svc_epilation", "svc_gommage"],
  "startTime": "2026-07-28T09:00:00.000Z",
  "employeeId": null,
  "serviceEmployees": [
    { "serviceId": "svc_epilation", "employeeId": "emp_karim" },
    { "serviceId": "svc_gommage", "employeeId": "emp_sara" }
  ],
  "participants": [
    {
      "name": "Invité 1",
      "serviceIds": ["svc_soin"],
      "startTime": "2026-07-28T09:00:00.000Z",
      "employeeId": "emp_hicham",
      "serviceEmployees": [
        { "serviceId": "svc_soin", "employeeId": "emp_hicham" }
      ]
    }
  ]
}
```

Important rule:

- `employeeId` is the aggregate participant-level employee.
- If a participant has multiple distinct per-service employees, aggregate `employeeId` must be `null`.
- In that case the truth lives in `serviceEmployees[]`.

---

## 5. Stage 1: available-slots algorithm

Implementation:

- `booking.service.ts -> getAvailableSlots()`
- `booking.service.ts -> loadFeasibilityContext()`
- `booking.service.ts -> isFeasible()`

### 5.1 Goal

Return only times where the whole requested reservation is actually feasible.

That means the algorithm does **not** simply check salon open hours.
It runs a constraint solver for every candidate slot.

### 5.2 Pre-filtering

`getAvailableSlots()` first rejects obvious impossible days:

- tenant not found,
- blocked dates,
- closed day,
- lead-time day filtering.

Then it generates candidate 30-minute slot starts between open and close.

### 5.3 Per-day context cache

`loadFeasibilityContext()` preloads data once for the whole day:

- active employees,
- each employee's skills,
- employee-to-user mapping,
- existing appointments for the day,
- occupied ranges,
- service durations,
- weekday index.

This is important because the API may evaluate many slots for the same day.

### 5.4 Feasibility solver model

`isFeasible()` converts each participant into ordered service intervals:

Example:

```text
Participant 0
  service A 09:00-09:30
  service B 09:30-10:15

Participant 1
  service C 09:00-09:50
```

For each interval, the algorithm computes `eligible[]` employees by checking:

1. employee active status,
2. employee skill for that service,
3. employee working day,
4. employee working hours,
5. employee breaks,
6. existing appointment overlap.

### 5.5 Backtracking

Then `isFeasible()` sorts intervals by lowest eligible count first:

```ts
const sorted = [...intervals].sort((a, b) => a.eligible.length - b.eligible.length);
```

This is the "most constrained first" heuristic.

Then it tries to assign an employee to each interval such that:

- the employee is eligible for that interval,
- and the same employee is not assigned to another overlapping interval.

Core overlap condition:

```ts
return a.startMinutes < b.endMinutes && a.endMinutes > b.startMinutes;
```

If every interval can be assigned, the slot is feasible.
If at least one interval cannot be assigned, the slot is removed from the UI.

### 5.6 Why this matters

This stage is the first line of defense.
It prevents impossible slots from being shown in the first place.

---

## 6. Stage 2: employee-availability algorithm

Implementation:

- `booking.service.ts -> getEmployeeAvailability()`
- `scheduling.service.ts -> planReservation()`

### 6.1 Goal

Given:

- one start time,
- one participant,
- one ordered service chain,

return:

- employee availability for each service,
- the "common employees" who can do all services,
- a recommended assignment.

### 6.2 planReservation()

This method walks the service chain sequentially:

```ts
let cursor = startMinutes;
for (const service of orderedServices) {
  const serviceEnd = cursor + service.duration;
  ...
  cursor = serviceEnd;
}
```

For each service interval, it builds an availability list per employee.

It checks:

- skill compatibility,
- employee status,
- working day,
- working hours,
- break overlap,
- existing appointment overlap.

### 6.3 Output semantics

The method returns something like:

```json
{
  "services": [
    {
      "serviceId": "svc_epilation",
      "serviceName": "Épilation jambes",
      "employees": [...]
    },
    {
      "serviceId": "svc_gommage",
      "serviceName": "Gommage argan",
      "employees": [...]
    }
  ]
}
```

Then `getEmployeeAvailability()` builds:

- `employees`: aggregate view,
- `commonEmployeeIds`: intersection across all services,
- `services`: per-service employee lists for the frontend.

### 6.4 Meaning of `commonEmployeeIds`

This is the set of employees who are available for **all** services in the bundle.

It is used to support the UI mode:

- `same employee for all services`

If `commonEmployeeIds` is empty, the frontend automatically disables that mode and switches the participant to per-service mode.

---

## 7. Stage 3: conflict-resolution algorithm

Implementation:

- `booking.service.ts -> resolveParticipantConflicts()`

This is the most important algorithm for the visualizer.

### 7.1 Goal

When one participant changes employee selection, determine whether:

- the current multi-participant configuration is still valid,
- another assignment can be found with minimal changes,
- or the configuration is impossible.

### 7.2 Conceptual phases

The solver is intentionally organized in 4 phases:

1. Build constraints
2. Lock the user's latest choice
3. Search while minimizing changes
4. Return structured success or conflict

### 7.3 Phase 1: build constraints

For each participant, the backend builds solver nodes.

Two modes exist:

#### Mode A: same employee for all services

One node for the whole chain:

```text
Participant 0
  services = [Épilation, Gommage]
  interval = 09:00-10:15
  employee must be qualified for BOTH services
```

#### Mode B: per-service mode

One node per service interval:

```text
Participant 0
  node 0 = Épilation 09:00-09:30
  node 1 = Gommage   09:30-10:15
```

This is the correct mode when:

```ts
sameEmployeeForAll === false && perServiceEmployeeIds exists
```

This split is what prevents the old bug:

- Karim for Épilation
- Sara for Gommage

must not be interpreted as:

- "find one single employee who can do both services"

### 7.4 Eligibility computation

Each node gets:

- `eligible[]`
- `ineligible` reason map

Per employee, the checks are:

1. active agenda status,
2. skill compatibility,
3. working day,
4. working hour bounds,
5. break overlap,
6. overlap with existing appointments.

### 7.5 Phase 2: lock user choice

The changed participant is treated specially.

If the user explicitly selected an employee, that becomes a hard lock:

```ts
assignments.push({
  index: singleFlatIdx,
  employeeId: explicitSelection,
  locked: true,
});
```

In per-service mode:

- each explicitly selected service employee can be locked per interval.

For unchanged participants:

- explicit per-service assignments may be seeded as `locked: false`
- meaning "keep if possible, but may move if needed"

This distinction is crucial:

- `locked: true` = hard user choice that the solver must respect
- `locked: false` = conservation hint

### 7.6 Seed-conflict release

One subtle but important bug fix was added here.

If seeded assignments already conflict with each other, the solver must not short-circuit as "everything assigned".

Example:

- P0 Gommage = Sara 09:30-10:15
- P1 Massage = Sara 09:00-10:00

That is invalid.

The solver detects overlap among pre-seeded assignments:

```ts
const seedConflicts = findOverlapConflicts(assignments);
```

If conflicts exist:

- keep only `locked: true` assignments,
- release `locked: false` seeds back to unassigned,
- let backtracking recompute them.

This avoids false `resolved: true` states.

### 7.7 Phase 3: search + minimize changes

The search again uses "most constrained first":

```ts
let unassigned = nodes
  .filter((n) => !assignedSet.has(n.index))
  .sort((a, b) => a.eligible.length - b.eligible.length);
```

Candidate order is designed to minimize churn:

1. current employee first,
2. then other eligible employees sorted by workload.

Core snippet:

```ts
if (node.currentEmployeeId && node.eligible.includes(node.currentEmployeeId)) {
  candidates.push(node.currentEmployeeId);
}

const rest = node.eligible
  .filter((eid) => !tried.has(eid))
  .sort((a, b) => (workloadMap.get(a) || 0) - (workloadMap.get(b) || 0));
```

Meaning:

- preserve existing assignments when possible,
- if change is required, prefer least loaded compatible employees.

### 7.8 computeConflicts()

When trying an employee on a node, the solver checks whether that employee is already assigned to an overlapping node:

```ts
function computeConflicts(node: SolverNode) {
  ...
  if (oStart < oEnd) {
    blocked.add(a.employeeId);
  }
}
```

That means the same employee cannot simultaneously serve two overlapping intervals.

### 7.9 Phase 4: output assembly

Assignments are grouped back by original participant.

Returned fields include:

- `index`
- `employeeId`
- `locked`
- `autoAssigned`
- `changedFromExplicit`
- `serviceIdx`
- `serviceId`

The output semantics are:

- `verrouillé` = hard-locked explicit user choice
- `conserve` = explicit previous choice kept unchanged
- `auto` = filled automatically because there was no explicit employee
- `réaffecté` = explicit prior employee was changed by the solver

### 7.10 Conflict result shape

On failure, the endpoint returns:

```json
{
  "resolved": false,
  "conflict": true,
  "message": "...",
  "conflictedParticipants": [
    {
      "index": 1,
      "employeeId": "emp_sara",
      "reason": "Sara Benali ne peut pas assurer ...",
      "conflictedWith": [...]
    }
  ],
  "assignments": [...]
}
```

This structured response is what the frontend uses to show per-participant banners instead of one global generic error.

---

## 8. Stage 4: final booking creation

Implementation:

- `booking.service.ts -> createBooking()`
- `schedulingValidation.ts -> validateAppointmentRules()`

### 8.1 Goal

Persist the booking only if the full configuration is still valid at the exact submission moment.

### 8.2 createBooking() flow

The function does this in order:

1. Parse payload with Zod schema
2. Load tenant
3. Check online booking enabled
4. Load/create/update booker client
5. Load services
6. Build normalized `resolved[]` participants
7. If multi-participant: run `resolveParticipantConflicts()`
8. Walk every service interval and auto-assign missing employees if needed
9. Validate every interval with `validateAppointmentRules()`
10. Re-run `isFeasible()` as race-condition guard
11. Create `bookingGroup`
12. Create `appointment`
13. Create `appointment.services[]`
14. Create `bookingParticipant`
15. Create notifications
16. Optional auto-confirm

### 8.3 Why the solver is called again here

Even if the UI already resolved conflicts, the backend must never trust the client.

So `createBooking()` rebuilds the same participant list and re-runs the solver.

This protects against:

- stale UI state,
- manual API calls,
- race conditions,
- and payload inconsistencies.

### 8.4 Per-service employee handling

One of the most important fixes is here:

- the booking payload may include `serviceEmployees[]`
- the solver may return per-service assignments
- the backend must merge those back into each participant

Then it recomputes aggregate `employeeId`:

- if all service employees are the same => aggregate employeeId is that employee
- if service employees differ => aggregate employeeId becomes `null`

This is correct because the truth is then stored at the service-item level.

### 8.5 Interval validation

`createBooking()` walks the service chain interval by interval:

```ts
let intervalCursor = new Date(p.startTime.getTime());
for (let si = 0; si < p.services.length; si++) {
  const svc = p.services[si];
  const intervalStart = new Date(intervalCursor.getTime());
  const intervalEnd = new Date(intervalStart.getTime() + svc.duration * 60000);
  ...
  intervalCursor = intervalEnd;
}
```

For each interval:

- if employee missing => `resolveAnyone()` for that service only
- then `validateAppointmentRules()` is called with exactly one service

This is very important.

Correct:

```ts
validateAppointmentRules({
  employeeId: se.userEmployeeId,
  serviceIds: [svc.id],
  startTime: intervalStart,
  endTime: intervalEnd,
  isPublicBooking: true,
});
```

Incorrect legacy behavior that caused bugs:

```ts
validateAppointmentRules({
  employeeId: participant.userEmployeeId,
  serviceIds: participant.serviceIds,
  ...
});
```

The incorrect version falsely required one employee to be qualified for all services even in per-service mode.

### 8.6 Race-condition revalidation

Before writing records, the backend groups participants by same start time and re-runs `isFeasible()`.

Purpose:

- if another client booked the same employee in the meantime,
- reject this booking with:
  - `409 Slot no longer available`

This prevents "slot looked available but became unavailable milliseconds later" issues.

### 8.7 Final persistence model

The appointment is created like this:

- top-level appointment row:
  - `employeeId = null` when per-service employee mode is used
- appointment service items:
  - each service item gets its own `employeeId`

This is exactly what allows one participant to have:

- Karim on service 1
- Sara on service 2

inside one appointment chain.

---

## 9. validateAppointmentRules() explained

Implementation:

- `Backend/src/utils/schedulingValidation.ts`

This is the strict validation gate.

Checks, in order:

1. end > start
2. public booking not in the past
3. blocked dates
4. lead time
5. tenant business hours
6. employee specified
7. employee exists
8. employee active status
9. employee working hours + day off + breaks
10. service compatibility
11. overlap with existing appointments

Important note:

Lead time currently behaves differently in two places:

- slot listing logic behaves more like a calendar-day gate,
- `validateAppointmentRules()` behaves like exact rolling time.

This inconsistency is a known point to keep in mind for the visualizer.

---

## 10. Example scenarios

### 10.1 Valid per-service multi-user scenario

Input:

- Participant 0:
  - `Épilation jambes` 09:00-09:30 => Karim
  - `Gommage argan` 09:30-10:15 => Sara
- Participant 1:
  - `Soin visage premium` 09:00-09:50 => Hicham

Result:

- No overlap
- Solver returns `resolved: true`
- Booking is valid

### 10.2 Conflict on same employee overlap

Input:

- Participant 0:
  - `Gommage argan` 09:30-10:15 => Sara
- Participant 1:
  - `Massage relaxant` 09:00-10:00 => Sara

Overlap:

- same employee
- time intersection = `09:30-10:00`

Result:

- conflict banner,
- or automatic reassignment if another valid employee exists.

### 10.3 No eligible employee for one interval

Input:

- Participant 0:
  - `Épilation jambes` 09:00-09:30
- only Karim is qualified
- Karim is already hard-locked on another overlapping participant interval

Result:

- interval eligible count becomes effectively zero in search
- solver returns impossible
- `conflictedParticipants[]` points to the participant/service that cannot be satisfied

### 10.4 sameEmployeeForAll validation failure

Input:

- Participant 0 has 2 services
- user turns on "same employee for all"
- selects Nadia
- Nadia is qualified only for one of the two services

Result:

Immediate validation failure before backtracking:

```text
Nadia Tazi ne peut pas assurer Épilation jambes + Gommage argan ...
```

---

## 11. What the visualizer should model

If another AI builds a single-page visualization/debug tool, the minimum useful state is:

### 11.1 Inputs

- date
- tenant open/closed hours
- bookingDelay
- employee list
- employee skills
- employee working hours
- employee breaks
- existing appointments
- participants
- ordered services per participant
- durations per service
- sameEmployeeForAll flag per participant
- perServiceEmployeeIds
- changed participant index
- selected employee id

### 11.2 Derived views

- candidate slots
- per-slot feasibility
- per-participant service chains
- split intervals
- eligible employee list per interval
- ineligible reasons per employee per interval
- locked assignments
- conservation assignments
- backtracking order
- candidate order tried
- blocked employees because of overlap
- final assignments
- conflict banners payload

### 11.3 Useful UI panels

1. Timeline view
2. Participants and service chains
3. Interval cards
4. Eligible/ineligible employee matrix
5. Locked vs auto vs reassigned legend
6. Backtracking trace
7. Final response JSON
8. Validation step trace

---

## 12. Suggested visualization states

The SPA should make these states visible:

### A. Slot search

For each candidate slot:

- show intervals generated,
- show eligible count per interval,
- show whether slot passed `isFeasible()`.

### B. Employee availability

For each service in a chain:

- show employees,
- availability,
- reason,
- recommendation.

### C. Conflict resolution

For each solver run:

- raw nodes,
- synthetic flat indices,
- locked assignments,
- conservation seeds,
- released seeds,
- backtracking steps,
- final assignments or conflict.

### D. Final booking validation

Show:

- normalized participants,
- per-interval validation,
- race-condition recheck,
- final DB write payload.

---

## 13. Important invariants

These must remain true across the system:

1. The same employee cannot be assigned to overlapping intervals.
2. A participant in per-service mode must be split into per-service intervals.
3. Aggregate participant `employeeId` may be null while service-level employees are valid.
4. `validateAppointmentRules()` must run per interval in per-service mode.
5. Available-slots and final booking must use the same constraint logic.
6. Frontend conflict banners must map to the original participant index, not flat solver index.
7. `locked: true` is not the same as `conserve`.

---

## 14. Common failure modes to test

The visualizer should make these very easy to reproduce:

1. Same employee overlap between 2 participants
2. sameEmployeeForAll selected on someone not qualified for all services
3. One interval has zero eligible employees
4. Existing appointment blocks the only compatible employee
5. Break overlap
6. Outside working hours
7. Closed day
8. Blocked date
9. Lead-time mismatch
10. Race condition between slot display and final submit

---

## 15. Minimal pseudocode summary

```text
available-slots(date, participants):
  preload day context
  for each candidate slot:
    build intervals
    compute eligible employees per interval
    backtrack to see if all intervals can be assigned
    if yes => slot is visible

employee-availability(date, start, services):
  split chain into service intervals
  compute employees per service
  return per-service employees + commonEmployeeIds

resolve-conflicts(date, changedParticipant, selectedEmployee, participants):
  build solver nodes
  lock latest explicit user choice
  seed unchanged explicit assignments as soft conservation hints
  if soft seeds already conflict, release them
  backtrack using:
    - most constrained node first
    - current employee first
    - least workload next
  if solved:
    return assignments with tags:
      verrouillé / conserve / auto / réaffecté
  else:
    return conflictedParticipants[] with precise reasons

create-booking(payload):
  parse payload
  normalize participants
  if multi-participant:
    rerun resolve-conflicts
  walk each service interval:
    auto-assign missing employee if needed
    validate interval
  rerun isFeasible as race-condition check
  persist bookingGroup + appointment + appointment service items
```

---

## 16. Final takeaway

The algorithm is not one single function.
It is a pipeline with a shared constraint model:

- slot filtering,
- employee availability,
- conflict solving,
- final validation,
- persistence.

The critical design choice is that the true constraint space is at the **service interval** level, not just participant level.

Any visualizer that models only "participant -> one employee" will miss the most important part of the system.
