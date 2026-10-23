# Step 38 manual demo

**Prerequisite:** Stop extra `next dev` / `next start` processes if `npm ci` fails with EPERM.

```powershell
cd C:\Users\ASUS\Desktop\InfraOS\InfraOS
npm run dev:web
```

Open **http://localhost:3000/login** (also `/si/login`, `/ta/login`).

## Checklist

1. Yellow banner states sign-in is **not live** until Step 39.
2. Tab through email, password, show/hide, submit — focus visible.
3. Submit empty form — inline validation.
4. Submit valid-shaped fields — generic **NOT LIVE** message (not success).
5. Resize to 320px — form remains usable; corridor panel hidden below 1024px.
6. Visit `/` — public landing unchanged (Manrope/Geist marketing shell).
7. Optional: set `NEXT_PUBLIC_AUTH_FIXTURE=1` in `.env.local` **does not** enable production success; use unit tests for fixture transport.

**Do not** claim an authenticated session from this step.
