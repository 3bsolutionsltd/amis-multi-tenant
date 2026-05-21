# 1. Overview

**AMIS** (Academic Management Information System) is a multi-tenant web application that manages the full student lifecycle at a Vocational Training Institution:

- Admissions
- Enrolment & registration
- Marks / assessments
- Fees & finance
- Clearance
- Alumni

## Why offline-first?

Most VTIs in the field operate with intermittent or no internet. AMIS therefore runs **entirely on a LAN server** by default. The same software also runs in the cloud if a VTI has reliable connectivity and prefers it.

| Mode | Where it runs | Who uses it |
|------|----------------|-------------|
| **Offline / on-prem** (primary) | A single in-house server on the institution LAN | All staff, on any laptop in the institution |
| **Cloud / VPS** (secondary) | Contabo, Hetzner, DigitalOcean, etc. | Staff and students over the public internet |
| **Hybrid** (roadmap) | Offline as source-of-truth, cloud as read-only mirror | Ministry reporting, alumni portal |

## What you get

- Four Docker containers (DB, API, Web, Migrator)
- A web UI accessible from any modern browser
- A single ZIP install kit you can carry on a USB stick
- One-command installer for both Linux and Windows

Continue to **[02 — Architecture](02-architecture.md)**.
