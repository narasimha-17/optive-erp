"""Document intelligence for the Vault: text extraction, automatic classification,
field extraction and natural-language search.

Everything here is rule-based and runs locally (no external AI service). The functions are
small and pure so a model-backed classifier or search can be swapped in later.
"""
from __future__ import annotations

import io
import math
import re
import zipfile
from collections import Counter
from datetime import datetime, timedelta, timezone

# --------------------------------------------------------------------- text
TEXT_EXT = {".txt", ".md", ".csv", ".json", ".log", ".html", ".htm", ".xml", ".rtf"}


def extract_text(filename: str, data: bytes) -> str:
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    try:
        if ext in TEXT_EXT:
            return data.decode("utf-8", errors="replace")
        if ext == ".docx":
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                xml = z.read("word/document.xml").decode("utf-8", errors="replace")
            xml = re.sub(r"</w:p>", "\n", xml)
            return re.sub(r"<[^>]+>", "", xml)
        if ext == ".pdf":
            try:
                from pypdf import PdfReader
            except ImportError:
                return ""
            reader = PdfReader(io.BytesIO(data))
            return "\n".join((page.extract_text() or "") for page in reader.pages[:60])
    except Exception:
        return ""
    return ""


# ----------------------------------------------------------- classification
TYPE_RULES: dict[str, list[str]] = {
    "Invoice": ["invoice", "bill to", "amount due", "tax invoice", "gst", "due date", "payment terms", "subtotal"],
    "Contract": ["agreement", "contract", "hereinafter", "parties", "term of", "termination", "governing law", "indemnif", "effective date"],
    "NDA": ["non-disclosure", "nda", "confidential information", "disclosing party", "receiving party"],
    "Purchase Order": ["purchase order", "po number", "ship to", "vendor", "delivery date", "order total", "po-"],
    "HR Document": ["employee", "offer letter", "payroll", "salary", "joining date", "designation", "appraisal", "candidate"],
    "Policy": ["policy", "procedure", "compliance", "scope", "purpose", "responsibilities", "guideline", "must comply"],
    "Financial Report": ["balance sheet", "profit and loss", "revenue", "ebitda", "quarter", "fiscal", "cash flow", "variance"],
    "Meeting Minutes": ["minutes", "attendees", "agenda", "action items", "resolved", "meeting"],
    "Proposal": ["proposal", "quotation", "quote", "scope of work", "pricing", "deliverables", "validity"],
}

TYPE_FOLDER = {
    "Invoice": "Finance", "Financial Report": "Finance", "Contract": "Legal", "NDA": "Legal",
    "Purchase Order": "Procurement", "Proposal": "Sales", "HR Document": "HR",
    "Policy": "Governance", "Meeting Minutes": "Governance", "Other": "General",
}

TYPE_RETENTION = {
    "Invoice": "ret-finance", "Financial Report": "ret-finance", "Contract": "ret-contract", "NDA": "ret-contract",
    "Purchase Order": "ret-procurement", "HR Document": "ret-hr", "Policy": "ret-governance",
    "Meeting Minutes": "ret-governance", "Proposal": "ret-general", "Other": "ret-general",
}

FOLDERS = ["Finance", "Legal", "Procurement", "Sales", "HR", "Governance", "General"]
DOC_TYPES = list(TYPE_RULES) + ["Other"]

STOP = set(
    "the a an and or of to in on for with from by at is are was were be been this that these those it its as not no "
    "show me find all my any please list get give what which who whom where when about into over under above below more less than "
    "document documents doc docs file files".split()
)

MONTHS = "jan feb mar apr may jun jul aug sep oct nov dec".split()


def tokenize(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9][a-z0-9\-]{1,}", text.lower()) if t not in STOP]


def classify(filename: str, text: str) -> dict:
    name = filename.lower().replace("_", " ").replace("-", " ")
    body = text[:6000].lower()
    scores: dict[str, float] = {}
    for doc_type, words in TYPE_RULES.items():
        score = 0.0
        for w in words:
            score += 3 * (w.replace("-", " ") in name) + min(3, body.count(w))
        scores[doc_type] = score
    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    top_type, top = ranked[0]
    total = sum(scores.values())
    if top < 2:
        top_type, confidence = "Other", 0.3
    else:
        confidence = round(min(0.99, 0.4 * (top / total) + 0.6 * min(1.0, top / 8)), 2)
    tags = [top_type.lower()] if top_type != "Other" else []
    years = sorted(set(re.findall(r"\b(20\d{2})\b", filename + " " + body[:1500])))
    tags += years[-1:]
    for ref in re.findall(r"\b(?:INV|PO|SO)-?\d{3,}\b", filename + " " + text[:2000], flags=re.I)[:2]:
        tags.append(ref.upper())
    return {
        "doc_type": top_type,
        "confidence": confidence,
        "tags": list(dict.fromkeys(tags))[:6],
        "folder": TYPE_FOLDER[top_type],
        "retention_policy": TYPE_RETENTION[top_type],
    }


