# Shopify Integration — Design

Date: 2026-08-22
Status: Approved, implementation pending

## Context

TWIF sells through two channels: the Shopify online store (ready-to-wear)
and the physical stores (bespoke, run through this OMS). The client's scope
document asks for these to be combined on one customer profile, without the
OMS ever writing back to Shopify.

Nothing exists in the codebase for this today beyond a single placeholder
field, `Customer.shopifyCustomerId`. This is new-subsystem work.

## Requirements (from the client's scope, relayed by the user)

1. Real-time, one-way sync: **Shopify → OMS only**. The OMS never pushes
   operational data (measurements, fabric, production status, payments,
   internal notes) back to Shopify.
2. When a customer is created or updated on Shopify, or an order is placed,
   the OMS receives it within seconds via webhook and creates/updates the
   matching customer profile.
3. On first connection, the OMS performs a one-time bulk import of existing
   Shopify customers. After that, only the real-time webhooks apply.
4. A customer's Shopify (RTW) order history and their bespoke/physical-store
   history must show together on one profile — never as two separate people.
5. Customers created/synced from Shopify default to the `New` category
   (already the default for any new `Customer` row — no special-casing
   needed).
6. A Shopify Sync panel, visible to Admin only, shows sync activity.
7. Out of scope for this build: pointing a subdomain at the OMS via the
   Shopify-hosted domain's DNS. That's a manual Railway + DNS-registrar
   step, not application code.

## Decisions made during design

- **Customer matching**: match on email first; if no email match, fall back
  to phone; otherwise create a new customer. Once matched, the customer's
  `shopifyCustomerId` is set, so later webhooks for that Shopify customer
  land on the same profile even if their email changes.
- **Order detail depth**: summary only — order number, date, total,
  currency, payment/fulfillment status, and a link back to Shopify. No
  line-item/product/variant sync.
- **Admin Sync panel**: read-only sync log + headline counts (customers
  linked, orders synced, last sync time). No manual re-sync button — sync
  is already real-time, and the one-time bulk import is a developer-run
  script, not a UI action.
- **Shopify app**: a single custom app ("tWIF Internal App"), built through
  Shopify's Dev Dashboard, installed only on the TWIF store. Confirmed
  during design that this requires a real OAuth install (not a static
  token) — the Dev Dashboard's "App automation token" (`atkn_...`) was
  tried and confirmed *not* valid against the Admin API (401). A proper
  `shpat_...` token only comes from completing the OAuth grant with the
  right scopes.

## Architecture

```
Shopify (webhooks) ──HMAC-signed POST──▶ /api/oms/shopify/webhooks/customers
                                          /api/oms/shopify/webhooks/orders
                                                    │
                                                    ▼
                                    verify signature → find-or-create Customer
                                                    → upsert ShopifyOrder (summary)
                                                    → log ShopifySyncEvent
```

Nothing in the write path calls out to Shopify. The only outbound call to
Shopify's API is the one-time bulk-import script (reads customers) and the
OAuth token exchange (one-time, at install).

### OAuth install (one-time setup, not a recurring flow)

```
GET /api/oms/shopify/install   → redirect to Shopify's authorize URL
                                  (scopes: read_customers, read_orders)
GET /api/oms/shopify/callback  → verify HMAC on query params
                                  → exchange code for access token
                                  → encrypt token (utils/encryption.js)
                                  → upsert into ShopifyStore
```

Requires the app's declared scopes to include `read_customers` and
`read_orders` (currently the installed app only requests "staff and
contributor data" — this needs updating in the app's Shopify config before
install completes with a usable token). This is configured in the app's
`shopify.app.toml` (or equivalent Dev Dashboard config) and deployed via
`shopify app deploy`, not set by hand in the admin UI.

Client ID and API secret (already provided, stored as
`SHOPIFY_CLIENT_ID` / `SHOPIFY_CLIENT_SECRET` env vars) are used for the
OAuth exchange and to verify the HMAC signature on both the OAuth callback
and every incoming webhook.

## Data model — three new tables

### `ShopifyStore`
One row per connected shop (in practice, one row total).
- `shopDomain` (e.g. `twifclothing.myshopify.com`)
- `accessTokenEncrypted` (via `utils/encryption.js`)
- `scopes`
- `installedAt`

### `ShopifyOrder`
- `customerId` (FK → Customer)
- `shopifyOrderId`, `orderNumber`
- `total`, `currency`
- `financialStatus` (paid / pending / refunded / etc.)
- `fulfillmentStatus`
- `placedAt`
- `shopifyAdminUrl`

Deliberately separate from `Invoice`/`SentInvoice` — Shopify (RTW) orders
must never enter the bespoke pipeline (order sheet, production, Accounts
approval). The customer profile queries both tables and merges them into
one timeline for display.

### `ShopifySyncEvent`
Audit log, and what the Admin Sync panel reads from.
- `type` (customer / order)
- `shopifyId`, `dedupeKey`
- `result` (success / error), `errorMessage`
- `payloadSummary`
- `createdAt`

The dedupe key makes duplicate webhook deliveries (Shopify retries on
timeout) safe to ignore rather than double-processing.

## Field mapping

| Shopify webhook | OMS action |
|---|---|
| `customers/create`, `customers/update` | Match/create `Customer` (email → phone → new). `first_name + last_name` → `fullName`, `email`, `phone`, `id` → `shopifyCustomerId`. New customers get `category: 'New'` (existing default). |
| `orders/create`, `orders/updated` | Upsert `ShopifyOrder` on the matched customer: `order_number`, `total_price`, `currency`, `financial_status`, `fulfillment_status`, `created_at`, `admin_graphql_api_id` → `shopifyAdminUrl`. |
| `orders/cancelled` | Update that order's `financialStatus`/`fulfillmentStatus` to reflect cancellation. |
| `refunds/create` | Update `financialStatus` to reflect the refund. |

Every webhook write is also logged to `ShopifySyncEvent` (success or
failure) regardless of the table it touches.

## Bulk import

A one-off script, `server/scripts/shopifyInitialImport.js`, matching the
existing convention (`seedTwifAdmin.js`, `seedTwifTestAccounts.js`). Pages
through `GET /admin/api/{version}/customers.json`, running the same
find-or-create matching logic as the webhook handler. Run once by hand
after the OAuth install completes.

## Admin Sync panel (frontend)

Admin-only nav item and page, reading:
- Recent `ShopifySyncEvent` rows (what synced, when, success/failure and
  why if failed)
- Headline counts: customers linked to Shopify, orders synced today/total,
  last successful sync time

Not visible to Store Manager or Production, per the scope.

## Explicitly out of scope

- Writing anything from the OMS back to Shopify.
- Product/variant/SKU/line-item sync — order summaries only.
- The subdomain/DNS work connecting `ops.<domain>` to Railway.
- Any UI to manually trigger a re-sync (the one-time import is a script,
  not a button).
