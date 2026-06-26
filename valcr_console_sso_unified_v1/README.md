# Valcr → Console unified authentication

This package removes Console's independent Google/password UI from the normal path. Valcr remains the identity owner and sends Console a 90-second, one-use handoff code.

## What is fixed

- `console.valcr.site` becomes a public landing/quickstart page when signed out.
- `Continue with Valcr` opens `valcr.site/login?next=console`.
- The Valcr frontend stores that destination through login, requests a one-time code, and returns the user to Console.
- Console exchanges the code and stores the normal Valcr JWT.
- Direct Console Google OAuth is no longer used, so `origin_mismatch` disappears from the normal flow.
- Console API URL normalization appends `/api/v1` when Vercel still contains `https://api.valcr.site`.
- Auth responses include the separate Data API plan/status.
- API-key creation derives tier and scopes from the paid Data API plan; clients cannot request Enterprise access.
- The legacy Data API rate limiter now awaits Redis and uses a fresh DB session for background usage increments.

## Backend

Set this in `~/valcr-backend/.env`:

```env
CONSOLE_FRONTEND_URL=https://console.valcr.site
```

Deploy:

```bash
unzip valcr_console_sso_unified_v1.zip
cd valcr_console_sso_unified_v1
chmod +x APPLY_BACKEND.sh
BACKEND_DIR=$HOME/valcr-backend ./APPLY_BACKEND.sh
```

No database migration is needed: `oauth_connection_states.provider` is `VARCHAR(16)` and `console` fits.

## Console frontend

Copy `console-frontend/src/` into the Console project's `src/`, preserving paths. The existing `AuthContext.jsx`, session helper, pages and Vercel rewrite stay in place. `Auth.jsx` may remain in the repository but is no longer imported by `App.jsx`.

```powershell
Copy-Item .\console-frontend\src\* C:\Users\NOMAD\PycharmProjects\valero\console-frontend\src -Recurse -Force
cd C:\Users\NOMAD\PycharmProjects\valero\console-frontend
npm run build
```

In Vercel, set `VITE_API_URL=https://api.valcr.site/api/v1` for Production, Preview and Development, then redeploy. The code also tolerates the old host-only value.

## Main Valcr frontend

Copy the three supplied files:

```powershell
Copy-Item .\valcr-frontend\src\api\consoleHandoff.ts .\src\api\consoleHandoff.ts -Force
Copy-Item .\valcr-frontend\src\components\ConsoleAuthBridge.tsx .\src\components\ConsoleAuthBridge.tsx -Force
Copy-Item .\valcr-frontend\src\components\Nav.tsx .\src\components\Nav.tsx -Force
```

In `src/App.tsx`, add:

```tsx
import { ConsoleAuthBridge } from '@/components/ConsoleAuthBridge'
```

Then render it immediately after `<ScrollToTop />`:

```tsx
<ScrollToTop />
<ConsoleAuthBridge />
<PageTracker />
```

Build and deploy Valcr.

## Verification

Backend route availability:

```bash
curl -i -X OPTIONS https://api.valcr.site/api/v1/auth/console-exchange \\
  -H 'Origin: https://console.valcr.site' \\
  -H 'Access-Control-Request-Method: POST' \\
  -H 'Access-Control-Request-Headers: content-type'
```

Authenticated handoff test, using a disposable Valcr JWT in your shell:

```bash
curl -sS -X POST https://api.valcr.site/api/v1/auth/console-handoff \\
  -H "Authorization: Bearer $VALCR_TOKEN"
```

Expected response contains `https://console.valcr.site/auth/callback?code=...`.

Browser flow:

1. Open `https://console.valcr.site` in a private window.
2. Click **Continue with Valcr**.
3. Sign in on Valcr, including Google if desired.
4. Confirm the browser returns to Console and opens `#overview`.
5. Refresh Console; the session should restore through `/api/v1/auth/me`.

## Important audit notes

The supplied Console `utils/api.js` now shares the normalized base URL, but several method names still do not match the supplied backend routes (`billing/plan` vs `billing/subscription`, and several usage/webhook helper signatures). This package deliberately does not rewrite those working pages without their exact current source. The SSO, auth restoration, API base, plan propagation and key security are complete; page-contract cleanup should be done against the actual current `Keys.jsx`, `Usage.jsx`, `Billing.jsx`, `Logs.jsx`, and `Webhooks.jsx` files.
