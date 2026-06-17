# LittleLoop — How Everything Is Built

A feature-by-feature, decision-by-decision reference for defending this project under questions. Each section covers: what it does, exactly how it's implemented (files/functions), and why it was built that way.

---

## 1. The Core Loop & Data Model

The product models a garment's life as a sequence of **events**, not just a current state. Three tables (`backend/models.py`):

- **`Garment`** — one row per physical item. `id` (UUID, also the barcode payload), `sku`, `product_name`, `size`, `manufactured_at`, `current_condition_score`, `current_status` (`active | returned | resale`, plus unused `sanitizing | retired` placeholders), `price`, `thumbnail_url`.
- **`PassportCycle`** — an append-only event log per garment. `event_type` ∈ `manufactured | purchased | returned | inspected | sanitized`, a `cycle_number` ordinal, a `condition_score_at_event` snapshot, optional `notes`.
- **`Reward`** — issued against a specific cycle (FK to both `garment_id` and `cycle_id`), holds `reward_type` and `value`.

**Why event-sourced instead of just a status field:** the Digital Passport's whole pitch is *traceability* — proving to a parent that "this onesie has been worn by 2 families, cleaned once, saved 2,700L of water." A single mutable status can't reconstruct that story; an immutable cycle log can. `current_status`/`current_condition_score` on `Garment` are denormalized read-optimizations (so list/filter queries don't need to scan cycle history), kept in sync any time a cycle is appended.

**Database:** SQLite via SQLAlchemy (`backend/database.py`), file at `backend/littleloop.db`. Chosen for zero-setup local persistence — no separate DB server needed for a hackathon demo. `Base.metadata.create_all()` runs on app startup so the schema self-creates.

---

## 2. Garment Identity — Barcodes

**How it works:** `backend/seed.py` generates one barcode PNG per garment via the `qrcode` library, encoding nothing but the raw `garment.id` (UUID string) — `qrcode.make(garment.id)`. PNGs are written to `backend/static/barcode/<id>.png` and served statically by FastAPI's `StaticFiles` mount at `/static` (`backend/main.py:22-23`). The Passport screen displays it via `<img src="/static/barcode/{id}.png">` (`Passport.jsx:197`). Under the hood this is still a QR code (a 2D matrix barcode) — "barcode" is the user-facing term since that's the retail vocabulary parents and employees already know.

**Scanning:** both the Passport Scanner and Employee Trade-In screens use `html5-qrcode`'s `Html5Qrcode` class against the device camera (`facingMode: 'environment'`). On decode, `extractGarmentId()` (duplicated in both `PassportScanner.jsx` and `TradeIn.jsx`) regex-matches `passport/([^/?#]+)` so the barcode can encode either a bare ID or a full URL like `https://.../passport/<id>` — handles both today's raw-ID barcode and a future deep-link barcode without changing the scanner.

**Why a 2D barcode on a hang tag, not NFC/RFID:** cheapest, zero extra hardware, demoable instantly with a laptop camera. **Known limitation acknowledged in `CLAUDE.md`:** paper/printed tags don't survive repeated washing — a real production version would need a sewn-in durable tag (NFC or laser-etched). This is explicitly *not solved* here; it's flagged as a pitch talking point, not a bug.

---

## 3. Digital Garment Passport (the hero screen)

**Route:** `/passport/:id` → `frontend/src/pages/Passport.jsx`. Single `GET /garments/:id` call on mount.

**What it renders:**
- **Hero card** — product name, size, SKU, manufacture date, a `current_status` pill, and a condition score badge. The grade badge (`Excellent/Good/Fair/Poor/Rejected`) is computed client-side from `current_condition_score` using `GRADE_BANDS` thresholds (90/75/60/40/0) that **intentionally mirror** `backend/assessment.py`'s `GRADE_BANDS` — so the same score always shows the same grade everywhere in the app, even though the mapping is duplicated rather than fetched from the API.
- **Lifecycle timeline** — every `PassportCycle` row rendered as a card on a dashed vertical "thread" (CSS, not a chart library — see `.timeline-thread` in `index.css`), each showing event label, date, score snapshot, notes, and any attached reward.
- **Impact metrics** — `<ImpactReceipt>` component fed by `garment.sustainability` (computed server-side, see §6) plus a client-computed `familiesServed` = count of `purchased` events in this garment's cycle list.
- **Barcode** — re-displays the garment's own tag image, so the same passport you scanned to get here can be re-shown to e.g. a thrift buyer.

**Why this is "the demo's wow moment" (per `CLAUDE.md`):** it's the only screen where the abstract "circularity" pitch becomes concrete — you see one physical object's actual history, with real numbers attached, not a marketing claim.

---

## 4. Passport Scanner

**Route:** `/scan` → `PassportScanner.jsx`. Two entry paths to the same destination:
1. **Manual ID** — text input, submits to `GET /garments/:id`; on success, `navigate('/passport/:id')`; on 404, shows an inline error instead of navigating.
2. **Barcode scan** — `Html5Qrcode.start()` opens the camera in a mounted `<div id="barcode-reader">`; on a successful decode it stops the scanner and calls the same resolve-then-navigate path.

**Why verify before navigating instead of just routing to `/passport/<scanned-id>` directly:** a bad/garbled scan would otherwise dead-end on the Passport page's own error state. Pre-checking with the same `GET /garments/:id` call surfaces the error on the scanner screen itself, where "try again" makes more sense.

**Camera lifecycle:** the `useEffect` that starts the scanner returns a cleanup that calls `scanner.stop().then(() => scanner.clear())` — this matters because leaving a camera stream open after navigating away is both a privacy issue and a memory/battery leak; React Strict Mode's double-invoke in dev also makes leaks like this visible fast if they exist.

---

## 5. AI Condition Assessment

**Route:** `POST /assess` (`backend/main.py:73-78`) → `assess_garment_image()` in `backend/assessment.py`.

**Current implementation is a deterministic mock, not a live model call:**
1. SHA-256 hash the incoming base64 image string.
2. Take the first 8 hex chars, `% 100` → a `condition_score` (0-99).
3. Map score → grade via `GRADE_BANDS` (90 Excellent / 75 Good / 60 Fair / 40 Poor / 0 Rejected).
4. Look up a fixed defect list per grade from `DEFECT_POOL` (e.g. Fair → `["small stain", "loose thread"]`).
5. `recommended_price = 2.0 + score * 0.08` (mirrors `seed.py`'s pricing formula so mock-assessed and seed-data garments land in the same price band).
6. `eligible_for_trade_in = score >= 50`.

**Why hash-deterministic instead of random:** the same photo always produces the same result on every retry, across every demo run — avoids the embarrassing "it said Excellent five minutes ago, now it says Rejected" flicker live in front of judges.

**Why this is a legitimate "AI assessment" story despite being mocked:** the API contract (`condition_score`, `grade`, `defects[]`, `recommended_price`, `eligible_for_trade_in`) is the exact shape a real Claude vision call would return. `anthropic` is already a declared dependency (`backend/requirements.txt`); swapping `assess_garment_image()`'s body for a real `client.messages.create(...)` call with an image-understanding prompt requires **zero changes** to `main.py`, the React `TradeIn.jsx` screen, or the API contract. This separation was a deliberate design choice to de-risk the demo from API key/quota/latency issues on stage while keeping the "real" integration a one-function swap.

**Where the result is used:** `TradeIn.jsx` calls `assessImage()`, displays the score/grade/defects/price, and **does not auto-decide** — the employee still clicks Approve or Reject. If the AI scored eligibility false, the UI shows a warning ("AI recommends against trade-in, but the final call is yours") but doesn't block the button — keeps a human in the loop rather than a fully automated rejection.

---

## 6. Trade-In Approval / Rejection Flow

**Route:** `POST /trade-in` (`backend/main.py:100-179`). Employee-only UI at `/trade-in` (`TradeIn.jsx`).

**Flow:** scan/load a garment → upload a photo → run assessment → Approve or Reject. The assessment result the *employee saw* is resubmitted verbatim alongside the decision (`AssessmentResult` Pydantic model) — `/trade-in` does **not** re-run the assessment itself. This guarantees the reward/price/notes written to the DB exactly match what was shown on screen, even if a hypothetical real AI call were non-deterministic.

**On approve:**
1. Appends an `inspected` cycle event (notes include the grade).
2. Appends a `sanitized` cycle event immediately after — approval and sanitization are folded into one transaction rather than a separate "send to cleaning" step, since there's no physical sanitization to actually model in a demo.
3. Issues a `Reward` (`reward_type: "store_credit"`, `value = score * 0.10`), FK'd to the `inspected` cycle.
4. Sets `garment.current_status = "resale"`, `current_condition_score = score`, `price` = the AI's recommended price (or recomputed if absent).

**On reject:**
1. Appends a single `inspected` cycle event with a `notes` reason (employee-supplied or a default AI-grade-based message).
2. Sets `current_status = "returned"`, clears `price`.
3. **No reward issued.** Per `CLAUDE.md`'s rejection-flow spec — the garment is logged and handed back to the family, full stop.

**A deliberate deviation from the original task spec, documented inline:** `TODO.md`'s T07 literally says approve should set status to `"returned"`, but the implementation sets it to `"resale"` instead (`main.py:105-109` comment explains why) — otherwise newly-approved garments would never reach the Marketplace, which only lists `current_status == "resale"`. This is the kind of "the spec said X but X breaks the next feature down the line" judgment call worth being able to explain if asked.

**Why fold inspect+sanitize into approval instead of separate steps/screens:** scope control for a hackathon timeline — sanitization isn't a real physical process here, so giving it its own screen/state machine would be complexity with no corresponding user-visible behavior.

---

## 7. Marketplace (Resale)

**Route:** `/marketplace` → `Marketplace.jsx`. Backed by `GET /garments` (`main.py:38-56`), which is **hard-filtered to `current_status == "resale"`** before any of the optional query params (`size`, `condition_min`, `price_max`) apply. A garment only appears here once it has actually been approved through the Trade-In flow (or is one of `seed.py`'s pre-seeded `"resale"` rows) — see §6 for the exact transition.

**Filters:** size (pill multi-toggle, actually single-select with "click again to clear"), minimum condition score, maximum price — all client-side state that re-triggers the same `GET /garments` call with new query params on every change (no debounce; the dataset is tiny so this is fine).

**Purchase:** `POST /garments/:id/purchase` (`main.py:182-210`) — guarded server-side by `current_status != "resale" → 400`, so a double-click or stale client state can't "buy" something already sold or never listed. On success: appends a `purchased` cycle event, flips `current_status` back to `"active"` (a new family now has it), and the UI optimistically removes the card from the grid and shows a confirmation banner linking to the now-updated Passport.

**Why "purchase" doesn't touch `price`:** the price stays on the garment record after purchase — `dashboard()`'s `revenue_generated` metric depends on reading `garment.price` for any garment that's been purchased ≥2 times (see §8). If purchase cleared the price, revenue reporting would break.

**No real checkout, by design (`CLAUDE.md`):** the button is a single state-flip API call. Building a cart/payment flow would be effort spent on a solved problem (Stripe etc.) instead of the actual pitch, which is circularity — not e-commerce.

---

## 8. Corporate Dashboard

**Route:** `/dashboard`, gated to the Corporate role via `<RequireRole allow="Corporate">` (§10). Single `GET /dashboard` call (`main.py:213-282`).

**Metrics and exactly how each is computed:**
| Metric | Definition |
|---|---|
| `total_garments` | `count(*)` over all garments |
| `returned` | garments currently sitting at `current_status == "returned"` (awaiting/failed inspection) |
| `resold` | garments with **≥2** `purchased` cycle events — i.e. actually re-bought by a second family, not merely *listed*. Distinct from `current_status == "resale"`, which just means "available," tracked separately by design (see code comment in `main.py:217-221`) |
| `participants` | sum of all `purchased` events across all garments — total family-touches the whole program has had |
| `revenue_generated` | sum of `garment.price` for every garment with ≥2 purchases (i.e. the same set counted in `resold`) — revenue actually *collected* via a resale, not listed-but-unsold inventory |
| `sustainability` | `{cycles_completed, water_saved_liters, co2_avoided_kg}` — see §9 |
| `top_durable_garments` | top 3 by `(count of "sanitized" events, current_condition_score)` descending — "survived more loop trips" beats "currently scores high but has only done it once" |
| `returns_by_size` | count of `returned`-event cycles grouped by the garment's *current* size, charted with Recharts `<BarChart>` |

**Why `resold` will read 0 until you actually click Purchase in the demo:** it requires a *second* purchase event, and seed data only gives `"resale"`-category garments one purchase (their original sale) plus the trade-in. This is intentional — `resold` should answer "has anything actually completed a full loop," and seed data alone can't claim that without a live purchase action.

---

## 9. Sustainability Math

**Constants** (`backend/constants.py`): `WATER_SAVED_PER_CYCLE_LITERS = 2700`, `CO2_AVOIDED_PER_CYCLE_KG = 2.0`. Fixed LCA (Life Cycle Assessment) proxy values, not computed from any real per-garment data — and **deliberately published as assumptions in the UI** (Dashboard's sustainability banner literally states "Based on fixed LCA proxies: 2,700 L water saved and 2 kg CO₂ avoided per completed cycle") rather than presented as precise measurement.

**What counts as "a completed cycle":** the `sanitized` event specifically (`serializers.py: COMPLETING_EVENT_TYPE = "sanitized"`) — the point where a garment has been inspected, approved, *and* cleaned, ready to re-enter circulation. A garment still on its first family, or one that was returned but rejected, hasn't earned the credit yet. `compute_sustainability_totals()` is the single shared function (`serializers.py:43-49`) used by both the per-garment Passport totals and the program-wide Dashboard totals — guarantees the two numbers can never drift apart from duplicated math.

**Why fixed proxies instead of real LCA data:** no real per-SKU lifecycle assessment data exists for a hackathon demo; rather than fabricate false precision, the app states the assumption outright. This is a defensible, honest design choice if a judge pushes on "is this number real."

---

## 10. Roles & "Auth"

**No real authentication.** `RoleContext.jsx` holds `role` (`'Parent' | 'Employee' | 'Corporate'`) as plain React state, defaulting to `Parent`, switchable any time via a dropdown in the nav bar (`NavBar.jsx`) — visible and changeable on every screen.

**Enforcement is UI-only, not security:**
- `NavBar.jsx`'s `ROLE_LINKS` map only *shows* nav links relevant to the current role (e.g. Employee sees "Trade-In", Corporate sees "Dashboard").
- `RequireRole.jsx` wraps the `/dashboard` route specifically — if `role !== 'Corporate'`, it renders a "switch role" prompt instead of the page content, but **the API endpoints themselves have no role check** — anyone could `curl /dashboard` directly.

**Why this is fine for a hackathon demo and explicitly called out in `CLAUDE.md`:** building real auth (login, sessions, server-side authorization) is a substantial chunk of work that doesn't change the pitch — the pitch is the circularity loop, not access control. The role switcher exists purely so one person can demo all three personas (parent scanning a tag, employee processing a trade-in, corporate viewing the dashboard) from a single browser tab without logging in/out.

---

## 11. Landing Page

**Route:** `/` → `Landing.jsx`. Hero (logo, tagline, two CTAs: "Shop LittleLoop" → Marketplace, "Scan a Passport" → Scanner), a static three-column value-prop section, then a **live stats section** fed by the same `GET /dashboard` call the Corporate Dashboard uses (`total_garments`, `participants`, water/CO₂ totals) — so the landing page's "our impact so far" numbers are never hand-typed/stale; they're the same live aggregate.

**Why it was flagged as "cut if time-pressed" in `CLAUDE.md`:** it's marketing surface, not part of the actual garment-lifecycle loop — useful for pitch framing but the demo's substance lives in Passport/Marketplace/Trade-In/Dashboard.

---

## 12. Frontend Architecture Choices

- **Routing:** `react-router-dom` v7, all routes declared flat in `App.jsx`; no nested layouts beyond the single persistent `<NavBar>` wrapping every page.
- **API layer:** `frontend/src/api.js` is a single thin `fetch` wrapper (`request()`) — every endpoint is a one-line function (`getGarment`, `listGarments`, `assessImage`, `submitTradeIn`, `getDashboard`, `purchaseGarment`). No data-fetching library (no React Query/SWR) — the app's data needs are simple enough (one fetch per page, no caching/invalidation complexity) that adding one would be unjustified overhead.
- **Dev proxy:** `vite.config.js` proxies `/garments`, `/assess`, `/trade-in`, `/dashboard`, `/static` to `http://127.0.0.1:8000`, so the frontend can call relative paths in dev without hardcoding the backend origin or fighting CORS; `api.js`'s `BASE` constant (`VITE_API_BASE` env var, empty by default) is the same mechanism for a prod deploy where frontend and backend might not share an origin.
- **Styling:** Tailwind v4, configured via `@theme` in `index.css` rather than a `tailwind.config.js` — six base brand colors plus their documented derived values (full palette in `Design.md`), explicitly "nothing outside this palette." Two bespoke CSS effects exist outside Tailwind utilities: `.hero-crosshatch` (a diagonal hairline texture on the Passport hero, standing in for a fabric-weave reference since `Design.md` explicitly bans gradients) and `.timeline-thread` (a dashed vertical line for the lifecycle timeline, deliberately not a generic solid connector).
- **Icons:** `lucide-react` exclusively, no custom SVGs except the brand logo image.
- **Charts:** Recharts, used in exactly one place (Dashboard's "Returns by Size" bar chart) — the one spot in the app where a table alone wouldn't communicate distribution as well as a chart.

---

## 13. Things Worth Pre-empting in Q&A

- **"Is the AI real?"** No — deterministic SHA-256-hash mock with the exact response contract a real Claude vision call would return; swapping it in is a one-function change (§5).
- **"What stops someone from approving their own rejected trade-in twice?"** Nothing server-side prevents re-submitting `/trade-in` for the same garment id repeatedly (no idempotency key) — acceptable for a demo, would need request deduplication/state-machine guards (e.g. only allow `/trade-in` when `current_status == "returned"`) in production.
- **"What happens to the barcode if a garment changes hands?"** Nothing — the barcode encodes the immutable `garment.id`, so it's valid for the garment's entire lifetime across every family that owns it; nothing to regenerate on purchase.
- **"Why SQLite, not Postgres?"** Zero-ops local persistence for a hackathon; the schema (3 tables, simple FKs) has no feature that needs a heavier engine, and `seed.py` already treats the DB as disposable/idempotent (drops and recreates all tables on every run).
- **"How do you stop a sold-out garment from being bought twice?"** `purchase_garment()` checks `current_status == "resale"` server-side and 400s otherwise — not just a client-side disabled button.
- **"Why is `resold` 0 in a fresh demo?"** It requires two purchase events on the same garment; seed data gives `"resale"`-category garments exactly one (their original sale). You have to actually click Purchase in the Marketplace during the demo to see this metric move — a good thing to demo live, not just describe.
