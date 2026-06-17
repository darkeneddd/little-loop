# Real Model Integration — Decisions

Replacing the deterministic mock (`backend/assessment.py`) with the finetuned
garment-defect model (`backend/inference.py` + `checkpoint.pt`). Decisions
made so far, for future reference.

---

## Where training and inference each run

- **Training** happens on a rented GPU server. That box is temporary — once a
  checkpoint is good, copy `checkpoint.pt` off it (scp/download) and the GPU
  rental can be shut down. It is not part of the serving path.
- **Inference** runs inside the FastAPI backend process, on whatever machine
  is running `backend/main.py` — the demo laptop, not the rented GPU.
- **CPU-only inference is the plan.** Confirmed acceptable for the demo.
  `inference.py` already picks `cuda` if available and falls back to `cpu`
  otherwise, so no code change is needed for this — just don't expect a GPU
  on the laptop. DINOv2-base is ~86M params (similar size to BERT-base /
  ResNet-50); a single forward pass on CPU is normal and fast enough for an
  interactive "Run Assessment" click (not real-time video).
- **Load the model once, not per-request.** `inference.py`'s current
  `load_model()` is written for one-shot CLI use (loads on every invocation).
  The FastAPI integration needs to turn this into a singleton loaded once at
  server startup (or lazily on first call) and reused for every `/assess`
  call — reloading the checkpoint + DINOv2 backbone per request would add
  multi-second latency to every trade-in scan.

## Checkpoint file

- Lives at `backend/checkpoint.pt`, matching `inference.py`'s existing
  relative default path.
- **Gitignored** (added to `.gitignore`) — trained checkpoints with a DINOv2
  backbone are large binary artifacts that don't belong in git history.

## `/assess` fallback cascade

Three tiers, each only used if the one above isn't usable:

1. **Finetuned model** (`checkpoint.pt` + `inference.py`) — primary path once
   training is done.
2. **Claude Haiku 4.5 vision** — used if the checkpoint is missing or the ML
   deps aren't installed (e.g. still training, or running on a teammate's
   machine). Real AI-driven assessment instead of fake scores. Cost is
   negligible: ~$0.002–0.003 per assessment (a ~1,200–1,600 token image +
   prompt, ~150 token JSON response, at Haiku 4.5's $1/$5 per MTok pricing) —
   well under $1 total for the whole hackathon's dev + demo usage. This also
   finishes work `CLAUDE.md` already scoped (`assessment.py`'s docstring
   anticipated swapping in a real Claude vision call), and `anthropic` is
   already an unused dependency in `requirements.txt`.
3. **Deterministic mock** (`assessment.py`, already built) — guaranteed
   fallback if Claude is also unavailable (no `ANTHROPIC_API_KEY`, no
   internet). Ensures the demo never breaks outright.

## Defect label wording

`inference.py`'s four per-attribute heads (`pilling`, `condition`, `stains`,
`holes`) each output a 1–5 severity class. The API contract needs these as
human-readable strings (e.g. `"small stain"`) for the Trade-In UI's defect
badges.

**Decision: placeholder for now.** Auto-generate generic severity wording
from the severity bands (mirroring `assessment.py`'s existing style, e.g.
only show a badge at severity >= 3), clearly marked as a placeholder mapping.
Refine the actual wording once the checkpoint is ready and real outputs can
be eyeballed.

## New dependencies

Added to `backend/requirements.txt`: `torch`, `torchvision`, `transformers`,
`pillow`.

- `transformers` downloads `facebook/dinov2-base` (~330MB) from the Hugging
  Face Hub on first use, cached afterward in `~/.cache/huggingface/hub` (or
  `%USERPROFILE%\.cache\huggingface\hub` on Windows). The download happens
  once ever per machine, not on every server restart.
- **Pre-warm before the live demo** — trigger the download ahead of time (at
  a desk, on real wifi) rather than risk it happening live on venue wifi.
- **Windows CPU-only install note:** plain `pip install torch` can pull in
  CUDA runtime dependency packages (hundreds of MB+) even with no NVIDIA GPU
  present. Install the CPU-only build first instead:
  ```
  pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
  pip install -r requirements.txt
  ```

---

## Implementation (this session)

The cascade above is now built and wired into `POST /assess`. New/changed files:

- **`backend/defect_scoring.py`** (new) — `score(defects)` (moved verbatim
  out of `inference.py`) and `defects_to_labels(defects)` (the placeholder
  severity-band wording: `{3: "moderate", 4: "significant", 5: "severe"}`,
  only emitted at severity ≥ 3). Deliberately has **zero torch/Pillow
  dependency** and is imported by both `inference.py` and `claude_assess.py`
  so all three tiers share one scoring formula instead of duplicating it —
  and so tier 2 never accidentally pulls in torch through a shared import.

