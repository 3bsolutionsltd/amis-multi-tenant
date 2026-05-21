# 7. First Login & Admin Setup

After the stack is running, AMIS still needs at least one **tenant** (the institution) and a **platform admin**.

## If 3B Solutions seeded your tenant

Use the credentials supplied on a separate sheet and skip to [§7.3 First-login checklist](#73-first-login-checklist).

## 7.1 Create the tenant manually

```bash
node scripts/provision-tenant.js \
    --name "Kyema Technical Institute" \
    --slug "kti" \
    --admin-email "admin@kti.ac.ug" \
    --admin-password "<temporary-strong-password>"
```

The script creates:
1. A row in `platform.tenants`.
2. A schema-level role for the tenant.
3. The first `admin` user.

## 7.2 Force a password change

The platform admin must change their password on first login. The reset link is sent by email if SMTP / Resend is configured (see `DEPLOY.md`), or shown on screen.

## 7.3 First-login checklist

Log in at `http://<server-IP>/login`, then complete in this order:

1. ✅ Change the admin password.
2. ✅ Create departments, programmes, intakes, courses.
3. ✅ Set up the academic calendar for the current year.
4. ✅ Create user accounts: `registrar`, `finance`, `hod`, `instructor`, `principal`, `dean`.
5. ✅ Import students via CSV — see the USER_MANUAL → "Bulk Student Import".
6. ✅ Publish a **config version** to lock the visible modules (Admissions, Enrolment, Marks, Fees, Clearance, Alumni).

> Until a config version is published, end users see "module not enabled" notices.