# --------------------------------------------------------------- intelligence
CURRENCY = r"(?:₹|Rs\.?|INR|\$|USD|EUR|€)"
AMOUNT_RE = re.compile(rf"{CURRENCY}\s?[\d,]+(?:\.\d+)?(?:\s?(?:lakhs?|crores?|cr|million|mn|M|K)\b)?", re.I)
DATE_PATTERNS = [
    re.compile(r"\b\d{4}-\d{2}-\d{2}\b"),
    re.compile(r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b"),
    re.compile(r"\b\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?,?\s+\d{4}\b", re.I),
    re.compile(r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b", re.I),
]
PARTY_LABELS = r"(?:Vendor|Supplier|Customer|Client|Bill To|Buyer|Seller|Company|Employee|Candidate|Disclosing Party|Receiving Party|Party A|Party B)"


def parse_amount(token: str) -> float:
    m = re.search(r"([\d,]+(?:\.\d+)?)\s*(lakhs?|crores?|cr|million|mn|m|k)?", token, re.I)
    if not m:
        return 0.0
    value = float(m.group(1).replace(",", "") or 0)
    unit = (m.group(2) or "").lower()
    if unit.startswith("lakh"):
        value *= 1e5
    elif unit.startswith("crore") or unit == "cr":
        value *= 1e7
    elif unit in ("million", "mn", "m"):
        value *= 1e6
    elif unit == "k":
        value *= 1e3
    return value


def intelligence(text: str, doc_type: str) -> dict:
    amounts = list(dict.fromkeys(a.strip().rstrip(",.;") for a in AMOUNT_RE.findall(text)))[:6]
    dates: list[str] = []
    for pat in DATE_PATTERNS:
        dates += pat.findall(text)
    dates = list(dict.fromkeys(dates))[:6]

    parties: list[str] = []
    for m in re.finditer(rf"{PARTY_LABELS}\s*[:\-]\s*([^\n\r(]{{3,70}})", text, re.I):
        parties.append(m.group(1).strip(" .,;"))
    for m in re.finditer(r"between\s+(.{3,70}?)\s+(?:\(|and\b)", text, re.I):
        parties.append(m.group(1).strip(" .,;"))
    parties = [p for p in dict.fromkeys(parties) if len(p) >= 3 and "___" not in p and "authorised" not in p.lower() and "authorized" not in p.lower()][:4]

    refs = list(dict.fromkeys(r.upper() for r in re.findall(r"\b(?:INV|PO|SO|REF|CN|DN)-?\d{3,}\b", text, re.I)))[:5]
    emails = list(dict.fromkeys(re.findall(r"[\w.+-]+@[\w-]+\.[\w.-]+", text)))[:4]

    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n{2,}", text) if len(s.split()) >= 8]
    summary = " ".join(sentences[:2])[:300] if sentences else ""

    counts = Counter(t for t in tokenize(text) if len(t) >= 5 and not t.isdigit())
    key_terms = [w for w, _ in counts.most_common(6)]

    low = text.lower()
    flags: list[dict] = []
    if doc_type in ("Contract", "NDA"):
        if re.search(r"auto(?:matically)?[- ]renew|automatic renewal", low):
            flags.append({"level": "warn", "label": "Auto-renewal clause"})
        if re.search(r"terminat\w*[^.]{0,80}\d+\s*(?:days|months)", low):
            flags.append({"level": "info", "label": "Termination notice period"})
        if re.search(r"penalt|liquidated damages", low):
            flags.append({"level": "warn", "label": "Penalty clause"})
        if "indemnif" in low:
            flags.append({"level": "info", "label": "Indemnity"})
        if "exclusiv" in low:
            flags.append({"level": "warn", "label": "Exclusivity"})
        if "governing law" in low:
            flags.append({"level": "info", "label": "Governing law specified"})
        if not re.search(r"signature|signed by|witness|authorised signatory|authorized signatory", low):
            flags.append({"level": "warn", "label": "No signature block found"})
    if doc_type == "Invoice" and re.search(r"overdue|late fee|interest on delayed", low):
        flags.append({"level": "warn", "label": "Late-payment terms"})
    if doc_type == "Purchase Order" and not amounts:
        flags.append({"level": "warn", "label": "No order value found"})

    return {
        "summary": summary,
        "amounts": amounts,
        "dates": dates,
        "parties": parties,
        "references": refs,
        "emails": emails,
        "keyTerms": key_terms,
        "flags": flags,
        "maxAmount": max((parse_amount(a) for a in amounts), default=0.0),
        "wordCount": len(text.split()),
    }


# ------------------------------------------------------------------- search
TYPE_SYNONYMS = {
    "invoice": "Invoice", "invoices": "Invoice", "bill": "Invoice", "bills": "Invoice",
    "contract": "Contract", "contracts": "Contract", "agreement": "Contract", "agreements": "Contract",
    "nda": "NDA", "ndas": "NDA", "non-disclosure": "NDA",
    "po": "Purchase Order", "pos": "Purchase Order", "purchase order": "Purchase Order", "purchase orders": "Purchase Order",
    "policy": "Policy", "policies": "Policy",
    "minutes": "Meeting Minutes", "meeting": "Meeting Minutes",
    "report": "Financial Report", "reports": "Financial Report",
    "proposal": "Proposal", "proposals": "Proposal", "quotation": "Proposal", "quotations": "Proposal", "quote": "Proposal",
    "offer letter": "HR Document", "offer letters": "HR Document", "payroll": "HR Document",
}

STATUS_PHRASES = [
    (r"\b(?:awaiting|needs?|pending|waiting for)\s+(?:e-?)?signatures?\b|\bunsigned\b|\bnot signed\b|\bto sign\b", "Awaiting signature"),
    (r"\b(?:pending|awaiting|needs?|waiting for)\s+approval\b|\bunapproved\b", "Pending approval"),
    (r"\bsigned\b", "Signed"),
    (r"\bapproved\b", "Approved"),
    (r"\brejected\b", "Rejected"),
    (r"\bdrafts?\b", "Draft"),
    (r"\barchived\b", "Archived"),
]

AMOUNT_FILTER = re.compile(
    r"\b(above|over|more than|greater than|exceeding|below|under|less than)\s*(?:₹|rs\.?|inr|\$)?\s*([\d,]+(?:\.\d+)?)\s*(lakhs?|l|crores?|cr|million|m|k)?\b",
    re.I,
)


def _period(phrase: str, now: datetime) -> tuple[datetime | None, datetime | None]:
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    first_this_month = today.replace(day=1)
    if phrase == "today":
        return today, None
    if phrase == "yesterday":
        return today - timedelta(days=1), today
    if phrase == "this week":
        return today - timedelta(days=today.weekday()), None
    if phrase == "last week":
        start = today - timedelta(days=today.weekday() + 7)
        return start, start + timedelta(days=7)
    if phrase == "this month":
        return first_this_month, None
    if phrase == "last month":
        prev_end = first_this_month
        prev_start = (first_this_month - timedelta(days=1)).replace(day=1)
        return prev_start, prev_end
    if phrase == "this year":
        return today.replace(month=1, day=1), None
    if phrase == "last 7 days":
        return today - timedelta(days=7), None
    if phrase == "last 30 days":
        return today - timedelta(days=30), None
    return None, None


PERIODS = ["last 30 days", "last 7 days", "this year", "last month", "this month", "last week", "this week", "yesterday", "today"]


def parse_query(query: str, now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    q = " " + query.lower().strip() + " "
    chips: list[dict] = []
    filters: dict = {"types": set(), "statuses": set(), "min_amount": None, "max_amount": None, "since": None, "until": None, "expiring": False}

    for pattern, status in STATUS_PHRASES:
        if re.search(pattern, q):
            filters["statuses"].add(status)
            chips.append({"kind": "status", "label": status})
            q = re.sub(pattern, " ", q)
    if re.search(r"\bexpir(?:ed|ing|es)\b|retention due|due for disposal", q):
        filters["expiring"] = True
        chips.append({"kind": "retention", "label": "Retention expiring"})
        q = re.sub(r"\bexpir(?:ed|ing|es)\b|retention due|due for disposal", " ", q)

    m = AMOUNT_FILTER.search(q)
    if m:
        value = parse_amount(f"{m.group(2)} {'lakh' if (m.group(3) or '').lower() == 'l' else (m.group(3) or '')}")
        if m.group(1).lower() in ("above", "over", "more than", "greater than", "exceeding"):
            filters["min_amount"] = value
            chips.append({"kind": "amount", "label": f"Amount above {value:,.0f}"})
        else:
            filters["max_amount"] = value
            chips.append({"kind": "amount", "label": f"Amount below {value:,.0f}"})
        q = q.replace(m.group(0), " ")

    rel = re.search(r"\b(?:in the |over the )?(?:last|past)\s+(\d+)\s+(day|week|month|year)s?\b", q)
    if rel:
        span = int(rel.group(1)) * {"day": 1, "week": 7, "month": 30, "year": 365}[rel.group(2)]
        filters["since"] = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=span)
        chips.append({"kind": "time", "label": f"Last {rel.group(1)} {rel.group(2)}{'s' if int(rel.group(1)) != 1 else ''}"})
        q = q.replace(rel.group(0), " ")

    for phrase in ([] if rel else PERIODS):
        if f" {phrase} " in q or q.strip().endswith(phrase):
            filters["since"], filters["until"] = _period(phrase, now)
            chips.append({"kind": "time", "label": phrase.capitalize()})
            q = q.replace(phrase, " ")
            break

    for phrase in sorted(TYPE_SYNONYMS, key=len, reverse=True):
        if re.search(rf"(?<![\w-]){re.escape(phrase)}(?![\w-])", q):
            doc_type = TYPE_SYNONYMS[phrase]
            if doc_type not in filters["types"]:
                filters["types"].add(doc_type)
                chips.append({"kind": "type", "label": doc_type})
            q = re.sub(rf"(?<![\w-]){re.escape(phrase)}(?![\w-])", " ", q)

    terms = [t for t in tokenize(q) if t not in {"last", "this", "week", "month", "year", "days", "day", "from", "since"}]
    return {"filters": filters, "terms": terms, "chips": chips}


def search(docs: list[dict], parsed: dict, now: datetime | None = None) -> list[dict]:
    """docs: dicts with title, filename, tags (list), doc_type, text_content, status, extracted(dict),
    created_at, updated_at (ISO), retention_until (ISO or None)."""
    f = parsed["filters"]
    terms = parsed["terms"]
    now = now or datetime.now(timezone.utc)
    horizon = now + timedelta(days=90)

    def iso(value: str | None) -> datetime | None:
        if not value:
            return None
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None

    pool = []
    for d in docs:
        if f["types"] and d["doc_type"] not in f["types"]:
            continue
        if f["statuses"] and d["status"] not in f["statuses"]:
            continue
        amount = (d.get("extracted") or {}).get("maxAmount", 0)
        if f["min_amount"] is not None and amount < f["min_amount"]:
            continue
        if f["max_amount"] is not None and not (0 < amount <= f["max_amount"]):
            continue
        created = iso(d["created_at"])
        if f["since"] and created and created < f["since"]:
            continue
        if f["until"] and created and created >= f["until"]:
            continue
        if f["expiring"]:
            until = iso(d.get("retention_until"))
            if not until or until > horizon:
                continue
        pool.append(d)

    if not terms:
        return [{**d, "score": 0.0, "snippet": "", "matched": []} for d in pool]

    weighted: list[list[str]] = []
    for d in pool:
        tokens = (
            tokenize(d["title"]) * 3
            + [t for tag in d["tags"] for t in tokenize(tag)] * 2
            + tokenize(d["doc_type"]) * 2
            + tokenize(d["filename"])
            + tokenize(d["text_content"])
        )
        weighted.append(tokens)
    n = len(pool) or 1
    avg_len = sum(len(t) for t in weighted) / n or 1
    df: Counter = Counter()
    for tokens in weighted:
        seen = set(tokens)
        for term in terms:
            if any(tok == term or (len(term) >= 3 and tok.startswith(term)) for tok in seen):
                df[term] += 1

    results = []
    k1, b = 1.4, 0.75
    for d, tokens in zip(pool, weighted):
        counts = Counter(tokens)
        score = 0.0
        matched = []
        for term in terms:
            tf = counts.get(term, 0) + 0.6 * sum(c for tok, c in counts.items() if tok != term and len(term) >= 3 and tok.startswith(term))
            if not tf:
                continue
            idf = math.log(1 + (n - df[term] + 0.5) / (df[term] + 0.5))
            score += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * len(tokens) / avg_len))
            matched.append(term)
        if not matched:
            continue
        coverage = len(matched) / len(terms)
        score *= 0.5 + 0.5 * coverage
        text = d["text_content"]
        snippet = ""
        low = text.lower()
        for term in matched:
            idx = low.find(term)
            if idx >= 0:
                start = max(0, idx - 70)
                snippet = ("…" if start else "") + " ".join(text[start: idx + 110].split()) + "…"
                break
        results.append({**d, "score": round(score, 3), "snippet": snippet, "matched": matched})
    results.sort(key=lambda r: r["score"], reverse=True)
    return results