- **`backend/inference.py`** (refactored) — `CHECKPOINT` is now an absolute
  path (`os.path.join(os.path.dirname(__file__), "checkpoint.pt")`, matching
  `main.py`'s `STATIC_DIR` pattern) so it resolves regardless of the CWD
  uvicorn is launched from. Added a module-level singleton (`_model` /
  `get_model()`) that loads the checkpoint once and reuses it — measured
  ~9x faster on the second call (1.96s → 0.22s) in testing. Added
  `preprocess_image(img)` (works from a `PIL.Image`) so the new
  `run_inference(image_bytes)` can preprocess directly from in-memory bytes
  without touching disk. `run_inference()` is the tier-1 entry point: runs
  the model, then builds the full `/assess` response shape via
  `defect_scoring` + `assessment`'s grade/price helpers, tagged
  `assessed_by: "finetuned_model"`. The original CLI (`python inference.py
  <path>`) still works unchanged.

- **`backend/claude_assess.py`** (new) — tier 2. `run_inference(image_bytes)`
  calls `claude-haiku-4-5` with a system prompt asking for the *same* four
  categories the finetuned model outputs (`pilling`, `condition`, `stains`,
  `holes`, each 1-5) as a bare JSON object, so `defect_scoring.score()`
  produces a comparable score regardless of which tier ran. Sniffs the
  image's real media type from magic bytes (no Pillow dependency) since the
  frontend sends bare base64 with no mime type. Raises (caught by the
  orchestrator, falls to tier 3) if `ANTHROPIC_API_KEY` is unset, the API
  call fails, or the response isn't parseable JSON.

- **`backend/assessment.py`** (extended) — the deterministic mock now also
  returns `assessed_by: "deterministic_mock"`. Added `run_assessment(image_base64)`,
  the actual orchestrator `main.py` calls: tries `inference.run_inference()`,
  then `claude_assess.run_inference()`, then falls back to the mock,
  catching any exception at each step and printing why before moving on.
  **`import inference` / `import claude_assess` happen inside the function**,
  not at module top — this is the mechanism that makes "ML deps not
  installed" gracefully degrade: if `torch`/`transformers` aren't installed,
  `import inference` itself raises `ImportError` right there, caught and
  logged, instead of crashing the whole server at startup.

- **`backend/main.py`** — loads `backend/.env` via `python-dotenv` at startup
  (absolute path, same CWD-independence reasoning as `STATIC_DIR`); `/assess`
  now calls `run_assessment()` instead of the mock directly; `AssessmentResult`
  gained an optional `assessed_by` field so it round-trips through `/trade-in`;
  the `inspected` cycle's `notes` now include `(via <engine>)` when present,
  so the passport history shows which tier produced a given assessment, not
  just the live Trade-In screen.

- **`backend/requirements.txt`** — added `python-dotenv`.

- **`backend/.env.example`** (new) — `ANTHROPIC_API_KEY=` placeholder.
  `.gitignore` already had `.env` / `*.env` / `!.env.example`, so no
  `.gitignore` change was needed.

- **`frontend/src/pages/TradeIn.jsx`** — small UI addition: a one-line label
  under the grade badge showing which engine produced the result
  (`ENGINE_LABELS` maps `assessed_by` → "LittleLoop AI model" / "Claude AI
  (fallback)" / "Simulated assessment"). This is the only reason `assessed_by`
  was added to the API contract — otherwise it would be returned but never
  surfaced.

**One bug fixed during implementation:** `defect_scoring.score()` returns a
float (the category weights produce quarter-point increments — e.g. 73.5),
but `AssessmentResult.condition_score` is typed `int`. Left as-is, a
model-backed assessment would fail Pydantic validation the moment the
Trade-In screen resubmitted it to `POST /trade-in`. Fixed by rounding to an
int in both `inference.run_inference()` and `claude_assess.run_inference()`
before returning — matches the DB's `Integer` columns and the mock tier's
already-integer score.

### Verification results

- **Tier 1 (finetuned model):** confirmed working end-to-end against the real
  checkpoint — `Loaded checkpoint from epoch 8 (val MAE: 0.4688)`, real
  inference output, `assessed_by: "finetuned_model"`. The DINOv2-base backbone
  download (~330MB) happened during this test and is now cached locally
  (`~/.cache/huggingface/hub`) — the "pre-warm before the demo" step from
  the Checkpoint section above is effectively already done on this machine.
  Singleton caching confirmed (second call ~9x faster, identical output).
- **Tier 3 (deterministic mock):** confirmed working as the final fallback
  when both tier 1 (no `checkpoint.pt`) and tier 2 (no API key) are
  unavailable.
- **Tier 2 (Claude Haiku):** *not yet verified live* — the user's
  `backend/.env` had `ANTHROPIC_BASE_URL` pointed at Gemini's OpenAI-compatible
  endpoint and `ANTHROPIC_MODEL=gemini-2.5-flash` (carried over from some
  other tool's setup), which silently redirects the `anthropic` Python
  client away from `api.anthropic.com` — the SDK reads `ANTHROPIC_BASE_URL`
  from the environment automatically. That produced a bare 404 (Gemini's
  endpoint has no model named `claude-haiku-4-5`). **Action needed before
  tier 2 can be tested:** put a real Anthropic key (`sk-ant-...`) in
  `backend/.env` with no other `ANTHROPIC_*` overrides alongside it, or this
  tier will keep silently falling through to the mock.

