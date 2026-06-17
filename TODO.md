# LittleLoop — To Do

Build in order. Don't start a task until the one above it is done.

---

## PHASE 1 — Foundation

- [ ] **T01 — Project scaffold**
  - [ ] Create `/backend` and `/frontend` folders
  - [ ] Init Vite + React in `/frontend`
  - [ ] Init FastAPI app in `/backend`
  - [ ] Install all deps: Tailwind, SQLAlchemy, anthropic, qrcode, html5-qrcode, recharts, lucide-react
  - [ ] Confirm both servers run (hello world)

- [ ] **T02 — Database models**
  - [ ] `Garment` model
  - [ ] `PassportCycle` model
  - [ ] `Reward` model
  - [ ] Run `create_all()`, confirm tables exist

- [ ] **T03 — Seed data**
  - [ ] 15 garments with full passport histories (2–4 cycle events each)
  - [ ] Mix of statuses: active, resale, returned
  - [ ] Mix of condition scores: excellent, fair, rejected
  - [ ] Sustainability constants: 2700L water, 2kg CO₂ per cycle
  - [ ] Generate barcode PNG per garment → `/backend/static/barcode/<id>.png`
  - [ ] Confirm query returns garment + cycles

---

## PHASE 2 — API

- [ ] **T04 — GET /garments/:id**
  - [ ] Returns garment + full cycle history
  - [ ] Computed sustainability totals
  - [ ] Test with curl

- [ ] **T05 — GET /garments**
  - [ ] Filters: `size`, `condition_min`, `price_max`
  - [ ] Returns `resale` status garments only
  - [ ] Test with curl

- [ ] **T06 — POST /assess**
  - [ ] Accepts `garment_id`, `image_base64`
  - [ ] Sends to Claude API, returns structured JSON
  - [ ] Fields: `condition_score`, `grade`, `defects[]`, `recommended_price`, `eligible_for_trade_in`
  - [ ] Test with a real photo

- [ ] **T07 — POST /trade-in**
  - [ ] Accepts `garment_id`, `assessment_result`, `employee_decision`
  - [ ] Approve: new PassportCycle + Reward + status → `returned`
  - [ ] Reject: new PassportCycle with reason, no reward
  - [ ] Test with curl

- [ ] **T08 — GET /dashboard**
  - [ ] Total garments, returned, resold
  - [ ] Sustainability totals (water, CO₂)
  - [ ] Top 3 most durable garments
  - [ ] Returns by size breakdown
  - [ ] Test with curl

---

## PHASE 3 — Frontend

- [ ] **T09 — App shell + role switcher**
  - [ ] React Router with all routes
  - [ ] Nav with role dropdown: Parent / Employee / Corporate
  - [ ] Role in React context
  - [ ] Role-gated nav links

- [ ] **T10 — Passport Scanner screen**
  - [ ] Manual garment ID text input
  - [ ] Barcode scanner (html5-qrcode)
  - [ ] Calls GET /garments/:id
  - [ ] Navigates to Passport on success, error on failure

- [ ] **T11 — Digital Passport screen** ← hero screen, make it look good
  - [ ] Product name, size, condition score, status badge
  - [ ] Lifecycle timeline (vertical, icons, timestamps)
  - [ ] Impact metrics: families served, water saved, CO₂ avoided
  - [ ] Barcode image displayed

- [ ] **T12 — Marketplace screen**
  - [ ] Grid of resale garment cards
  - [ ] Card: name, size, grade, price, thumbnail
  - [ ] Filter sidebar: size, condition, price
  - [ ] Each card links to Passport
  - [ ] "Purchase" button → flips status, updates passport, shows confirmation

- [ ] **T13 — Employee Trade-In screen**
  - [ ] Garment ID input/scan → loads garment info
  - [ ] Photo upload (file input → base64)
  - [ ] "Run Assessment" → calls POST /assess → shows results
  - [ ] Approve/Reject → calls POST /trade-in
  - [ ] Approve: shows reward + impact receipt
  - [ ] Reject: shows reason

- [ ] **T14 — Corporate Dashboard screen**
  - [ ] Gated to Corporate role only
  - [ ] KPI cards: returned, resold, participants, revenue
  - [ ] Sustainability totals
  - [ ] Top durable products table
  - [ ] Returns by size bar chart (Recharts)

---

## PHASE 4 — Polish

- [ ] **T15 — Barcodes on Passport screen**
  - [ ] Serve PNGs from `/backend/static/barcode/:id.png`
  - [ ] Display on Passport screen

- [ ] **T16 — Impact receipt component**
  - [ ] Reusable component: water saved, CO₂, families, waste
  - [ ] Used in Trade-In confirmation + Passport screen
  - [ ] Big numbers, Lucide icons, feels like a shareable card

- [ ] **T17 — Landing page** *(cut if short on time)*
  - [ ] Hero: what is LittleLoop
  - [ ] Three-column value props
  - [ ] Live stats from GET /dashboard
  - [ ] CTAs: Shop LittleLoop, Scan a Passport

- [ ] **T18 — End-to-end demo run**
  - [ ] Scan garment → view passport
  - [ ] Do a trade-in → view updated passport
  - [ ] Find garment in marketplace → purchase
  - [ ] View final passport state
  - [ ] Fix anything broken
  - [ ] Confirm timeline updates correctly at each step

---

## Cut Order Under Time Pressure
1. T17 (Landing page) — cut first
2. T14 bar chart — show table only
3. T15, T16 — keep these, they close the loop visually