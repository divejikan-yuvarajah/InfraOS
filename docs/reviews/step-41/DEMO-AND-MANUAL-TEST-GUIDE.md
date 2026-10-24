# Step 41 manual test guide

Do not start the API against Atlas until the index proposal is approved. Development `autoIndex` can create indexes on startup.

## Isolated proof (already run)

```powershell
cd C:\Users\ASUS\Desktop\InfraOS\InfraOS
npm run test:api -- --run tests/password-reset-request.test.ts
```

That uses an in-memory MongoDB and an injected memory sender. It is not an inbox.

## Browser, after you accept the index risk or use a disposable database

```powershell
cd C:\Users\ASUS\Desktop\InfraOS\InfraOS
npm run dev:web
```

Open:

- http://localhost:3000/forgot-password
- http://localhost:3000/si/forgot-password
- http://localhost:3000/ta/forgot-password
- http://localhost:3000/login (Forgot password? link)

Submitting a valid email shows the same generic message for known and unknown addresses. The page must not display a token.

API, only when Atlas index creation is approved:

```powershell
npm run dev:api
```

```http
POST http://localhost:4000/api/v1/auth/forgot-password
Origin: http://localhost:3000
Content-Type: application/json

{"email":"person@example.com"}
```

Expect `200` and `data.status = ACCEPTED`. In production mode the sender is unavailable, so no message is delivered.

## Not available

Live email delivery. No provider, from-address, or API key is configured.
