import os
import json
from fastapi.testclient import TestClient
from main import app
from database import engine, SessionLocal, Base
from seed import run_seed

client = TestClient(app)

def test_full_workflow():
    # Ensure tables are seeded
    run_seed()

    # 1. Login with Organizer credentials
    login_resp = client.post("/auth/login", json={
        "email": "organizer@organice.local",
        "password": "password123"
    })
    assert login_resp.status_code == 200, login_resp.text
    data = login_resp.json()
    assert "token" in data
    assert data["user"]["role"] == "Organizer"
    token = data["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get /me
    me_resp = client.get("/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "organizer@organice.local"

    # 3. Dashboard
    dash_resp = client.get("/dashboard", headers=headers)
    assert dash_resp.status_code == 200
    dash_data = dash_resp.json()
    assert "metrics" in dash_data
    assert dash_data["metrics"]["totalEvents"] >= 3
    assert dash_data["metrics"]["totalBudget"] > 0
    assert len(dash_data["events"]) >= 3
    assert len(dash_data["tasks"]) >= 5

    # 4. List Events
    events_resp = client.get("/events", headers=headers)
    assert events_resp.status_code == 200
    events = events_resp.json()
    assert len(events) >= 3
    first_event_id = events[0]["id"]

    # 5. Get Event Details
    ev_detail = client.get(f"/events/{first_event_id}", headers=headers)
    assert ev_detail.status_code == 200
    ev_data = ev_detail.json()
    assert "event" in ev_data
    assert "tasks" in ev_data
    assert "budget" in ev_data
    assert "schedules" in ev_data
    assert "risks" in ev_data

    # 6. AI Event Planner
    ai_resp = client.post("/ai/plan", json={
        "prompt": "Create a 2-day technical fest for 500 students with workshops, competitions and a closing ceremony."
    }, headers=headers)
    assert ai_resp.status_code == 200, ai_resp.text
    ai_result = ai_resp.json()
    assert "event" in ai_result
    assert "timeline" in ai_result
    assert len(ai_result["timeline"]) >= 5
    ai_event_id = ai_result["event"]["id"]
    assert ai_event_id is not None

    # 7. AI Copilot Queries
    copilot_budget = client.post("/copilot", json={
        "prompt": "Will we exceed the budget?",
        "event_id": first_event_id
    }, headers=headers)
    assert copilot_budget.status_code == 200
    assert "budget" in copilot_budget.json()["answer"].lower()

    copilot_tasks = client.post("/copilot", json={
        "prompt": "Which tasks need attention?",
        "event_id": first_event_id
    }, headers=headers)
    assert copilot_tasks.status_code == 200
    assert "task" in copilot_tasks.json()["answer"].lower()

    # 8. Schedules & Conflicts
    sched_resp = client.get(f"/schedules?event_id={first_event_id}", headers=headers)
    assert sched_resp.status_code == 200
    schedules = sched_resp.json()
    has_conflict = any(s.get("conflict_flag") for s in schedules)
    assert has_conflict, "Expected intentional conflict in seeded schedules"

    # 9. Apply AI Recommendation
    recs_resp = client.get(f"/recommendations?event_id={first_event_id}", headers=headers)
    assert recs_resp.status_code == 200
    recs = recs_resp.json()
    assert len(recs) > 0
    first_rec = recs[0]
    apply_resp = client.post(f"/recommendations/{first_rec['id']}/apply", headers=headers)
    assert apply_resp.status_code == 200
    assert apply_resp.json()["status"] == "Applied"

    # 10. Tasks Management
    tasks_resp = client.get(f"/tasks?event_id={first_event_id}", headers=headers)
    assert tasks_resp.status_code == 200
    tasks_list = tasks_resp.json()
    first_task = tasks_list[0]
    # Mark task Done
    patch_task = client.patch(f"/tasks/{first_task['id']}", json={"status": "Done"}, headers=headers)
    assert patch_task.status_code == 200
    assert patch_task.json()["status"] == "Done"

    # 11. Dynamic Budget & Expenses
    budget_ledger = client.get(f"/budgets/{first_event_id}", headers=headers)
    assert budget_ledger.status_code == 200
    b_data = budget_ledger.json()
    initial_spent = b_data["actual_spend"]

    # Add new expense
    new_expense = client.post("/expenses", json={
        "event_id": first_event_id,
        "category_id": b_data["categories"][0]["id"] if b_data["categories"] else None,
        "title": "Stage Flex Banner Printing",
        "amount": 4500.0,
        "payment_status": "Paid",
        "date": "2026-09-11"
    }, headers=headers)
    assert new_expense.status_code == 200

    # Verify recalculation
    budget_after = client.get(f"/budgets/{first_event_id}", headers=headers).json()
    assert budget_after["actual_spend"] == initial_spent + 4500.0

    # 12. Faculty Approval Flow
    # Submit event
    submit_resp = client.post(f"/approvals/{ai_event_id}/submit", headers=headers)
    assert submit_resp.status_code == 200

    # Login as Faculty Coordinator
    fac_login = client.post("/auth/login", json={
        "email": "faculty@organice.local",
        "password": "password123"
    })
    assert fac_login.status_code == 200
    fac_token = fac_login.json()["token"]
    fac_headers = {"Authorization": f"Bearer {fac_token}"}

    # Faculty approves event
    decide_resp = client.post(f"/approvals/{ai_event_id}/decide", json={
        "status": "Approved",
        "comments": "Approved. Excellent blueprint with balanced logistics and technical tracks."
    }, headers=fac_headers)
    assert decide_resp.status_code == 200
    assert decide_resp.json()["status"] == "Approved"

    # Verify event status updated in DB
    updated_ev = client.get(f"/events/{ai_event_id}", headers=headers).json()
    assert updated_ev["event"]["status"] == "Approved"

    # 13. Reports: PDF & CSV
    pdf_resp = client.get(f"/reports/pdf/{first_event_id}", headers=headers)
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert len(pdf_resp.content) > 1000  # Valid binary PDF

    csv_resp = client.get("/reports/csv/events", headers=headers)
    assert csv_resp.status_code == 200
    assert "TechFest 2.0" in csv_resp.text

    csv_budget = client.get(f"/reports/csv/budget?event_id={first_event_id}", headers=headers)
    assert csv_budget.status_code == 200

    # 14. History / Audit Log
    history_resp = client.get("/history", headers=headers)
    assert history_resp.status_code == 200
    history_items = history_resp.json()
    assert len(history_items) >= 4

    print("\n[SUCCESS] All 14 test suites passed end-to-end against real PostgreSQL 18!")

if __name__ == "__main__":
    test_full_workflow()
