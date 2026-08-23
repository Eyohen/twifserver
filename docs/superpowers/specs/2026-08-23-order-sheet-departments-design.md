# Order Sheet Department Tables — Design

**Goal:** Let staff tag each order-sheet item with a department (Suit, Native,
Shirts, Agbada, Design, Pants), reveal that department's own construction/style
field set for that item, and block the order from reaching the tailor until
every field in the assigned department is filled — without touching the
existing body-measurement list, invoice, or the "one measurement per order
sheet" behavior already shipped.

## Background

The client's review doc specifies two separate systems that are easy to
confuse and were confused earlier in this project:

- **The measurement list** (Top/Bottom/Others) — flat body measurements,
  captured once per order sheet. Already built, already correct, **not
  touched by this work**.
- **The department tables** (Suit, Native, Shirts, Agbada, Design, Pants) —
  construction/style choices (fabric color, lapel style, collar type,
  embroidery type, etc.), specific to one order **item**, not the whole
  order. This is the genuinely unbuilt piece.

The two connect only through notes on the department tables that reference a
measurement (e.g. "final collar = neck measurement + 1.5\""), never by
sharing or filtering fields.

## Architecture

No new database table for order-sheet items: they already live as a JSON
array inside `SentInvoice.payload.orderSheet.items[]` (see
`server/routes/oms.routes.js:1760`, `POST /tracking/order-sheet`). Each item
gains two new keys in that same JSON: `department` (a key like `'suit'`) and
`departmentFields` (an object of that department's field values). No
migration needed for this part — it's additive JSON, matching how
`fabrics`, `designNotes`, and `styleImages` already work per item.

One new table IS needed: `Departments`, mirroring the `Store` model built
earlier this project (`server/models/store.js`,
`server/utils/storeDirectory.js`) — same shape, same cache-on-boot pattern,
same admin CRUD. This is what makes the department **list** (not its field
definitions — see Scope below) owner/admin-configurable, per the review
doc's "Owner/Admin should be able to add dept."

Each department's field **definitions** (which fields, in what order, which
are required) are a hardcoded constant in both repos — the same pattern
`MEASUREMENT_GROUPS` already uses in
`twif/src/pages/store-manager/MeasurementsPage.jsx:10-20`. The backend needs
its own copy of the same required-field list to enforce the mandatory-field
gate server-side (the codebase's existing rule: "a rule that only the
interface applies is a suggestion" —
`server/routes/oms.routes.js:1818-1820`).

## The six departments and their fields

Taken verbatim from the client's review doc. Every field is a plain text
input for this pass (see Scope — the doc names fields but never specifies
fixed choice-lists for any of them, so free text is the honest default
until the client confirms exact option sets). "Client Name" is auto-filled
from the order, not a real input. "Additional Information" is optional; every
other field is required.

**Suit** (`suit`) — Fabric Color, Suit Style, Gender, Lapel Fabric, Lapel
Style, Lapel Width, Pocket Style, Vent Style, Collar Type, SB/DB, Sleeve
Type, Hand Knitting, Button Style, Additional Information (optional).
Note shown under the field set: *"Final collar measurements should be plus
1.5\"/2\" to the actual measurement."*

**Native** (`native`) — Fabric Color, Neck Type, Length, Sleeve Type, Cuff
Type, Chest Pocket Style, Collar Type, Embroidery, Embroidery Type, Collar
Button, Twif Logo, Button Type, Lining Type, Collar Size, Long Sleeve Type,
Slit Type, Slit Lining Type, Side Pocket, Cap, Cap Style, Additional
Information (optional).
Notes: *"Chest pocket depth, 7\"."* · *"Chest pocket height should be plus
1.5\" to the width."* · *"Final neck measurements should be plus 1.5\" to
the actual measurement."*

**Shirts** (`shirts`) — Fabric Color, Gender, Button Hole Stand, Sleeve
Type, Long Sleeve Type, Cuff Style, Cuff Type, Collar, Collar Size,
Embroidery, Embroidery Type, Collar Thickness, Shirt End,
Beading/Embellishment, Button Type, Additional Information (optional).
Notes: *"Kids cuff must be button not cufflinks."* · *"Final collar
measurements should be plus 1.5\" to the actual measurement."*

