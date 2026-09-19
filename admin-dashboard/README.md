# Subscriber Hub — CS/Admin Dashboard

Internal web tool for Customer Service and admin staff: look up subscribers,
adjust accounts, pause/resume/cancel subscriptions, export delivery routes,
and pull circulation/revenue/churn reports.

This is a separate app from the API - it talks to the Subscriber Hub API
over HTTP and has no direct database access.

## Stack

React + TypeScript + Vite, React Router for navigation. No UI kit - the
design is bespoke (see the "Design" section below), built with plain CSS
and CSS variables for theming.

## Getting started

```bash
npm install
cp .env.example .env    # point VITE_API_URL at your running API
npm run dev              # starts on http://localhost:5173
```

The Subscriber Hub API needs to be running (see the `subscriber-hub`
project) and seeded with at least a bootstrap admin account to log in with.

## Pages

| Route | Purpose |
|---|---|
| `/login` | Staff sign-in |
| `/subscribers` | Search subscribers by name, email, or phone |
| `/subscribers/:id` | View/edit an account, manage subscriptions, view billing history |
| `/delivery-routes` | Export a carrier route CSV per paper |
| `/reports` | Circulation, revenue, and churn |
| `/staff` | Admin-only: create new staff accounts |

## Design

Built around a "ledger" aesthetic appropriate to a newspaper company's
internal ops tool: hairline-rule tables instead of card grids, a serif
display face (Source Serif 4) for headers, tabular numerals so dates and
dollar amounts align in columns, and one accent color (a deep press-green)
reserved for primary actions. Tokens live in `src/styles/tokens.css` if you
want to adjust the palette or type.

## What's not wired up yet

- No password-reset flow for staff (only change-password while logged in)
- No pagination controls on the subscriber search results (the API
  supports `page`/`pageSize`, the UI doesn't expose them yet)
- No way to create a new subscription from the dashboard yet (only
  pause/resume/cancel on existing ones) - creating one currently requires
  a payment step via Authorize.net that isn't built yet, so this is
  blocked on that integration
- No date-range picker on the Reports page (revenue/churn currently show
  all-time totals; the API already accepts `from`/`to`)
- The billing-history endpoint is currently staff-only; it'll need
  subscriber-scoped auth once the self-serve portal exists
