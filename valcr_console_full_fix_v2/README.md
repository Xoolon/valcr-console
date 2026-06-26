# Valcr Console complete auth and billing fix

This package fixes the complete path:

- Console email/password authentication now sends a real Cloudflare Turnstile token.
- Google OAuth uses only the Vite client ID and reports popup errors properly.
- JWT restoration validates `/api/v1/auth/me` and adds Bearer tokens to the new Console billing calls.
- Main Valcr billing remains in `account_tier` and the original Paystack fields.
- Console/Data API billing uses separate `data_api_*` columns and endpoints.
- Console plan names and backend plan names are mapped consistently.
- Paystack returns are verified by the backend before activating a Data API plan.

## 1. Frontend files

Copy the contents of `frontend/` into:

```text
C:\Users\NOMAD\PycharmProjects\valero\console-frontend
```

The included `COPY_FRONTEND.ps1` does this automatically:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\COPY_FRONTEND.ps1
```

Then create the production environment file:

```powershell
cd C:\Users\NOMAD\PycharmProjects\valero\console-frontend
Copy-Item .env.production.example .env.production
notepad .env.production
```

Replace only this placeholder:

```text
VITE_TURNSTILE_SITE_KEY=REPLACE_WITH_CLOUDFLARE_TURNSTILE_SITE_KEY
```

Build:

```powershell
npm install
npm run build
```

Deploy the new `dist` directory to `console.valcr.site`.

## 2. Google OAuth configuration

In the Google Cloud project that owns this client ID, use an OAuth client of type **Web application**.

Authorized JavaScript origins must include these exact origins, without paths or trailing slashes:

```text
https://valcr.site
https://www.valcr.site
https://console.valcr.site
http://localhost:5173
http://127.0.0.1:5173
```

If the OAuth consent screen is in Testing mode, add the Google accounts used for testing under Test users. Rebuild the frontend after changing `VITE_GOOGLE_CLIENT_ID` because Vite injects it at build time.

Do not launch the app through a `file:///C:/...` URL. Use `npm run dev` locally.

## 3. Cloudflare Turnstile configuration

The Turnstile widget hostname list must contain:

```text
console.valcr.site
localhost
127.0.0.1
```

Put the public **site key** in the frontend env file. Put the matching **secret key** only in the backend environment:

```text
TURNSTILE_SECRET_KEY=...
```

## 4. Backend deployment

The backend replacement files are under `backend/`.

Upload/extract this package on the server, then run:

```bash
cd /path/to/valcr_console_full_fix_v2
BACKEND_DIR=$HOME/valcr-backend ./DEPLOY_BACKEND.sh
```

The deployment script:

1. Backs up every replaced backend file.
2. Copies the replacements.
3. Applies `backend/sql/001_separate_data_api_billing.sql`.
4. Compiles the Python code.
5. Restarts the `valcr` service.

Add these server environment variables before restarting if they are not already present:

```text
CONSOLE_FRONTEND_URL=https://console.valcr.site
TURNSTILE_SECRET_KEY=YOUR_REAL_SECRET_KEY
```

## 5. New backend endpoints

```text
GET  /api/v1/console/billing/subscription
POST /api/v1/console/billing/checkout
GET  /api/v1/console/billing/verify?reference=...
POST /api/v1/console/billing/cancel
```

All four require the same Valcr Bearer JWT used by the Console.

## 6. Quick verification

CORS preflight:

```powershell
curl.exe -i -X OPTIONS "https://api.valcr.site/api/v1/auth/login" `
  -H "Origin: https://console.valcr.site" `
  -H "Access-Control-Request-Method: POST" `
  -H "Access-Control-Request-Headers: content-type"
```

Health:

```powershell
curl.exe -s https://api.valcr.site/health
```

Browser checks on `https://console.valcr.site`:

```js
console.table({
  origin: window.location.origin,
  api: import.meta?.env?.VITE_API_URL,
})
```

The origin must be exactly `https://console.valcr.site`.

## Important

The package deliberately does not replace your existing `src/utils/api.js`, because the Keys, Logs, Usage, Endpoints and Webhooks pages may contain project-specific endpoint wrappers. Auth and Billing now use the new dedicated clients in `src/utils/authApi.js` and `src/utils/billingApi.js`, so those fixes do not break your other pages.
