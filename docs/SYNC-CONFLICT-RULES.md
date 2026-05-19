# Sync Conflict Resolution Rules

This document describes how AMIS resolves conflicts that arise when offline
clients attempt to flush queued events to the server via `POST /sync/flush`.

## Strategy per Entity

| Entity | Strategy | Reason |
|---|---|---|
| **Marks** | Server-authoritative | Grading integrity; audited append-only log |
| **Fees** | Server-authoritative | Financial accuracy; requires finance officer sign-off |
| **Student profile fields** | Last-write-wins (by `clientTimestamp`) | Low-stakes edits; registrar can correct |
| **Admission status** | Reject offline changes | Workflow state machine is server-only |
| **Config (forms/nav)** | Reject; use draft→publish workflow | Config versioning already handles this |

---

## Marks

**Strategy**: Server-authoritative

If the server's `mark_entries.updated_at` timestamp is **newer** than the
client's `clientTimestamp`, the client edit is rejected and the server value
is returned so the client can display a diff.

**Conflict reason codes**

| Reason | Meaning |
|---|---|
| `server_version_newer` | Server has a more recent score; client edit dropped |
| `invalid_marks_payload` | Required fields (`submission_id`, `student_id`, `score`) missing |

**Response shape when conflicted**

```json
{
  "eventId": "<uuid>",
  "reason": "server_version_newer",
  "serverValue": { "score": 85, "updated_at": "2025-07-01T10:00:00Z" }
}
```

**Client UX**: Show a toast — _"Server value: 85 — your offline edit was not applied."_

---

## Student Profile Fields

**Strategy**: Last-write-wins by `clientTimestamp`

If the server record was updated **after** `clientTimestamp`, the client edit
is silently skipped (the server is already newer). If the client is newer or
equal, the whitelisted fields are applied.

**Allowed fields**: `first_name`, `last_name`, `other_names`, `date_of_birth`,
`gender`, `phone`, `email`, `guardian_name`, `guardian_phone`,
`guardian_email`, `year_of_study`.

**Conflict reason codes**

| Reason | Meaning |
|---|---|
| `delete_not_supported` | Client sent a delete operation — not permitted offline |

> **Note**: When the server is newer, the event is **skipped** (not counted as
> a conflict) and no conflict entry is returned to the client.

**Client UX on `applied`**: Show a confirmation — _"Your edit was accepted (last write wins)."_

---

## Config (Forms / Navigation)

**Strategy**: Always reject; use the draft→publish workflow.

Config changes must go through the Config Versions workflow (see
`db/migrations/20260407000006_config_versions.sql`). Offline config edits are
never accepted.

**Conflict reason code**: `config_immutable`

**Client UX**: Show a toast — _"Config changes must use the draft→publish workflow."_

---

## Fees

**Strategy**: Server-authoritative (same as Marks).

Fee records require a finance officer to sign off. Any offline changes to fee
records are rejected.

> **Note**: `fees` is not yet in the `entityType` enum of `POST /sync/flush`
> (`v1`). This rule documents the intended behaviour for `v2`.

**Client UX**: Show a toast — _"Server value retained — requires finance officer sign-off."_

---

## Admission Status

**Strategy**: Reject all offline changes.

Admission status is managed by a server-side state machine. Clients may not
change admission status offline.

> **Note**: Not yet in `entityType` enum. Documented for future implementation.

**Client UX**: Show a toast — _"Admission status can only be changed server-side."_

---

## API Response Shape

`POST /sync/flush` returns:

```json
{
  "applied": 3,
  "skipped": 1,
  "conflicts": [
    {
      "eventId": "...",
      "reason": "server_version_newer",
      "serverValue": { "score": 85, "updated_at": "2025-07-01T10:00:00Z" }
    }
  ]
}
```

The `conflicts` array contains only the events that were **rejected**. The
client should iterate over `conflicts` and display an appropriate toast for
each entry using the `reason` field to choose the message.

---

## Client Integration

The web app maps conflict responses to user-facing messages via
`apps/web/src/lib/conflictMessages.ts` and renders them using
`apps/web/src/components/SyncConflictToast.tsx`.

The outbox flush is triggered by `POST /sync/flush` called from the service
worker's `sync` event (tag: `outbox-flush`) or from the online event listener
in `useSyncQueue`.
