import csv
import io
import os
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import StreamingResponse

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "zapout.db")

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


def verify_token(authorization: str = Header(None)) -> int:
    """Verify token and return user_id"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")

    token = authorization.replace("Bearer ", "")

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT user_id, expires_at FROM tokens WHERE token = ?", (token,))
    row = c.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id, expires_at = row

    # Check token expiration
    if expires_at:
        exp = datetime.fromisoformat(expires_at)
        if datetime.now(timezone.utc) > exp:
            raise HTTPException(status_code=401, detail="Token expired")

    return user_id


def get_db_transactions():
    """Get transactions database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ──────────────────────────────────────────────
# ENDPOINT 1: Transaction History (MVP)
# GET /api/transactions/
# ──────────────────────────────────────────────
@router.get("/")
async def get_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("created_at"),
    sort_order: Optional[str] = Query("desc"),
    user_id: int = Depends(verify_token),
):
    """
    Paginierte Transaction History mit Filter & Suche.
    """
    conn = get_db_transactions()
    cursor = conn.cursor()

    # Build query
    conditions = ["user_id = ?"]
    params = [user_id]

    if search:
        conditions.append("(description LIKE ? OR recipient LIKE ?)")
        params.extend([f"%{search}%", f"%{search}%"])

    if type and type != "all":
        conditions.append("type = ?")
        params.append(type)

    if status:
        conditions.append("status = ?")
        params.append(status)

    if date_from:
        conditions.append("created_at >= ?")
        params.append(date_from)

    if date_to:
        conditions.append("created_at <= ?")
        params.append(date_to)

    where_clause = " AND ".join(conditions)

    # Get total count
    cursor.execute(f"SELECT COUNT(*) FROM transactions WHERE {where_clause}", params)
    total = cursor.fetchone()[0]

    # Get transactions with pagination
    order = "DESC" if sort_order == "desc" else "ASC"
    offset = (page - 1) * limit

    query = f"""
        SELECT * FROM transactions
        WHERE {where_clause}
        ORDER BY {sort_by} {order}
        LIMIT ? OFFSET ?
    """
    params.extend([limit, offset])

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    transactions = [dict(row) for row in rows]

    return {
        "transactions": transactions,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit if total > 0 else 0,
        },
    }


# ──────────────────────────────────────────────
# ENDPOINT 2: Transaction Summary/Stats (MVP)
# GET /api/transactions/summary
# ──────────────────────────────────────────────
@router.get("/summary")
async def get_transaction_summary(
    period: str = Query("month", regex="^(week|month|year)$"), user_id: int = Depends(verify_token)
):
    """Zusammenfassung: Gesamtausgaben, Einnahmen, Anzahl."""

    conn = get_db_transactions()
    cursor = conn.cursor()

    now = datetime.now()
    period_map = {
        "week": now - timedelta(days=7),
        "month": now - timedelta(days=30),
        "year": now - timedelta(days=365),
    }
    start_date = period_map.get(period, now - timedelta(days=30))

    cursor.execute(
        """
        SELECT type, amount, COUNT(*) as count
        FROM transactions
        WHERE user_id = ? AND created_at >= ? AND status = 'completed'
        GROUP BY type
    """,
        (user_id, start_date.isoformat()),
    )

    results = {row[0]: {"amount": row[1], "count": row[2]} for row in cursor.fetchall()}
    conn.close()

    total_sent = results.get("send", {}).get("amount", 0)
    total_received = results.get("receive", {}).get("amount", 0)
    tx_count = results.get("send", {}).get("count", 0) + results.get("receive", {}).get("count", 0)

    return {
        "period": period,
        "total_sent": total_sent,
        "total_received": total_received,
        "net": total_received - total_sent,
        "transaction_count": tx_count,
        "avg_transaction": (total_sent + total_received) / tx_count if tx_count > 0 else 0,
    }


# ──────────────────────────────────────────────
# ENDPOINT 3: CSV Export (MVP)
# GET /api/transactions/export/csv
# ──────────────────────────────────────────────
@router.get("/export/csv")
async def export_csv(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user_id: int = Depends(verify_token),
):
    """Export transactions as CSV."""

    conn = get_db_transactions()
    cursor = conn.cursor()

    conditions = ["user_id = ?"]
    params = [user_id]

    if date_from:
        conditions.append("created_at >= ?")
        params.append(date_from)
    if date_to:
        conditions.append("created_at <= ?")
        params.append(date_to)

    where_clause = " AND ".join(conditions)

    cursor.execute(
        f"""
        SELECT * FROM transactions
        WHERE {where_clause}
        ORDER BY created_at DESC
    """,
        params,
    )

    rows = cursor.fetchall()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        ["Datum", "Typ", "Betrag (sats)", "Empfänger", "Beschreibung", "Methode", "Status"]
    )

    for row in rows:
        writer.writerow(
            [
                row["created_at"],
                "Gesendet" if row["type"] == "send" else "Empfangen",
                row["amount"],
                row["recipient"] or "-",
                row["description"] or "-",
                row["payment_method"],
                row["status"],
            ]
        )

    output.seek(0)
    filename = f"zapout_export_{datetime.now().strftime('%Y%m%d')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ──────────────────────────────────────────────
# ENDPOINT 4: Create Transaction (for testing)
# POST /api/transactions/
# ──────────────────────────────────────────────
@router.post("/")
async def create_transaction(
    type: str,
    amount: int,
    description: Optional[str] = None,
    recipient: Optional[str] = None,
    payment_method: str = "lightning",
    user_id: int = Depends(verify_token),
):
    """Create a new transaction (for testing)."""

    conn = get_db_transactions()
    cursor = conn.cursor()

    cursor.execute(
        """
        INSERT INTO transactions (user_id, type, amount, recipient, description, payment_method, status)
        VALUES (?, ?, ?, ?, ?, ?, 'completed')
    """,
        (user_id, type, amount, recipient, description, payment_method),
    )

    tx_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return {"id": tx_id, "status": "created"}
