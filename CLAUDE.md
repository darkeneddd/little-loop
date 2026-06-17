# Carter's LittleLoop — Project Reference

## What This Is
A hackathon project for Carter's. A circular baby clothing ecosystem where garments get a digital identity (Digital Garment Passport) and stay in circulation across multiple families via trade-ins, AI inspection, and resale.

**Core loop:** Purchase → Wear → Trade-In → AI Inspect → Sanitize → Resale → Repeat

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite |
| Styling | Tailwind CSS |
| Backend | Python + FastAPI |
| Database | SQLite + SQLAlchemy |
| AI Assessment | Claude API (vision) |
| Barcode Generation | `qrcode` (Python) |
| Barcode Scanning | `html5-qrcode` (JS) |
| Charts | Recharts |
| Icons | Lucide React |
| Hosting | Local (hackathon) |

---

## Architecture

```
Frontend (React + Vite)
  Landing | Passport | Marketplace | Employee | Dashboard
          |
       REST API
          |
Backend (FastAPI)
  Passport Service | Trade-In Service | Rewards Service
       |                    |
  SQLite (SQLAlchemy)    Claude API (vision)
```

---

## Data Models

```python
Garment
  id (UUID)
  sku
  product_name
  size
  manufactured_at
  current_condition_score
  current_status  # active | returned | sanitizing | resale | retired

PassportCycle
  id
  garment_id
  cycle_number
  event_type  # manufactured | purchased | returned | inspected | sanitized | resold
  timestamp
  condition_score_at_event
  notes

Reward
  id
  garment_id
  cycle_id
  reward_type
  value
  issued_at
```

---

## API Endpoints

| Method | Route | Purpose |
|---|---|---|
| GET | `/garments/:id` | Full passport + cycle history + sustainability totals |
| GET | `/garments` | Resale inventory, supports `size` / `condition_min` / `price_max` filters |
| POST | `/assess` | Send image to Claude, returns condition JSON |
| POST | `/trade-in` | Approve/reject trade-in, creates cycle event + reward |
| GET | `/dashboard` | Aggregated stats for corporate view |

### AI Assessment — POST /assess
Sends garment image (base64) to Claude API. Prompt instructs Claude to return structured JSON:
```json
{
  "condition_score": 92,
  "grade": "Excellent",
  "defects": [],
  "recommended_price": 5.99,
  "eligible_for_trade_in": true
}
```

---

## Key Design Decisions

**Garment ID mechanism:** Barcodes on hang tags for the demo. Label durability (washing) is a known production problem — acknowledge in pitch, don't solve it now.

**Auth:** No auth system. Role switcher dropdown in nav (Parent / Employee / Corporate). Role stored in React context.

**Payments:** No real checkout. "Purchase" button flips garment status in DB and updates passport.

**Sustainability math:** Use fixed LCA proxies per cycle:
- 2,700 liters of water saved
- 2 kg CO₂ avoided
- Publish these assumptions explicitly in the UI

**Rejection flow:** Rejected garments get a PassportCycle event with reason logged. No reward issued. Garment returned to parent.

---

## User Roles & Views

| Role | Screens |
|---|---|
| Parent (Consumer) | Landing, Passport Scanner, Passport, Marketplace |
| Employee | Trade-In intake, AI Assessment, Reward confirmation |
| Corporate | Analytics Dashboard |

---

## Screens

1. **Landing Page** — Program overview, stats from `/dashboard`, CTAs to Shop and Scan
2. **Passport Scanner** — Manual ID input or barcode scan → navigates to Passport
3. **Digital Passport** — Hero stats, lifecycle timeline, impact metrics, barcode display
4. **Marketplace** — Resale grid, filters, links to Passport, "Purchase" button
5. **Employee Trade-In** — Scan garment, upload photo, run AI assessment, approve/reject
6. **Corporate Dashboard** — KPI cards, sustainability totals, durability table, returns-by-size chart

---

## Seed Data Requirements
- 15 garments
- Each with 2–4 passport cycle events
- Mix of statuses: active, resale, returned
- Mix of condition scores: excellent, fair, rejected
- Barcode PNG generated per garment → `/backend/static/barcode/<garment_id>.png`

---

## Hero Screen
The **Digital Passport** is the demo's "wow" moment. Prioritize its design.

## Cut If Time-Pressed
- Landing page (T17) — nice but not core
- Bar chart on dashboard (T14) — can show table only
- Keep: barcode display on passport (T15) and impact receipt component (T16)

## 
Work through the todo list in TODO.md, asking the user questions as needed.

## Agent Workflow Notes
- For testing/verification tasks (e.g. smoke-testing servers, curl checks, confirming a task works end-to-end), shift to **Low** reasoning effort — these are mechanical checks, not design work.
- After completing each TODO task, compact the session before starting the next one.