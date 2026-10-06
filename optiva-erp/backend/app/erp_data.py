"""Business data served to the dashboard.

The figures are deterministic sample data for the Optiva demo company. Everything that
a user can change (workflow status, enabled modules) is read from / written to SQLite.
"""
from __future__ import annotations

from datetime import date, timedelta

from .db import connect

RANGES = {"7d": (7, 1, 830_000, 7), "30d": (30, 1, 810_000, 30), "90d": (13, 7, 5_650_000, 90)}


def _rng(seed: int):
    state = seed

    def next_value() -> float:
        nonlocal state
        state = (state * 1664525 + 1013904223) % 4294967296
        return state / 4294967296

    return next_value


def inr(value: int) -> str:
    """Format a rupee amount with Indian digit grouping (12,34,567)."""
    s = str(abs(value))
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        s = ",".join(parts + [tail])
    return ("-" if value < 0 else "") + "₹" + s


def _short(d: date) -> str:
    return f"{d.strftime('%b')} {d.day}"


def activity(range_key: str) -> list[dict]:
    n, step, base, seed = RANGES[range_key]
    rng = _rng(seed)
    today = date.today()
    out = []
    for i in range(n):
        d = today - timedelta(days=(n - 1 - i) * step)
        weekend = step == 1 and d.weekday() >= 5
        growth = 0.9 + (i / n) * 0.2
        invoiced = round(base * growth * (0.55 if weekend else 1) * (0.86 + rng() * 0.28))
        overdue = round(invoiced * (0.05 + rng() * 0.05))
        pending = round(invoiced * (0.03 + rng() * 0.03))
        collected = invoiced - overdue - pending
        label = d.strftime("%a")
        title = d.strftime("%A, %b ") + str(d.day)
        if range_key == "30d":
            label = _short(d)
        if range_key == "90d":
            start = d - timedelta(days=6)
            label = _short(start)
            title = f"{_short(start)} – {_short(d)}"
        out.append({"label": label, "title": title, "invoiced": invoiced, "collected": collected, "overdue": overdue})
    return out


def kpis() -> list[dict]:
    return [
        {"id": "revenue", "icon": "revenue", "label": "Revenue", "value": "₹24.8M", "delta": "+18.4%", "direction": "up", "good": True,
         "note": "vs last 30 days", "spark": [16.2, 17.1, 17.6, 18.9, 19.4, 20.8, 21.3, 22.6, 23.1, 24.0, 24.8]},
        {"id": "orders", "icon": "orders", "label": "Sales Orders", "value": "8,426", "delta": "+11.2%", "direction": "up", "good": True,
         "note": "vs last 30 days", "spark": [6.1, 6.4, 6.8, 7.0, 7.3, 7.1, 7.6, 7.9, 8.0, 8.2, 8.4]},
        {"id": "receivables", "icon": "receivables", "label": "Receivables", "value": "₹3.2M", "delta": "-7.8%", "direction": "down", "good": True,
         "note": "vs last 30 days", "spark": [4.1, 4.0, 3.9, 3.9, 3.7, 3.6, 3.5, 3.5, 3.4, 3.3, 3.2]},
        {"id": "inventory", "icon": "inventory", "label": "Inventory Value", "value": "₹18.6M", "delta": "+2.3%", "direction": "up", "good": True,
         "note": "vs last 30 days", "spark": [17.4, 17.5, 17.9, 17.8, 18.0, 18.1, 18.0, 18.3, 18.4, 18.5, 18.6]},
        {"id": "fulfilment", "icon": "fulfilment", "label": "Fulfilment Rate", "value": "94.3%", "delta": "+1.2 pts", "direction": "up", "good": True,
         "note": "vs last 30 days", "spark": [91.8, 92.1, 92.0, 92.6, 93.0, 93.1, 93.4, 93.6, 93.9, 94.1, 94.3]},
    ]


def module_performance() -> list[dict]:
    rows = [
        ("finance", "Finance & Accounting", "Month-end close, invoicing and payments", 98.6, 3412),
        ("sales", "Sales & CRM", "Quotes, orders and pipeline", 97.4, 2906),
        ("inventory", "Inventory", "Stock moves and replenishment", 95.9, 2188),
        ("procurement", "Procurement", "Requisitions and purchase orders", 93.7, 1322),
        ("people", "Human Resources", "Leave, attendance and payroll", 91.2, 964),
    ]
    return [{"id": i, "name": n, "description": d, "score": s, "transactions": t} for i, n, d, s, t in rows]


def orders() -> list[dict]:
    rows = [
        ("SO-20418", "Northwind Traders", "Hydraulic pumps · 24 units", 420_000, "Delivered", "Today, 10:42"),
        ("SO-20417", "Kestrel Industries", "Control panels · 8 units", 1_285_000, "Processing", "Today, 09:15"),
        ("SO-20414", "Brightfield Retail", "Packaging film · 120 rolls", 318_500, "Awaiting payment", "Yesterday"),
        ("SO-20409", "Meridian Logistics", "Pallet racking · 40 units", 765_000, "Delivered", "Yesterday"),
        ("SO-20402", "Lakeshore Foods", "Cold-chain sensors · 60 units", 192_400, "On hold", "Oct 1"),
    ]
    return [{"id": i, "customer": c, "items": it, "amount": inr(a), "status": s, "date": d} for i, c, it, a, s, d in rows]


