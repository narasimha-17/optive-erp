# Optiva ERP

A React + Python site for Optiva ERP: the marketing landing page, log in / sign up, and the signed-in business dashboard.

```
optiva-erp/
├── backend/    Python (FastAPI) API, SQLite storage, token auth
└── frontend/   React + TypeScript + Vite + Tailwind CSS + Lucide icons
```

The original static prototypes (`index.html`, `login.html`, `signup.html`, `auth.css`, `auth.js`) in the parent folder are kept as reference. Their design, copy and assets (`logo.png`, `mark.png`, `favicon.png`) are what this app is built from.

## Run it

You need Python 3.10+ and Node 18+.

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend (development)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to the backend on port 8000.

### Single-server mode

```bash
cd frontend && npm install && npm run build
cd ../backend && uvicorn app.main:app --port 8000
```

When `frontend/dist` exists, the Python server also serves the React app, so everything is at http://localhost:8000.

## Demo account

| Email | Password |
| --- | --- |
| `demo@optiva.com` | `Optiva@123` |

The login page also has a "Fill demo account" button. You can create your own account on the sign-up page.

Three teammates exist in the same company so you can try approvals and access control from another person's point of view. They all use the same password, `Optiva@123`:

| Name | Email | Role |
| --- | --- | --- |
| Priya Nair | `priya.nair@acme.com` | Finance Manager |
| Daniel Brooks | `daniel.brooks@acme.com` | Operations Head |
| Meera Shah | `meera.shah@acme.com` | Legal Counsel |

## What is where

| Route | Page |
| --- | --- |
| `/` | Landing page (3D coins on the ramp, modules, platform, AI, industries) |
| `/login`, `/signup` | Authentication, validated in the browser and again by the API |
| `/app` | Dashboard (requires login) |
| `/app/vault` | Vault, document management (requires login) |

### API

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/signup` | Create an account, returns a token |
| POST | `/api/auth/login` | Log in, returns a token |
| GET | `/api/auth/me` | Current user |
| GET | `/api/dashboard` | KPIs, module performance, orders, activity, workflows, insights, add-on modules |
| GET | `/api/dashboard/activity?range=7d\|30d\|90d` | Revenue and collections chart data |
| PATCH | `/api/workflows/{id}` | Pause or resume an automation (saved) |
| POST | `/api/modules/{id}/enable` | Enable an add-on module (saved) |

Interactive API docs are at http://localhost:8000/docs.

## Vault (document management)

Open **Vault** in the sidebar. Ten sample documents are created on first run.

| Feature | What it does |
| --- | --- |
| Document management | Upload files (up to 15 MB), organise them in folders, download, rename, tag, archive |
| Version control | Every upload keeps the old file. Compare versions, download any of them, restore an older one as the newest |
| Approval workflows | Send a document to a colleague. They approve or reject with a comment. You cannot approve your own request |
| E-signatures | Request signatures from several people. Signers type their name (and can draw it), and a SHA-256 fingerprint of the exact file is stored with each signature |
| Access control | Company-wide or restricted, plus per-person view/edit sharing. Private documents are hidden from other users |
| Document intelligence | Extracts parties, amounts, dates, reference numbers and key terms, and flags clauses such as auto-renewal or penalties |
| AI search | Ask in plain language: `unsigned contracts`, `invoices above 1 lakh`, `policies last 3 months`. Results are ranked and the filters it understood are shown |
| Retention policies | Each type gets a policy (for example 7 years for invoices). Deletion is blocked until the period ends, and legal hold blocks it entirely |
| Audit trails | Every view, change, approval and signature is logged. Filter it and export to CSV |
| Automated classification | New files are typed (invoice, contract, NDA...), filed, tagged and given a retention policy automatically |

Text is read from `.txt`, `.md`, `.csv`, `.docx` and `.pdf` files (PDF uses `pypdf`). Classification, extraction and search are rule-based and run locally, with no external AI service. The functions in `backend/app/vault_ai.py` are the place to plug in a model.

Vault endpoints are under `/api/vault` (see `/docs`). Files are stored in `backend/data/vault/`.

## Notes

- Passwords are hashed with PBKDF2-SHA256. Tokens are signed JWTs (12 hours, or 30 days with "Keep me signed in"). The signing secret is created on first run in `backend/data/.secret`; set `OPTIVA_SECRET` to use your own.
- Accounts, automation status and enabled modules are stored in `backend/data/optiva.db` (SQLite).
- Business figures on the dashboard are deterministic sample data from `backend/app/erp_data.py`. Replace those functions with real queries to connect your data.
- Google and Microsoft sign-in buttons, "Forgot password" and the non-dashboard sidebar modules are placeholders.
- `frontend/src/pages/landing/landingEffects.ts` is the ported imperative animation code (coin physics, scroll reveal) and is excluded from type checking.
