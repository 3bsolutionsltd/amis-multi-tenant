# 14. Support & Escalation

| Channel | Use for |
|---------|---------|
| **support@3bsolutions.co.ug** | All technical issues, bug reports, feature requests. |
| **security@3bsolutions.co.ug** | Suspected security vulnerabilities (private). |
| Phone (business hours) | Critical outages, install-day blockers. |
| GitHub Issues (if private access granted) | Engineering follow-up. |

## What to include in a ticket

1. Output of `./scripts/diagnostics.sh` (`diag-*.txt`).
2. AMIS version (UI footer, or `docker images | grep amis`).
3. Whether you are running **offline** or **cloud** mode.
4. Steps to reproduce.
5. What you expected vs. what happened.
6. Any recent changes (updates, network changes, hardware swaps).

## SLA

The SLA agreed in your institution's contract overrides anything written here. Typical response targets:

| Severity | Response | Resolution target |
|----------|----------|-------------------|
| P1 — System down, all users blocked | 1 business hour | 1 business day |
| P2 — Major feature broken | 4 business hours | 3 business days |
| P3 — Minor issue / cosmetic | 1 business day | Next release |
| P4 — Question / enhancement | 2 business days | Tracked on backlog |