def feed() -> list[dict]:
    return [
        {"id": "e1", "icon": "paid", "tone": "ok", "title": "Invoice INV-20418 paid by Northwind Traders", "detail": "₹4,20,000 received and matched to the open receivable", "time": "4 min ago"},
        {"id": "e2", "icon": "approval", "tone": "warn", "title": "Purchase order PO-88214 needs approval", "detail": "Requested by Procurement, value ₹6,80,000", "time": "18 min ago"},
        {"id": "e3", "icon": "stock", "tone": "coral", "title": "Stock below reorder level", "detail": "Hydraulic Pump HP-220 has 14 units left in Warehouse B", "time": "32 min ago"},
        {"id": "e4", "icon": "payroll", "tone": "brand", "title": "September payroll run completed", "detail": "312 employees paid, no exceptions", "time": "1 hr ago"},
        {"id": "e5", "icon": "report", "tone": "neutral", "title": "Q3 revenue report generated", "detail": "14 pages, shared with Finance leadership", "time": "2 hr ago"},
        {"id": "e6", "icon": "support", "tone": "coral", "title": "Support SLA at risk on ticket #5521", "detail": "Assigned to Customer Service, due in 40 minutes", "time": "3 hr ago"},
    ]


WORKFLOW_DEFS = [
    {
        "id": "wf-invoice",
        "name": "Invoice Approval",
        "description": "Reads supplier invoices, matches them to purchase orders and routes exceptions for approval.",
        "trigger": "Supplier invoice received",
        "steps": ["Capture fields", "Match PO", "Route approval", "Post to ledger"],
        "runsThisWeek": 1284, "success": "98.6%", "lastRun": "3 min ago",
    },
    {
        "id": "wf-po",
        "name": "Requisition to Purchase Order",
        "description": "Turns approved purchase requests into purchase orders and notifies the chosen supplier.",
        "trigger": "Purchase request approved",
        "steps": ["Check budget", "Select supplier", "Create PO", "Notify supplier"],
        "runsThisWeek": 642, "success": "97.9%", "lastRun": "Just now",
    },
    {
        "id": "wf-replenish",
        "name": "Low-stock Replenishment",
        "description": "Watches reorder levels across warehouses and raises replenishment requests automatically.",
        "trigger": "Stock falls below reorder level",
        "steps": ["Check demand", "Draft request", "Assign buyer", "Alert warehouse"],
        "runsThisWeek": 0, "success": "96.4%", "lastRun": "Oct 2, 6:40 PM",
    },
]


def workflows() -> list[dict]:
    with connect() as conn:
        state = {r["id"]: r["status"] for r in conn.execute("SELECT id, status FROM workflow_state")}
    return [{**w, "status": state.get(w["id"], "Paused")} for w in WORKFLOW_DEFS]


def set_workflow_status(workflow_id: str, status: str) -> dict | None:
    if workflow_id not in {w["id"] for w in WORKFLOW_DEFS}:
        return None
    with connect() as conn:
        conn.execute("UPDATE workflow_state SET status = ? WHERE id = ?", (status, workflow_id))
    return next(w for w in workflows() if w["id"] == workflow_id)


def insights() -> list[dict]:
    return [
        {"id": "i1", "icon": "revenue", "title": "Revenue is up 18.4% on last month", "body": "Distribution and Manufacturing accounts drove most of the growth.", "action": "View revenue report"},
        {"id": "i2", "icon": "receivables", "title": "Receivables fell 7.8% as collections sped up", "body": "Average days to collect dropped from 38 to 33.", "action": "See collections"},
        {"id": "i3", "icon": "approval", "title": "3 purchase orders are waiting for approval", "body": "Together they hold ₹17.2L of committed spend.", "action": "Review approvals"},
    ]


ADDON_DEFS = [
    {"id": "mod-manufacturing", "name": "Manufacturing", "category": "Operations", "icon": "factory",
     "description": "Bills of materials, work orders and shop-floor tracking tied to stock and costing.", "rating": 4.8, "customers": "1.2K"},
    {"id": "mod-projects", "name": "Projects & Billing", "category": "Services", "icon": "projects",
     "description": "Plan projects, log time and expenses, and invoice clients from the same record.", "rating": 4.7, "customers": "980"},
    {"id": "mod-analytics", "name": "Advanced Analytics", "category": "Insight", "icon": "analytics",
     "description": "Self-serve dashboards, scheduled reports and forecasts across every module.", "rating": 4.9, "customers": "2.1K"},
    {"id": "mod-commerce", "name": "E-commerce Connector", "category": "Sales", "icon": "commerce",
     "description": "Sync online orders, stock levels and customers with your storefront in near real time.", "rating": 4.6, "customers": "760"},
]


def addons() -> list[dict]:
    with connect() as conn:
        state = {r["id"]: bool(r["enabled"]) for r in conn.execute("SELECT id, enabled FROM module_state")}
    return [{**m, "enabled": state.get(m["id"], False)} for m in ADDON_DEFS]


def enable_addon(module_id: str) -> dict | None:
    if module_id not in {m["id"] for m in ADDON_DEFS}:
        return None
    with connect() as conn:
        conn.execute(
            "INSERT INTO module_state (id, enabled) VALUES (?, 1) ON CONFLICT(id) DO UPDATE SET enabled = 1",
            (module_id,),
        )
    return next(m for m in addons() if m["id"] == module_id)


def notifications() -> list[dict]:
    return [
        {"id": "n1", "title": "3 approvals need your review", "time": "5 min ago", "unread": True},
        {"id": "n2", "title": "Stock below reorder level: HP-220", "time": "32 min ago", "unread": True},
        {"id": "n3", "title": "Monthly close checklist is 80% complete", "time": "Yesterday", "unread": False},
        {"id": "n4", "title": "September payroll run completed", "time": "Yesterday", "unread": False},
    ]
