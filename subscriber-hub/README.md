# Subscriber Hub

Core subscriber database + API for managing subscriptions across multiple
newspapers from one shared system. This is the hub everything else
(customer self-serve portal, internal CS/admin tool, WordPress plugin,
Tecnavia SSO) talks to.

## Stack

- Node.js + TypeScript + Express
- PostgreSQL + Prisma ORM
- JWT auth for staff, API-key auth for service-to-service calls (WordPress, Tecnavia)

## Getting started

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL and secrets
npx prisma migrate dev --name init
npm run seed             # creates 3 sample papers, a test subscriber, and a bootstrap admin account
npm run dev              # starts the API on http://localhost:4000
```

The seed script prints a bootstrap admin email/password to the console
(override with `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` env vars).
Log in with `POST /api/auth/login`, then immediately call
`POST /api/auth/change-password` to replace that default password - there's
no other way to change it, and it's a known value from the seed script.

## Data model

See `prisma/schema.prisma`. Key entities:

- **Paper** - one of your 3 titles
- **Subscriber** - one person, one shared record across all papers they take
- **Subscription** - links a Subscriber to a Paper, with type
  (PRINT / DIGITAL / PRINT_DIGITAL), tier, status, and renewal date
- **Payment** - transaction log, tied to Authorize.net transaction IDs
- **DeliveryRoute** - route/sequence assignment for print subscriptions
- **StaffUser** - CS/admin logins

## API surface (v0)

| Route | Purpose |
|---|---|
| `POST /api/auth/login` | Staff login (email + password) → JWT |
| `GET /api/auth/me` | Confirm current token, see who's logged in |
| `POST /api/auth/staff` | Admin-only: create a new staff account |
| `POST /api/auth/change-password` | Logged-in staff member changes their own password |
| `POST /api/subscribers` | Sign up a new subscriber |
| `GET /api/subscribers/me/:id` | Subscriber views their own account (self-serve portal) |
| `GET /api/subscribers?q=` | Staff search (Customer Service lookup) |
| `PATCH /api/subscribers/:id` | Staff edits an account |
| `POST /api/subscriptions` | Create a subscription |
| `POST /api/subscriptions/:id/pause` `/resume` `/cancel` `/activate` | Lifecycle actions |
| `GET /api/entitlements?email=&paper=` | **The endpoint WordPress and Tecnavia call** to check paywall/e-reader access |
| `POST /api/payments/webhook/authorize-net` | Authorize.net webhook receiver |
| `GET /api/payments/subscriber/:id` | Billing history for the portal |
| `POST /api/delivery-routes` | Assign a subscription to a route |
| `GET /api/delivery-routes/:paperId/export` | CSV export of a route, sorted for carriers |
| `GET /api/reports/circulation` | Active subs per paper, by type |
| `GET /api/reports/revenue` | Revenue in a date range |
| `GET /api/reports/churn` | Cancellations in a date range |

## What's stubbed vs. real

This is the **hub scaffold** - the data model, CRUD, and entitlement logic
are functional. Three things are intentionally left as placeholders until
you're ready to wire them up (each needs real credentials/sandbox access
to build against):

1. **Authorize.net** - `src/routes/payments.ts` has a webhook receiver
   with placeholder event handling. Needs: CIM (customer profiles) for
   storing cards, ARB (recurring billing) for the renewal cycle, and
   signature verification on the webhook.
2. **Tecnavia SSO** - not yet started. Needs their SSO spec (likely a
   token handoff) to build the connector against `checkEntitlement()`.
3. **WordPress plugin** - not yet started. Will be a small PHP plugin
   that calls `GET /api/entitlements` with the API key and gates content
   based on the response.
4. **Renewal reminders/lapse job** - `src/services/renewalService.ts`
   has the query logic; needs a scheduler (cron, hosted scheduler) and
   an email/SMS provider wired in to actually send reminders.

Staff login, account creation, and password change are implemented
(`src/routes/auth.ts`) - the CS/admin tool has something to authenticate
against now.

## Suggested next steps

1. Get this running locally against a Postgres instance, run the seed
   script, and confirm you can log in and change the bootstrap password.
2. Wire up Authorize.net in sandbox mode (CIM + ARB) once you have credentials.
3. Build the two frontends (self-serve portal, CS/admin dashboard) against this API.
4. Build the WordPress plugin and Tecnavia connector once the hub is stable.
