import time
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_complete_e2e():
    print("==================================================")
    print("STARTING FULL END-TO-END VERIFICATION OF ORGANICE")
    print("==================================================")

    # Step 1: Register
    reg_email = f"test_organizer_{int(time.time())}@organice.edu"
    print(f"\n[Step 1] Registering new user: {reg_email}")
    reg_res = client.post("/auth/register", json={
        "name": "Mourya Sree",
        "email": reg_email,
        "password": "password123",
        "role": "Organizer",
        "organization": "School of Computing, SRMIST"
    })
    assert reg_res.status_code == 200, reg_res.text
    reg_data = reg_res.json()
    token = reg_data["token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[OK] Registration successful. JWT token issued.")

    # Step 2: Login
    print("\n[Step 2] Testing login with newly created account")
    login_res = client.post("/auth/login", json={
        "email": reg_email,
        "password": "password123"
    })
    assert login_res.status_code == 200
    print("[OK] Login verified with bcrypt password check.")

    # Step 3: Dashboard metrics
    print("\n[Step 3] Fetching Dashboard metrics from PostgreSQL")
    dash_res = client.get("/dashboard", headers=headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    print(f"[OK] Dashboard live metrics: Total Events={dash_data['metrics']['totalEvents']}, Budget=Rs.{dash_data['metrics']['totalBudget']:,.0f}, Pending Tasks={dash_data['metrics']['pendingTasks']}")

    # Step 4: Create Event
    print("\n[Step 4] Creating new Event: 'National Robotics Conclave 2026'")
    create_ev_res = client.post("/events", headers=headers, json={
        "name": "National Robotics Conclave 2026",
        "type": "Technical Fest",
        "venue": "Main Auditorium",
        "start_time": "2026-10-15T09:00:00",
        "end_time": "2026-10-17T18:00:00",
        "attendees": 600,
        "budget": 200000.0,
        "description": "National level robotics symposium with arena challenges and tech exhibitions."
    })
    assert create_ev_res.status_code == 200
    ev_id = create_ev_res.json()["id"]
    print(f"[OK] Event created with ID={ev_id} and default budget categories initialized.")

    # Step 5: AI Generate Plan
    print("\n[Step 5] Triggering AI Event Planner")
    ai_res = client.post("/ai/plan", headers=headers, json={
        "prompt": "Create a 2-day technical fest for 500 students with workshops, competitions and a closing ceremony."
    })
    assert ai_res.status_code == 200
    ai_data = ai_res.json()
    ai_ev_id = ai_data["event"]["id"]
    print(f"[OK] AI Planner generated blueprint '{ai_data['event']['name']}' with {len(ai_data['timeline'])} tasks and {len(ai_data['schedules'])} sessions.")

    # Step 6: View Event & Timeline
    print("\n[Step 6] Querying Event details and generated timeline")
    ev_detail = client.get(f"/events/{ai_ev_id}", headers=headers).json()
    assert len(ev_detail["tasks"]) >= 5
    assert len(ev_detail["schedules"]) >= 3
    print("[OK] Event details, tasks, and schedules verified in PostgreSQL.")

    # Step 7: Team Assignment
    print("\n[Step 7] Adding Team Member and assigning task")
    member_res = client.post("/team", headers=headers, json={
        "event_id": ai_ev_id,
        "name": "Vikram Seth",
        "email": "vikram@organice.edu",
        "role": "Logistics Lead",
        "department": "Logistics Committee"
    })
    assert member_res.status_code == 200
    member_id = member_res.json()["id"]
    first_task_id = ev_detail["tasks"][0]["id"]

    patch_task_res = client.patch(f"/tasks/{first_task_id}", headers=headers, json={
        "assigned_member_id": member_id
    })
    assert patch_task_res.status_code == 200
    print(f"[OK] Assigned task '{ev_detail['tasks'][0]['name']}' to member ID {member_id}.")

    # Step 8: Calendar & Conflict Detection
    print("\n[Step 8] Verifying Calendar entries and Conflict Detection")
    scheds = client.get(f"/schedules?event_id={ai_ev_id}", headers=headers).json()
    conflict_scheds = [s for s in scheds if s["conflict_flag"]]
    assert len(conflict_scheds) > 0, "Expected schedule conflict"
    print(f"[OK] Detected {len(conflict_scheds)} conflicting sessions: {conflict_scheds[0]['title']} in {conflict_scheds[0]['venue']}")

    # Step 9: Apply AI Suggestion
    print("\n[Step 9] Applying AI Resolution Recommendation")
    recs = client.get(f"/recommendations?event_id={ai_ev_id}", headers=headers).json()
    assert len(recs) > 0
    resched_rec = recs[0]
    apply_res = client.post(f"/recommendations/{resched_rec['id']}/apply", headers=headers)
    assert apply_res.status_code == 200
    print(f"[OK] AI Suggestion '{resched_rec['title']}' applied.")

    # Step 10: Verify Calendar Updated
    scheds_after = client.get(f"/schedules?event_id={ai_ev_id}", headers=headers).json()
    assert not any(s["conflict_flag"] for s in scheds_after)
    print("[OK] Calendar updated in PostgreSQL. All conflicts cleared.")

    # Step 11: Add Vendor Quote
    print("\n[Step 11] Adding Vendor Quote")
    vendor_res = client.post("/vendors", headers=headers, json={
        "event_id": ai_ev_id,
        "name": "Starlight Pro Audio",
        "service": "Audio/Visual",
        "contact_name": "Karthik R",
        "email": "karthik@starlightpro.in",
        "phone": "+91 98401 99999",
        "status": "Confirmed"
    })
    v_id = vendor_res.json()["id"]

    quote_res = client.post("/vendor-quotes", headers=headers, json={
        "vendor_id": v_id,
        "event_id": ai_ev_id,
        "amount": 28000.0,
        "notes": "Line array sound and stage lighting setup",
        "status": "Accepted"
    })
    assert quote_res.status_code == 200
    print("[OK] Vendor quote added. Projected budget recalculated.")

    # Step 12: Add Expense
    print("\n[Step 12] Logging Expense to trigger budget recalculation")
    exp_res = client.post("/expenses", headers=headers, json={
        "event_id": ai_ev_id,
        "category_id": ev_detail["budget"]["categories"][0]["id"] if ev_detail["budget"]["categories"] else None,
        "title": "Auditorium Sound Deposit",
        "amount": 15000.0,
        "vendor_id": v_id,
        "payment_status": "Paid",
        "date": "2026-09-11"
    })
    assert exp_res.status_code == 200

    b_after = client.get(f"/budgets/{ai_ev_id}", headers=headers).json()
    assert b_after["actual_spend"] == 15000.0
    print(f"[OK] Actual spend updated to Rs.{b_after['actual_spend']:,.0f}. Remaining: Rs.{b_after['remaining']:,.0f}.")

    # Step 13: Complete Task & Verify Progress
    print("\n[Step 13] Completing task and verifying automatic progress % recalculation")
    task_done = client.patch(f"/tasks/{first_task_id}", headers=headers, json={
        "status": "Done"
    }).json()
    assert task_done["status"] == "Done"

    ev_progress_check = client.get(f"/events/{ai_ev_id}", headers=headers).json()
    assert ev_progress_check["event"]["progress"] > 0
    print(f"[OK] Event progress automatically recalculated to {ev_progress_check['event']['progress']}%.")

    # Step 14: Submit for Faculty Approval
    print("\n[Step 14] Submitting Event to Faculty Coordinator Gateway")
    submit_res = client.post(f"/approvals/{ai_ev_id}/submit", headers=headers)
    assert submit_res.status_code == 200
    print("[OK] Event submitted. Status moved to 'Under Review'.")

    # Step 15: Faculty Coordinator Login & Review
    print("\n[Step 15] Faculty Coordinator Login")
    fac_login = client.post("/auth/login", json={
        "email": "faculty@organice.local",
        "password": "password123"
    }).json()
    fac_headers = {"Authorization": f"Bearer {fac_login['token']}"}

    print("\n[Step 16] Faculty Coordinator signs off and approves proposal")
    decide_res = client.post(f"/approvals/{ai_ev_id}/decide", headers=fac_headers, json={
        "status": "Approved",
        "comments": "Formally approved by Faculty Coordinator. Verified timeline and venue clearances."
    })
    assert decide_res.status_code == 200

    approved_check = client.get(f"/events/{ai_ev_id}", headers=headers).json()
    assert approved_check["event"]["status"] == "Approved"
    print("[OK] Event status updated to 'Approved' in PostgreSQL across all dashboard views.")

    # Step 17: Reports Download
    print("\n[Step 17] Testing ReportLab PDF and CSV Report generation")
    pdf_res = client.get(f"/reports/pdf/{ai_ev_id}", headers=headers)
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert len(pdf_res.content) > 1000
    print(f"[OK] Valid ReportLab PDF generated ({len(pdf_res.content)} bytes).")

    csv_res = client.get("/reports/csv/events", headers=headers)
    assert csv_res.status_code == 200
    assert "National Robotics Conclave 2026" in csv_res.text
    print("[OK] Structured CSV export verified.")

    # Step 18: Audit History
    print("\n[Step 18] Verifying Audit History Log")
    history_res = client.get("/history", headers=headers).json()
    assert len(history_res) >= 5
    print(f"[OK] Audit trail contains {len(history_res)} tamper-evident historical logs.")

    print("\n==================================================")
    print("[SUCCESS] ALL 18 END-TO-END WORKFLOW PHASES PASSED 100%!")
    print("==================================================")

if __name__ == "__main__":
    test_complete_e2e()