**Agbada** (`agbada`) — Fabric Color, Agbada Style, Sleeve Type, Embroidery
Type, Sleeve Lining, Additional Information (optional).

**Design** (`design`) — Fabric Type, Fabric Color, Thread Color, Embroidery
Length, Danshiki, Trouser, Cap, Additional Information (optional).

**Pants** (`pants`) — Fabric Color, Pant Type, Gender, Pleats, Band Style,
Band Extension, Band Size, Beltless Type, Side Stripe, Back Pocket Style,
Additional Information (optional).
Note: *"Trousers for kids (age 0-13) must have elastic on the band at the
back."*

## UI flow

1. Staff fills in the order sheet's measurement list once, exactly as today
   — unchanged.
2. Staff adds an item (`twif/src/App.jsx:3301`, `addItem`) — unchanged.
3. Each item card (`twif/src/App.jsx:3691-3719`) gains a required
   **Department** select, inserted into the existing "Item / Garment / No.
   of Pieces / Delivery Date" grid. Options come from `GET /oms/departments`
   (active ones only), matching how the existing Fabric select already
   fetches live data.
4. Selecting a department reveals that department's field set immediately
   below, replacing nothing — the existing Fabric picker, design notes, and
   style-image fields stay exactly where they are for every department (they
   are per-item construction concerns too, not specific to any one
   department).
5. Before a department is chosen, the item shows a placeholder: "Select a
   department to enter its details."

## Validation gate

Extend `productionBlockReason` (`server/routes/oms.routes.js:1823-1850`) with
one more check, after the existing measurement check: for every item in
`orderSheet.items`, if it has no `department` assigned, or its assigned
department's required fields aren't all filled in `departmentFields`, block
with a message naming the specific item and department (e.g. *"Item 2 (Suit)
is missing: Lapel Style, Collar Type"*). This reuses the exact same gate
already wired into both the normal production-release path
(`oms.routes.js:1898-1901`) and the owner/admin override path
(`oms.routes.js:2110`) — no new call site needed, the override behavior
(owner/admin can push through anyway) applies here automatically too.

## Scope

**In scope:**
- The six departments above, exact fields, as free-text inputs.
- Per-item department tagging and dynamic field reveal.
- Server-side + client-side mandatory-field validation, wired into the
  existing production-release gate.
- Owner/Admin can add a new `Department` row (name + key) and mark existing
  ones active/inactive — mirrors the Store admin page exactly.

**Out of scope for this pass (ruling, with reasoning):**
- **Defining a new department's field set from the admin UI.** The review
  doc gives one throwaway line ("Owner/Admin should be able to add dept")
  with zero elaboration, against 12-22 precisely named fields per existing
  department. Building a generic field-definition editor (arbitrary fields,
  arbitrary input types) is a materially different, larger feature with no
  real spec behind it. Adding a *department* (name/key, active/inactive) is
  in scope; adding a *new field set* for it is not — a newly added
  department starts with an empty field list until this is revisited.
  Cost if wrong: an Owner who adds a 7th department gets one with no fields
  yet, which is honest (not silently broken) and cheap to extend later.
- **Fixed choice-lists (dropdowns) for individual fields** (e.g. Lapel Style
  as Notch/Peak/Shawl). The doc never specifies these for any field. Free
  text now, convertible to a dropdown per-field later once confirmed.
- **Anything on the invoice.** Confirmed with the client: none of this
  appears there.
- **Filtering the body-measurement list by department.** Confirmed this was
  a miscommunication in an earlier explanation — the measurement list is
  unrelated to department selection.

## Testing

No automated backend test framework in this codebase (existing project
convention) — verified with real runnable commands against the local dev
database, matching every other task in this project. Frontend verified with
`npm run verify` (existing e2e suite) plus live manual check of the
department-select → dynamic-fields → validation-block flow.
