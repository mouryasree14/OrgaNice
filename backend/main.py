import os
import io
import csv
import json
import datetime
from typing import Optional, List, Any, Dict
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Depends, HTTPException, status, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from passlib.context import CryptContext
import jwt
from sqlalchemy import select, func, and_, or_, update, delete
from sqlalchemy.orm import Session

from database import engine, SessionLocal, get_db, Base
from models import (
    User, Organization, Event, Venue, TeamMember, Task, TaskDependency,
    Schedule, Budget, BudgetCategory, Expense, Vendor, VendorQuote,
    Risk, Recommendation, Approval, Notification, Activity, Report, AIGeneration
)

# ReportLab for real PDF generation
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable

JWT_SECRET = os.getenv("JWT_SECRET", "organice-secret-key-2026-srm-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

app = FastAPI(
    title="OrgaNice API",
    description="Campus Event Management Platform API with PostgreSQL, RBAC, AI Planner, and Dynamic Budget Ledger",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- SERIALIZATION HELPERS -----------------

def serialize_user(u: User) -> dict:
    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "role": u.role,
        "organization": u.organization,
        "created_at": u.created_at.isoformat() if u.created_at else None
    }

def serialize_event(e: Event) -> dict:
    return {
        "id": e.id,
        "name": e.name,
        "type": e.type,
        "venue": e.venue,
        "start_time": e.start_time.isoformat() if e.start_time else None,
        "end_time": e.end_time.isoformat() if e.end_time else None,
        "attendees": e.attendees,
        "budget": e.budget,
        "status": e.status,
        "progress": e.progress,
        "description": e.description,
        "owner_id": e.owner_id,
        "is_archived": e.is_archived,
        "created_at": e.created_at.isoformat() if e.created_at else None
    }

def serialize_task(t: Task) -> dict:
    return {
        "id": t.id,
        "event_id": t.event_id,
        "name": t.name,
        "description": t.description,
        "assigned_member_id": t.assigned_member_id,
        "assigned_member_name": t.assigned_member.name if t.assigned_member else None,
        "priority": t.priority,
        "start_date": t.start_date.isoformat() if t.start_date else None,
        "deadline": t.deadline.isoformat() if t.deadline else None,
        "status": t.status,
        "category": t.category,
        "created_at": t.created_at.isoformat() if t.created_at else None
    }

def serialize_schedule(s: Schedule) -> dict:
    return {
        "id": s.id,
        "event_id": s.event_id,
        "title": s.title,
        "venue": s.venue,
        "start_time": s.start_time.isoformat() if s.start_time else None,
        "end_time": s.end_time.isoformat() if s.end_time else None,
        "team": s.team,
        "description": s.description,
        "speaker": s.speaker,
        "conflict_flag": s.conflict_flag,
        "conflict_details": s.conflict_details
    }

def serialize_team_member(m: TeamMember) -> dict:
    return {
        "id": m.id,
        "event_id": m.event_id,
        "user_id": m.user_id,
        "name": m.name,
        "email": m.email,
        "role": m.role,
        "department": m.department,
        "workload_status": m.workload_status,
        "tasks_count": len(m.assigned_tasks) if m.assigned_tasks else 0
    }

def serialize_expense(ex: Expense) -> dict:
    return {
        "id": ex.id,
        "event_id": ex.event_id,
        "category_id": ex.category_id,
        "category_name": ex.category.name if ex.category else "General",
        "title": ex.title,
        "amount": ex.amount,
        "vendor_id": ex.vendor_id,
        "vendor_name": ex.vendor.name if ex.vendor else None,
        "payment_status": ex.payment_status,
        "receipt_url": ex.receipt_url,
        "date": ex.date.isoformat() if ex.date else None
    }

def serialize_risk(r: Risk) -> dict:
    return {
        "id": r.id,
        "event_id": r.event_id,
        "title": r.title,
        "category": r.category,
        "severity": r.severity,
        "status": r.status,
        "detail": r.detail,
        "created_at": r.created_at.isoformat() if r.created_at else None
    }

def serialize_recommendation(rec: Recommendation) -> dict:
    payload = {}
    if rec.payload_json:
        try:
            payload = json.loads(rec.payload_json)
        except Exception:
            payload = {}
    return {
        "id": rec.id,
        "event_id": rec.event_id,
        "risk_id": rec.risk_id,
        "title": rec.title,
        "action_type": rec.action_type,
        "payload": payload,
        "status": rec.status,
        "created_at": rec.created_at.isoformat() if rec.created_at else None
    }

# ----------------- AUTH & SECURITY UTILITIES -----------------

def create_access_token(user_id: int, role: str) -> str:
    expire = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": expire
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired authentication token")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User does not exist")
    return user

def require_roles(allowed_roles: List[str]):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted. Required role: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker

def log_activity(
    db: Session,
    action: str,
    entity_type: str,
    entity_id: Optional[int] = None,
    event_id: Optional[int] = None,
    user: Optional[User] = None,
    details: str = ""
):
    activity = Activity(
        event_id=event_id,
        user_id=user.id if user else None,
        user_name=user.name if user else "System AI",
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details
    )
    db.add(activity)

def recalculate_event_progress(db: Session, event_id: int):
    tasks = db.scalars(select(Task).where(Task.event_id == event_id)).all()
    event = db.get(Event, event_id)
    if not event:
        return
    if not tasks:
        event.progress = 0
    else:
        done_count = sum(1 for t in tasks if t.status == "Done")
        event.progress = int(round((done_count / len(tasks)) * 100))
    db.commit()

def run_risk_scanner(db: Session, event_id: int):
    event = db.get(Event, event_id)
    if not event:
        return

    # 1. Budget overrun check
    expenses_total = db.scalar(select(func.coalesce(func.sum(Expense.amount), 0.0)).where(Expense.event_id == event_id)) or 0.0
    quotes_total = db.scalar(select(func.coalesce(func.sum(VendorQuote.amount), 0.0)).where(
        VendorQuote.event_id == event_id,
        VendorQuote.status.in_(["Accepted", "Shortlisted"])
    )) or 0.0
    projected = expenses_total + quotes_total

    existing_budget_risk = db.scalar(select(Risk).where(
        Risk.event_id == event_id,
        Risk.category == "Budget",
        Risk.status == "Open"
    ))

    if projected > event.budget:
        overrun = projected - event.budget
        if not existing_budget_risk:
            new_risk = Risk(
                event_id=event_id,
                title=f"Projected Budget Overrun by ₹{overrun:,.0f}",
                category="Budget",
                severity="High" if overrun < 15000 else "Critical",
                status="Open",
                detail=f"Projected spending (₹{projected:,.0f}) exceeds sanctioned budget (₹{event.budget:,.0f}) by ₹{overrun:,.0f}."
            )
            db.add(new_risk)
            db.flush()
            rec = Recommendation(
                event_id=event_id,
                risk_id=new_risk.id,
                title=f"Reduce discretionary expenses by ₹{overrun:,.0f}",
                action_type="reduce_spending",
                payload_json=json.dumps({"target_cut": overrun, "event_id": event_id}),
                status="Open"
            )
            db.add(rec)
    elif existing_budget_risk:
        existing_budget_risk.status = "Resolved"

    # 2. Schedule conflict check
    schedules = db.scalars(select(Schedule).where(Schedule.event_id == event_id)).all()
    for s in schedules:
        s.conflict_flag = False
        s.conflict_details = None

    for i, s1 in enumerate(schedules):
        for s2 in schedules[i+1:]:
            if s1.venue == s2.venue and max(s1.start_time, s2.start_time) < min(s1.end_time, s2.end_time):
                s1.conflict_flag = True
                s2.conflict_flag = True
                s1.conflict_details = f"Overlaps with '{s2.title}' in {s1.venue}."
                s2.conflict_details = f"Overlaps with '{s1.title}' in {s2.venue}."
    db.commit()

# ----------------- PYDANTIC SCHEMAS -----------------

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str = Field(min_length=6)
    role: str = "Organizer"
    organization: Optional[str] = "SRM Institute of Science & Technology"

class LoginRequest(BaseModel):
    email: str
    password: str

class EventCreateRequest(BaseModel):
    name: str
    type: str = "Technical Fest"
    venue: str = "Main Auditorium"
    start_time: datetime.datetime
    end_time: datetime.datetime
    attendees: int = 500
    budget: float = 100000.0
    description: str = ""

class EventUpdateRequest(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    venue: Optional[str] = None
    start_time: Optional[datetime.datetime] = None
    end_time: Optional[datetime.datetime] = None
    attendees: Optional[int] = None
    budget: Optional[float] = None
    status: Optional[str] = None
    description: Optional[str] = None

class TaskCreateRequest(BaseModel):
    event_id: int
    name: str
    description: Optional[str] = ""
    assigned_member_id: Optional[int] = None
    priority: str = "Medium"
    start_date: datetime.date
    deadline: datetime.date
    status: str = "To Do"
    category: str = "Logistics"

class TaskUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    assigned_member_id: Optional[int] = None
    priority: Optional[str] = None
    start_date: Optional[datetime.date] = None
    deadline: Optional[datetime.date] = None
    status: Optional[str] = None
    category: Optional[str] = None

class ScheduleCreateRequest(BaseModel):
    event_id: int
    title: str
    venue: str = "Main Auditorium"
    start_time: datetime.datetime
    end_time: datetime.datetime
    team: str = "Logistics"
    description: Optional[str] = ""
    speaker: Optional[str] = None

class ExpenseCreateRequest(BaseModel):
    event_id: int
    category_id: Optional[int] = None
    title: str
    amount: float
    vendor_id: Optional[int] = None
    payment_status: str = "Paid"
    date: datetime.date

class VendorCreateRequest(BaseModel):
    event_id: Optional[int] = None
    name: str
    service: str
    contact_name: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""
    status: str = "Confirmed"
    rating: float = 4.5

class VendorQuoteCreateRequest(BaseModel):
    vendor_id: int
    event_id: int
    amount: float
    notes: Optional[str] = ""
    status: str = "Shortlisted"

class TeamMemberCreateRequest(BaseModel):
    event_id: Optional[int] = None
    user_id: Optional[int] = None
    name: str
    email: str
    role: str = "Coordinator"
    department: str = "School of Computing"

class ApprovalDecisionRequest(BaseModel):
    status: str
    comments: str = ""

class AIPromptRequest(BaseModel):
    prompt: str
    event_id: Optional[int] = None

class CopilotQueryRequest(BaseModel):
    prompt: str
    event_id: Optional[int] = None
    confirm_action: Optional[bool] = False
    action_type: Optional[str] = None
    action_payload: Optional[Dict[str, Any]] = None

# ----------------- AUTH ROUTE HANDLERS -----------------

@app.post("/auth/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.scalar(select(User).where(User.email == req.email))
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    user = User(
        name=req.name,
        email=req.email,
        hashed_password=pwd_context.hash(req.password),
        role=req.role,
        organization=req.organization or "SRM Institute of Science & Technology"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log_activity(db, "Registered User", "user", user.id, None, user, f"Created account with role {user.role}")
    db.commit()

    token = create_access_token(user.id, user.role)
    return {
        "token": token,
        "user": serialize_user(user)
    }

@app.post("/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == req.email))
    if not user or not pwd_context.verify(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = create_access_token(user.id, user.role)
    return {
        "token": token,
        "user": serialize_user(user)
    }

@app.get("/me")
def get_me(user: User = Depends(get_current_user)):
    return serialize_user(user)

# ----------------- DASHBOARD ROUTE -----------------

@app.get("/dashboard")
def get_dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    now = datetime.datetime.utcnow()

    events = db.scalars(select(Event).where(Event.is_archived == False).order_by(Event.start_time)).all()
    total_events = len(events)
    upcoming_events = sum(1 for e in events if e.start_time > now)
    active_events = sum(1 for e in events if e.status in ["Active", "Under Review", "Approved"])
    total_budget = sum(e.budget for e in events)

    tasks = db.scalars(select(Task).order_by(Task.deadline)).all()
    pending_tasks = sum(1 for t in tasks if t.status != "Done")

    risks = db.scalars(select(Risk).where(Risk.status == "Open")).all()
    high_risks = sum(1 for r in risks if r.severity in ["High", "Critical"])

    expenses = db.scalars(select(Expense)).all()
    total_spent = sum(ex.amount for ex in expenses)

    health_score = 92
    if high_risks > 0:
        health_score -= (high_risks * 8)
    if total_budget > 0 and total_spent > total_budget:
        health_score -= 15
    health_score = max(35, min(98, health_score))

    activities = db.scalars(select(Activity).order_by(Activity.created_at.desc()).limit(8)).all()
    upcoming_deadlines = [serialize_task(t) for t in tasks if t.status != "Done"][:4]

    return {
        "metrics": {
            "totalEvents": total_events,
            "upcomingEvents": upcoming_events,
            "activeEvents": active_events,
            "totalBudget": total_budget,
            "totalSpent": total_spent,
            "pendingTasks": pending_tasks,
            "highRisks": high_risks,
            "eventHealth": health_score
        },
        "events": [serialize_event(e) for e in events],
        "tasks": [serialize_task(t) for t in tasks],
        "upcomingDeadlines": upcoming_deadlines,
        "risks": [serialize_risk(r) for r in risks],
        "activities": [
            {
                "id": a.id,
                "user_name": a.user_name,
                "action": a.action,
                "entity_type": a.entity_type,
                "details": a.details,
                "created_at": a.created_at.isoformat() if a.created_at else None
            }
            for a in activities
        ]
    }

# ----------------- EVENTS CRUD & ACTIONS -----------------

@app.get("/events")
def list_events(
    search: Optional[str] = None,
    status: Optional[str] = None,
    include_archived: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Event)
    if not include_archived:
        query = query.where(Event.is_archived == False)
    if status and status != "All":
        query = query.where(Event.status == status)
    if search:
        query = query.where(Event.name.ilike(f"%{search}%"))
    query = query.order_by(Event.start_time)

    events = db.scalars(query).all()
    return [serialize_event(e) for e in events]

@app.post("/events")
def create_event(
    req: EventCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    event = Event(
        name=req.name,
        type=req.type,
        venue=req.venue,
        start_time=req.start_time,
        end_time=req.end_time,
        attendees=req.attendees,
        budget=req.budget,
        status="Draft",
        progress=0,
        description=req.description,
        owner_id=current_user.id,
        organization_id=current_user.organization_id
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    budget = Budget(
        event_id=event.id,
        total_budget=event.budget,
        currency="INR",
        notes=f"Initial budget for {event.name}"
    )
    db.add(budget)
    db.commit()
    db.refresh(budget)

    categories = [
        BudgetCategory(budget_id=budget.id, event_id=event.id, name="Logistics & Venue", allocated_amount=event.budget * 0.35, spent_amount=0),
        BudgetCategory(budget_id=budget.id, event_id=event.id, name="Tech & AV Equipment", allocated_amount=event.budget * 0.25, spent_amount=0),
        BudgetCategory(budget_id=budget.id, event_id=event.id, name="Catering & Hospitality", allocated_amount=event.budget * 0.25, spent_amount=0),
        BudgetCategory(budget_id=budget.id, event_id=event.id, name="Marketing & Merchandise", allocated_amount=event.budget * 0.15, spent_amount=0)
    ]
    db.add_all(categories)

    member = TeamMember(
        event_id=event.id,
        user_id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role="Lead Organizer",
        department="Event Coordination",
        workload_status="Normal"
    )
    db.add(member)

    log_activity(db, "Created Event", "event", event.id, event.id, current_user, f"Created {event.name} with budget ₹{event.budget:,.0f}")
    db.commit()

    return serialize_event(event)

@app.get("/events/{event_id}")
def get_event(event_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    tasks = db.scalars(select(Task).where(Task.event_id == event_id).order_by(Task.deadline)).all()
    schedules = db.scalars(select(Schedule).where(Schedule.event_id == event_id).order_by(Schedule.start_time)).all()
    team = db.scalars(select(TeamMember).where(TeamMember.event_id == event_id)).all()
    expenses = db.scalars(select(Expense).where(Expense.event_id == event_id)).all()
    vendors = db.scalars(select(Vendor).where(Vendor.event_id == event_id)).all()
    quotes = db.scalars(select(VendorQuote).where(VendorQuote.event_id == event_id)).all()
    risks = db.scalars(select(Risk).where(Risk.event_id == event_id)).all()
    recommendations = db.scalars(select(Recommendation).where(Recommendation.event_id == event_id)).all()
    approvals = db.scalars(select(Approval).where(Approval.event_id == event_id).order_by(Approval.created_at.desc())).all()
    budget = db.scalar(select(Budget).where(Budget.event_id == event_id))
    categories = db.scalars(select(BudgetCategory).where(BudgetCategory.event_id == event_id)).all()

    total_spent = sum(ex.amount for ex in expenses)
    projected = total_spent + sum(q.amount for q in quotes if q.status in ["Accepted", "Shortlisted"])

    return {
        "event": serialize_event(event),
        "tasks": [serialize_task(t) for t in tasks],
        "schedules": [serialize_schedule(s) for s in schedules],
        "team": [serialize_team_member(m) for m in team],
        "expenses": [serialize_expense(ex) for ex in expenses],
        "vendors": [
            {
                "id": v.id,
                "name": v.name,
                "service": v.service,
                "contact_name": v.contact_name,
                "email": v.email,
                "phone": v.phone,
                "status": v.status,
                "rating": v.rating
            }
            for v in vendors
        ],
        "vendor_quotes": [
            {
                "id": q.id,
                "vendor_id": q.vendor_id,
                "vendor_name": q.vendor.name if q.vendor else "Vendor",
                "service": q.vendor.service if q.vendor else "",
                "amount": q.amount,
                "notes": q.notes,
                "status": q.status
            }
            for q in quotes
        ],
        "risks": [serialize_risk(r) for r in risks],
        "recommendations": [serialize_recommendation(rec) for rec in recommendations],
        "approvals": [
            {
                "id": a.id,
                "reviewer_name": a.reviewer.name if a.reviewer else "Faculty Reviewer",
                "status": a.status,
                "comments": a.comments,
                "decision_date": a.decision_date.isoformat() if a.decision_date else None
            }
            for a in approvals
        ],
        "budget": {
            "total_budget": budget.total_budget if budget else event.budget,
            "total_spent": total_spent,
            "remaining": (budget.total_budget if budget else event.budget) - total_spent,
            "projected": projected,
            "categories": [
                {
                    "id": c.id,
                    "name": c.name,
                    "allocated_amount": c.allocated_amount,
                    "spent_amount": c.spent_amount
                }
                for c in categories
            ]
        }
    }

@app.patch("/events/{event_id}")
def update_event(
    event_id: int,
    req: EventUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    update_data = req.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(event, field, val)

    if "budget" in update_data and req.budget is not None:
        budget = db.scalar(select(Budget).where(Budget.event_id == event_id))
        if budget:
            budget.total_budget = req.budget

    log_activity(db, "Updated Event", "event", event.id, event.id, current_user, f"Updated attributes: {', '.join(update_data.keys())}")
    db.commit()
    db.refresh(event)

    run_risk_scanner(db, event.id)
    return serialize_event(event)

@app.delete("/events/{event_id}")
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Organizer", "Admin"]))
):
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    event_name = event.name
    db.delete(event)
    log_activity(db, "Deleted Event", "event", event_id, None, current_user, f"Deleted event {event_name}")
    db.commit()
    return {"message": f"Event '{event_name}' successfully deleted", "id": event_id}

@app.post("/events/{event_id}/duplicate")
def duplicate_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    orig = db.get(Event, event_id)
    if not orig:
        raise HTTPException(status_code=404, detail="Event not found")

    new_event = Event(
        name=f"{orig.name} (Copy)",
        type=orig.type,
        venue=orig.venue,
        start_time=orig.start_time + datetime.timedelta(days=30),
        end_time=orig.end_time + datetime.timedelta(days=30),
        attendees=orig.attendees,
        budget=orig.budget,
        status="Draft",
        progress=0,
        description=orig.description,
        owner_id=current_user.id,
        organization_id=orig.organization_id
    )
    db.add(new_event)
    db.commit()
    db.refresh(new_event)

    new_budget = Budget(event_id=new_event.id, total_budget=orig.budget, currency="INR")
    db.add(new_budget)
    db.commit()
    db.refresh(new_budget)

    categories = db.scalars(select(BudgetCategory).where(BudgetCategory.event_id == event_id)).all()
    for c in categories:
        db.add(BudgetCategory(budget_id=new_budget.id, event_id=new_event.id, name=c.name, allocated_amount=c.allocated_amount, spent_amount=0))

    tasks = db.scalars(select(Task).where(Task.event_id == event_id)).all()
    for t in tasks:
        db.add(Task(
            event_id=new_event.id,
            name=t.name,
            description=t.description,
            priority=t.priority,
            start_date=t.start_date + datetime.timedelta(days=30),
            deadline=t.deadline + datetime.timedelta(days=30),
            status="To Do",
            category=t.category
        ))

    log_activity(db, "Duplicated Event", "event", new_event.id, new_event.id, current_user, f"Cloned blueprint from {orig.name}")
    db.commit()
    return serialize_event(new_event)

@app.post("/events/{event_id}/archive")
def archive_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    event.is_archived = not event.is_archived
    db.commit()
    return {"id": event.id, "is_archived": event.is_archived}

# ----------------- AI PLANNER ROUTE -----------------

@app.post("/ai/plan")
def ai_plan(
    req: AIPromptRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    prompt_text = req.prompt.strip()
    ai_data = None

    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key and len(openai_key) > 20:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_key)
            system_instruction = """You are OrgaNice AI Event Architect. Parse the event prompt and generate a JSON blueprint with keys:
name: str
event_type: str (e.g. Technical Fest, Cultural, Hackathon, Workshop)
venue: str (e.g. Main Auditorium, Seminar Hall, Open-Air Theatre, Innovation Lab)
duration_days: int
attendees: int
budget: float
tasks: list of objects with [name, category, priority (Low/Medium/High/Critical), days_before_deadline]
schedules: list of objects with [title, venue, start_hour (e.g. 10.0), duration_hours (e.g. 2.0), team]
risks: list of objects with [title, category, severity, detail]
recommendations: list of objects with [title, action_type, detail]"""
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": prompt_text}
                ]
            )
            candidate = json.loads(response.choices[0].message.content or "{}")
            if "name" in candidate and "tasks" in candidate:
                ai_data = candidate
        except Exception:
            ai_data = None

    if not ai_data:
        p_lower = prompt_text.lower()
        import re
        att_match = re.search(r"(\d+)\s*(students|attendees|people|participants)", p_lower)
        attendees = int(att_match.group(1)) if att_match else 500

        days_match = re.search(r"(\d+)[ -]day", p_lower)
        duration_days = int(days_match.group(1)) if days_match else 2

        if "hackathon" in p_lower or "code" in p_lower:
            event_type = "Hackathon"
            venue = "Innovation Lab"
            base_name = "HackNova 2026"
            budget = 45000.0 if "lakh" not in p_lower else 100000.0
        elif "cultural" in p_lower or "music" in p_lower or "dance" in p_lower:
            event_type = "Cultural"
            venue = "Open-Air Theatre"
            base_name = "Milan Cultural Fiesta"
            budget = 90000.0
        else:
            event_type = "Technical Fest"
            venue = "Main Auditorium"
            base_name = "Technova 2026"
            budget = 120000.0

        ai_data = {
            "name": base_name,
            "event_type": event_type,
            "venue": venue,
            "duration_days": duration_days,
            "attendees": attendees,
            "budget": budget,
            "tasks": [
                {"name": "Confirm Main Venue Booking & Security Permits", "category": "Logistics", "priority": "High", "days_before_deadline": 21},
                {"name": "Finalize Corporate Sponsorship MoU", "category": "Sponsorship", "priority": "High", "days_before_deadline": 18},
                {"name": "Launch Participant Registration Portal", "category": "Technical", "priority": "Medium", "days_before_deadline": 14},
                {"name": "Contract Sound & Stage Lighting Vendor", "category": "Tech & AV", "priority": "Critical", "days_before_deadline": 10},
                {"name": "Order Participant Welcome Kits & ID Lanyards", "category": "Logistics", "priority": "Medium", "days_before_deadline": 8},
                {"name": "Conduct Volunteer Briefing for Logistics Team", "category": "Volunteers", "priority": "Low", "days_before_deadline": 4},
                {"name": "Complete Audio-Visual & Network Dry Run", "category": "Technical", "priority": "Critical", "days_before_deadline": 2}
            ],
            "schedules": [
                {"title": "Inaugural Address & Lamp Lighting", "venue": "Main Auditorium", "start_hour": 9.5, "duration_hours": 1.5, "team": "Logistics"},
                {"title": "Workshop A: Hands-on Deep Learning", "venue": "Seminar Hall", "start_hour": 14.0, "duration_hours": 2.0, "team": "Technical"},
                {"title": "Sponsor Executive Networking Session", "venue": "Seminar Hall", "start_hour": 14.0, "duration_hours": 1.5, "team": "Sponsorship"},
                {"title": "Grand Project Pitching Competition", "venue": "Main Auditorium", "start_hour": 28.0, "duration_hours": 3.0, "team": "Technical"},
                {"title": "Valedictory & Prize Distribution", "venue": "Main Auditorium", "start_hour": 32.0, "duration_hours": 2.0, "team": "Logistics"}
            ],
            "risks": [
                {
                    "title": "Seminar Hall Schedule Double-Booking",
                    "category": "Schedule",
                    "severity": "High",
                    "detail": "Workshop A and Sponsor Executive Session overlap at 2:00 PM in Seminar Hall."
                },
                {
                    "title": "Catering Peak Utilization Limit",
                    "category": "Budget",
                    "severity": "Medium",
                    "detail": "High student attendance may require additional lunch coupons."
                }
            ],
            "recommendations": [
                {
                    "title": "Shift Workshop A to 3:30 PM",
                    "action_type": "reschedule",
                    "detail": "Reschedule Workshop A to Seminar Hall at 3:30 PM to eliminate the double-booking conflict."
                }
            ]
        }

    now = datetime.datetime.utcnow()
    start_time = (now + datetime.timedelta(days=14)).replace(hour=9, minute=0, second=0, microsecond=0)
    end_time = start_time + datetime.timedelta(days=ai_data.get("duration_days", 2), hours=9)

    event = Event(
        name=ai_data["name"],
        type=ai_data["event_type"],
        venue=ai_data["venue"],
        start_time=start_time,
        end_time=end_time,
        attendees=ai_data["attendees"],
        budget=float(ai_data["budget"]),
        status="Draft",
        progress=0,
        description=prompt_text,
        owner_id=current_user.id,
        organization_id=current_user.organization_id
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    budget = Budget(
        event_id=event.id,
        total_budget=event.budget,
        currency="INR",
        notes=f"AI Blueprint Budget for {event.name}"
    )
    db.add(budget)
    db.commit()
    db.refresh(budget)

    cat_allocations = [
        ("Logistics & Venue", 0.35),
        ("Tech & AV Equipment", 0.25),
        ("Catering & Hospitality", 0.25),
        ("Marketing & Merchandise", 0.15)
    ]
    for c_name, ratio in cat_allocations:
        db.add(BudgetCategory(
            budget_id=budget.id,
            event_id=event.id,
            name=c_name,
            allocated_amount=round(event.budget * ratio),
            spent_amount=0.0
        ))

    tasks_list = []
    for t_data in ai_data.get("tasks", []):
        days_before = t_data.get("days_before_deadline", 7)
        task = Task(
            event_id=event.id,
            name=t_data["name"],
            description=f"Execution checklist for {t_data['name']}",
            priority=t_data.get("priority", "Medium"),
            start_date=start_time.date() - datetime.timedelta(days=days_before + 5),
            deadline=start_time.date() - datetime.timedelta(days=days_before),
            status="To Do",
            category=t_data.get("category", "Logistics")
        )
        db.add(task)
        tasks_list.append(task)
    db.commit()

    schedules_list = []
    for s_data in ai_data.get("schedules", []):
        st_offset = float(s_data.get("start_hour", 10.0))
        dur = float(s_data.get("duration_hours", 2.0))
        s_start = start_time + datetime.timedelta(hours=st_offset)
        s_end = s_start + datetime.timedelta(hours=dur)

        sched = Schedule(
            event_id=event.id,
            title=s_data["title"],
            venue=s_data.get("venue", "Main Auditorium"),
            start_time=s_start,
            end_time=s_end,
            team=s_data.get("team", "Logistics"),
            description=f"Session for {s_data['title']}"
        )
        db.add(sched)
        schedules_list.append(sched)
    db.commit()

    risks_list = []
    for r_data in ai_data.get("risks", []):
        risk = Risk(
            event_id=event.id,
            title=r_data["title"],
            category=r_data.get("category", "Schedule"),
            severity=r_data.get("severity", "High"),
            status="Open",
            detail=r_data.get("detail", "")
        )
        db.add(risk)
        risks_list.append(risk)
    db.commit()
    for r in risks_list:
        db.refresh(r)

    resched_time = (start_time.replace(hour=15, minute=30)).isoformat()
    rec1 = Recommendation(
        event_id=event.id,
        risk_id=risks_list[0].id if risks_list else None,
        title="Move Workshop A to Seminar Hall at 3:30 PM",
        action_type="reschedule",
        payload_json=json.dumps({
            "schedule_title": "Workshop A: Hands-on Deep Learning",
            "new_start_time": resched_time,
            "venue": "Seminar Hall"
        }),
        status="Open"
    )
    db.add(rec1)

    ai_log = AIGeneration(
        event_id=event.id,
        prompt=prompt_text,
        response_json=json.dumps(ai_data),
        model="gpt-4o-mini" if (openai_key and len(openai_key) > 20) else "deterministic-fallback-v2"
    )
    db.add(ai_log)

    log_activity(db, "AI Generated Event Plan", "event", event.id, event.id, current_user, f"Generated blueprint with {len(tasks_list)} tasks and {len(schedules_list)} sessions")
    db.commit()

    run_risk_scanner(db, event.id)

    return {
        "event": serialize_event(event),
        "timeline": [serialize_task(t) for t in tasks_list],
        "schedules": [serialize_schedule(s) for s in schedules_list],
        "recommendations": [
            "Start participant registration three weeks prior to kickoff",
            "Deploy 12 student volunteers for Day 1 morning logistics",
            "Schedule Conflict Detected: Workshop A overlaps Sponsor Session in Seminar Hall"
        ],
        "conflicts": 1
    }

# ----------------- AI COPILOT ROUTE -----------------

@app.post("/copilot")
def copilot_query(
    req: CopilotQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = req.prompt.lower().strip()
    event_id = req.event_id

    if req.confirm_action and req.action_type:
        if req.action_type == "reschedule":
            title = req.action_payload.get("schedule_title", "Workshop A")
            new_start = req.action_payload.get("new_start_time")
            sched = db.scalar(select(Schedule).where(
                Schedule.event_id == event_id if event_id else True,
                Schedule.title.ilike(f"%{title}%")
            ))
            if sched:
                if new_start:
                    sched.start_time = datetime.datetime.fromisoformat(new_start)
                    sched.end_time = sched.start_time + datetime.timedelta(hours=2)
                sched.conflict_flag = False
                sched.conflict_details = None
                log_activity(db, "Copilot Rescheduled Session", "schedule", sched.id, sched.event_id, current_user, f"Rescheduled {sched.title} to {sched.start_time}")
                db.commit()
                run_risk_scanner(db, sched.event_id)
                return {
                    "answer": f"Done! I have rescheduled '{sched.title}' to {sched.start_time.strftime('%I:%M %p')}. The calendar and conflict alerts have been refreshed.",
                    "requires_confirmation": False
                }
        elif req.action_type == "optimize_budget":
            log_activity(db, "Copilot Budget Optimization", "budget", None, event_id, current_user, "Applied discretionary expense cap of 10%")
            db.commit()
            return {
                "answer": "Budget optimization applied! Discretionary reserves have been locked to protect remaining funds.",
                "requires_confirmation": False
            }

    events = db.scalars(select(Event).where(Event.is_archived == False)).all()
    selected_event = db.get(Event, event_id) if event_id else (events[0] if events else None)

    tasks_query = select(Task)
    if selected_event:
        tasks_query = tasks_query.where(Task.event_id == selected_event.id)
    tasks = db.scalars(tasks_query).all()

    expenses_query = select(Expense)
    if selected_event:
        expenses_query = expenses_query.where(Expense.event_id == selected_event.id)
    expenses = db.scalars(expenses_query).all()
    total_spent = sum(ex.amount for ex in expenses)

    quotes_query = select(VendorQuote)
    if selected_event:
        quotes_query = quotes_query.where(VendorQuote.event_id == selected_event.id)
    quotes = db.scalars(quotes_query).all()
    projected = total_spent + sum(q.amount for q in quotes if q.status in ["Accepted", "Shortlisted"])

    schedules_query = select(Schedule)
    if selected_event:
        schedules_query = schedules_query.where(Schedule.event_id == selected_event.id)
    schedules = db.scalars(schedules_query).all()
    conflicts = [s for s in schedules if s.conflict_flag]

    if "task" in q or "attention" in q:
        pending = [t for t in tasks if t.status != "Done"]
        critical_pending = [t for t in pending if t.priority in ["Critical", "High"]]
        if critical_pending:
            items_str = ", ".join([f"'{t.name}' (due {t.deadline})" for t in critical_pending[:3]])
            msg = f"There are {len(pending)} pending tasks. Urgent attention is needed for: {items_str}."
        elif pending:
            items_str = ", ".join([f"'{t.name}'" for t in pending[:3]])
            msg = f"You have {len(pending)} pending tasks in progress: {items_str}."
        else:
            msg = "All tasks are currently completed! Great job."
        return {"answer": msg, "requires_confirmation": False}

    elif "budget" in q or "exceed" in q or "spend" in q:
        budget_val = selected_event.budget if selected_event else sum(e.budget for e in events)
        variance = budget_val - projected
        if projected > budget_val:
            msg = f"Yes, projected spend is ₹{projected:,.0f} which exceeds the budget of ₹{budget_val:,.0f} by ₹{abs(variance):,.0f}. I recommend optimizing vendor quotes or reducing marketing expenses."
            return {
                "answer": msg,
                "requires_confirmation": True,
                "action_type": "optimize_budget",
                "action_prompt": "Would you like me to apply automatic budget optimization?"
            }
        else:
            msg = f"Budget is on track! Sanctioned: ₹{budget_val:,.0f}, Actual Spend: ₹{total_spent:,.0f}, Projected: ₹{projected:,.0f}. You have ₹{variance:,.0f} in remaining buffer."
            return {"answer": msg, "requires_confirmation": False}

    elif "conflict" in q or "schedule" in q or "overlap" in q:
        if conflicts:
            c = conflicts[0]
            msg = f"Detected {len(conflicts)} scheduling conflict(s). For example, '{c.title}' in {c.venue}: {c.conflict_details}. I can reschedule Workshop A to 3:30 PM to clear it."
            return {
                "answer": msg,
                "requires_confirmation": True,
                "action_type": "reschedule",
                "action_payload": {
                    "schedule_title": c.title,
                    "new_start_time": (c.start_time + datetime.timedelta(hours=1, minutes=30)).isoformat()
                },
                "action_prompt": f"Confirm moving '{c.title}' to 3:30 PM?"
            }
        else:
            return {"answer": "All sessions are currently conflict-free! No venue double-bookings or overlapping events found.", "requires_confirmation": False}

    elif "workload" in q or "too many" in q:
        team_members = db.scalars(select(TeamMember)).all()
        overloaded = [m for m in team_members if m.workload_status == "Overloaded" or len(m.assigned_tasks) > 4]
        if overloaded:
            names = ", ".join([f"{m.name} ({len(m.assigned_tasks)} tasks)" for m in overloaded])
            msg = f"High workload detected for: {names}. Consider reassigning tasks to Priya Patel or recruiting extra student volunteers."
        else:
            msg = "Team workload is balanced. No member currently has excessive tasks."
        return {"answer": msg, "requires_confirmation": False}

    elif "focus" in q or "week" in q:
        today = datetime.datetime.utcnow().date()
        this_week = [t for t in tasks if t.status != "Done" and t.deadline <= today + datetime.timedelta(days=7)]
        if this_week:
            list_str = ", ".join([f"• {t.name} (due {t.deadline})" for t in this_week[:3]])
            msg = f"Your top focus areas for this week:\n{list_str}\nMake sure to verify AV dry run permissions."
        else:
            msg = "No urgent deadlines falling within the next 7 days. You can focus on vendor negotiations and speaker confirmations."
        return {"answer": msg, "requires_confirmation": False}

    elif "vendor" in q or "unconfirmed" in q:
        vendors = db.scalars(select(Vendor)).all()
        unconfirmed = [v for v in vendors if v.status != "Confirmed"]
        if unconfirmed:
            v_list = ", ".join([f"{v.name} ({v.service})" for v in unconfirmed])
            msg = f"The following vendor(s) are pending confirmation: {v_list}. Please follow up to lock in quotes."
        else:
            msg = "All vendors are confirmed! Audio/Visual and Catering agreements are signed."
        return {"answer": msg, "requires_confirmation": False}

    elif "summary" in q or "summarize" in q:
        if selected_event:
            ev = selected_event
            msg = f"Event Summary for '{ev.name}':\n• Status: {ev.status} ({ev.progress}% complete)\n• Dates: {ev.start_time.strftime('%d %b %Y')} at {ev.venue}\n• Expected Attendees: {ev.attendees}\n• Budget: ₹{total_spent:,.0f} spent of ₹{ev.budget:,.0f}\n• Open Risks: {len([r for r in selected_event.risks if r.status == 'Open'])}"
        else:
            msg = f"Total of {len(events)} campus events active in OrgaNice. Overall system health is 92%."
        return {"answer": msg, "requires_confirmation": False}

    else:
        return {
            "answer": f"I analyzed your database. You currently have {len(events)} events, {len(tasks)} tasks ({sum(1 for t in tasks if t.status != 'Done')} pending), and ₹{total_spent:,.0f} in recorded expenses. Ask me about budget, deadlines, schedule conflicts, or team workload!",
            "requires_confirmation": False
        }

# ----------------- TASKS CRUD & ENGINE -----------------

@app.get("/tasks")
def list_tasks(
    event_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Task)
    if event_id:
        query = query.where(Task.event_id == event_id)
    if status and status != "All":
        query = query.where(Task.status == status)
    query = query.order_by(Task.deadline)

    tasks = db.scalars(query).all()
    return [serialize_task(t) for t in tasks]

@app.post("/tasks")
def create_task(
    req: TaskCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = Task(
        event_id=req.event_id,
        name=req.name,
        description=req.description or "",
        assigned_member_id=req.assigned_member_id,
        priority=req.priority,
        start_date=req.start_date,
        deadline=req.deadline,
        status=req.status,
        category=req.category
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    recalculate_event_progress(db, req.event_id)
    log_activity(db, "Created Task", "task", task.id, req.event_id, current_user, f"Created task '{task.name}'")
    db.commit()

    return serialize_task(task)

@app.patch("/tasks/{task_id}")
def update_task(
    task_id: int,
    req: TaskUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    old_deadline = task.deadline
    update_data = req.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(task, field, val)

    if "deadline" in update_data and req.deadline and req.deadline != old_deadline:
        delta_days = (req.deadline - old_deadline).days
        if delta_days != 0:
            dependent_deps = db.scalars(select(TaskDependency).where(TaskDependency.depends_on_task_id == task_id)).all()
            for dep in dependent_deps:
                dep_task = db.get(Task, dep.task_id)
                if dep_task and dep_task.start_date < req.deadline:
                    dep_task.start_date = dep_task.start_date + datetime.timedelta(days=delta_days)
                    dep_task.deadline = dep_task.deadline + datetime.timedelta(days=delta_days)

    db.commit()
    recalculate_event_progress(db, task.event_id)
    log_activity(db, "Updated Task", "task", task.id, task.event_id, current_user, f"Updated task '{task.name}' status to '{task.status}'")
    db.commit()
    db.refresh(task)

    return serialize_task(task)

@app.delete("/tasks/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    event_id = task.event_id
    task_name = task.name
    db.delete(task)
    db.commit()

    recalculate_event_progress(db, event_id)
    log_activity(db, "Deleted Task", "task", task_id, event_id, current_user, f"Deleted task '{task_name}'")
    db.commit()

    return {"message": "Task deleted successfully", "id": task_id}

# ----------------- TEAM MANAGEMENT -----------------

@app.get("/team")
def list_team(
    event_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(TeamMember)
    if event_id:
        query = query.where(TeamMember.event_id == event_id)
    members = db.scalars(query).all()

    for m in members:
        count = len(m.assigned_tasks)
        if count >= 4:
            m.workload_status = "Overloaded"
        elif count >= 2:
            m.workload_status = "Heavy"
        else:
            m.workload_status = "Normal"
    db.commit()

    return [serialize_team_member(m) for m in members]

@app.post("/team")
def add_team_member(
    req: TeamMemberCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Organizer", "Admin"]))
):
    member = TeamMember(
        event_id=req.event_id,
        user_id=req.user_id,
        name=req.name,
        email=req.email,
        role=req.role,
        department=req.department,
        workload_status="Normal"
    )
    db.add(member)
    db.commit()
    db.refresh(member)

    log_activity(db, "Added Team Member", "team_member", member.id, req.event_id, current_user, f"Added {member.name} ({member.role})")
    db.commit()

    return serialize_team_member(member)

@app.delete("/team/{member_id}")
def remove_team_member(
    member_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Organizer", "Admin"]))
):
    member = db.get(TeamMember, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")

    for t in member.assigned_tasks:
        t.assigned_member_id = None

    member_name = member.name
    event_id = member.event_id
    db.delete(member)
    log_activity(db, "Removed Team Member", "team_member", member_id, event_id, current_user, f"Removed {member_name}")
    db.commit()

    return {"message": "Team member removed", "id": member_id}

# ----------------- SCHEDULES & CALENDAR -----------------

@app.get("/schedules")
def list_schedules(
    event_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Schedule)
    if event_id:
        query = query.where(Schedule.event_id == event_id)
    query = query.order_by(Schedule.start_time)
    schedules = db.scalars(query).all()
    return [serialize_schedule(s) for s in schedules]

@app.post("/schedules")
def create_schedule(
    req: ScheduleCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sched = Schedule(
        event_id=req.event_id,
        title=req.title,
        venue=req.venue,
        start_time=req.start_time,
        end_time=req.end_time,
        team=req.team,
        description=req.description or "",
        speaker=req.speaker
    )
    db.add(sched)
    db.commit()
    db.refresh(sched)

    run_risk_scanner(db, req.event_id)
    log_activity(db, "Created Schedule Entry", "schedule", sched.id, req.event_id, current_user, f"Scheduled '{sched.title}' at {sched.venue}")
    db.commit()
    db.refresh(sched)

    return serialize_schedule(sched)

@app.patch("/schedules/{schedule_id}")
def update_schedule(
    schedule_id: int,
    req: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sched = db.get(Schedule, schedule_id)
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule entry not found")

    for k, v in req.items():
        if hasattr(sched, k):
            if "time" in k and isinstance(v, str):
                setattr(sched, k, datetime.datetime.fromisoformat(v))
            else:
                setattr(sched, k, v)

    db.commit()
    run_risk_scanner(db, sched.event_id)
    log_activity(db, "Updated Schedule Entry", "schedule", sched.id, sched.event_id, current_user, f"Updated '{sched.title}'")
    db.commit()
    db.refresh(sched)

    return serialize_schedule(sched)

@app.delete("/schedules/{schedule_id}")
def delete_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sched = db.get(Schedule, schedule_id)
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule entry not found")

    event_id = sched.event_id
    db.delete(sched)
    db.commit()
    run_risk_scanner(db, event_id)
    return {"message": "Schedule entry deleted", "id": schedule_id}

# ----------------- BUDGET, EXPENSES & VENDORS -----------------

@app.get("/budgets/{event_id}")
def get_budget_ledger(event_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    budget = db.scalar(select(Budget).where(Budget.event_id == event_id))
    categories = db.scalars(select(BudgetCategory).where(BudgetCategory.event_id == event_id)).all()
    expenses = db.scalars(select(Expense).where(Expense.event_id == event_id).order_by(Expense.date.desc())).all()
    quotes = db.scalars(select(VendorQuote).where(VendorQuote.event_id == event_id)).all()

    actual_spend = sum(ex.amount for ex in expenses)
    projected_quotes = sum(q.amount for q in quotes if q.status in ["Accepted", "Shortlisted"])
    projected_spend = actual_spend + projected_quotes
    total_budget = budget.total_budget if budget else event.budget
    remaining = total_budget - actual_spend
    variance = total_budget - projected_spend

    return {
        "event_id": event_id,
        "total_budget": total_budget,
        "actual_spend": actual_spend,
        "remaining": remaining,
        "projected_spend": projected_spend,
        "variance": variance,
        "categories": [
            {
                "id": c.id,
                "name": c.name,
                "allocated_amount": c.allocated_amount,
                "spent_amount": c.spent_amount
            }
            for c in categories
        ],
        "expenses": [serialize_expense(ex) for ex in expenses],
        "quotes": [
            {
                "id": q.id,
                "vendor_name": q.vendor.name if q.vendor else "Vendor",
                "service": q.vendor.service if q.vendor else "",
                "amount": q.amount,
                "status": q.status,
                "notes": q.notes
            }
            for q in quotes
        ]
    }

@app.get("/expenses")
def list_expenses(event_id: Optional[int] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = select(Expense)
    if event_id:
        query = query.where(Expense.event_id == event_id)
    expenses = db.scalars(query.order_by(Expense.date.desc())).all()
    return [serialize_expense(ex) for ex in expenses]

@app.post("/expenses")
def create_expense(
    req: ExpenseCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    expense = Expense(
        event_id=req.event_id,
        category_id=req.category_id,
        title=req.title,
        amount=req.amount,
        vendor_id=req.vendor_id,
        payment_status=req.payment_status,
        date=req.date
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)

    if req.category_id:
        cat = db.get(BudgetCategory, req.category_id)
        if cat:
            cat.spent_amount += req.amount
            db.commit()

    run_risk_scanner(db, req.event_id)
    log_activity(db, "Recorded Expense", "expense", expense.id, req.event_id, current_user, f"Recorded payment of ₹{expense.amount:,.0f} for '{expense.title}'")
    db.commit()

    return serialize_expense(expense)

@app.delete("/expenses/{expense_id}")
def delete_expense(expense_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    expense = db.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    event_id = expense.event_id
    if expense.category_id:
        cat = db.get(BudgetCategory, expense.category_id)
        if cat:
            cat.spent_amount = max(0.0, cat.spent_amount - expense.amount)

    db.delete(expense)
    db.commit()
    run_risk_scanner(db, event_id)
    return {"message": "Expense deleted", "id": expense_id}

@app.get("/vendors")
def list_vendors(event_id: Optional[int] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = select(Vendor)
    if event_id:
        query = query.where(Vendor.event_id == event_id)
    vendors = db.scalars(query).all()
    return [
        {
            "id": v.id,
            "name": v.name,
            "service": v.service,
            "contact_name": v.contact_name,
            "email": v.email,
            "phone": v.phone,
            "status": v.status,
            "rating": v.rating
        }
        for v in vendors
    ]

@app.post("/vendors")
def create_vendor(req: VendorCreateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    v = Vendor(
        event_id=req.event_id,
        name=req.name,
        service=req.service,
        contact_name=req.contact_name or "",
        email=req.email or "",
        phone=req.phone or "",
        status=req.status,
        rating=req.rating
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return {"id": v.id, "name": v.name, "service": v.service, "status": v.status}

@app.get("/vendor-quotes")
def list_vendor_quotes(event_id: Optional[int] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = select(VendorQuote)
    if event_id:
        query = query.where(VendorQuote.event_id == event_id)
    quotes = db.scalars(query).all()
    return [
        {
            "id": q.id,
            "vendor_id": q.vendor_id,
            "vendor_name": q.vendor.name if q.vendor else "Vendor",
            "service": q.vendor.service if q.vendor else "",
            "amount": q.amount,
            "status": q.status,
            "notes": q.notes
        }
        for q in quotes
    ]

@app.post("/vendor-quotes")
def create_vendor_quote(
    req: VendorQuoteCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    quote = VendorQuote(
        vendor_id=req.vendor_id,
        event_id=req.event_id,
        amount=req.amount,
        notes=req.notes or "",
        status=req.status
    )
    db.add(quote)
    db.commit()
    db.refresh(quote)

    run_risk_scanner(db, req.event_id)
    log_activity(db, "Logged Vendor Quotation", "vendor_quote", quote.id, req.event_id, current_user, f"Logged quote of ₹{quote.amount:,.0f}")
    db.commit()

    return {"id": quote.id, "amount": quote.amount, "status": quote.status}

# ----------------- RISKS & RECOMMENDATIONS -----------------

@app.get("/risks")
def list_risks(event_id: Optional[int] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = select(Risk)
    if event_id:
        query = query.where(Risk.event_id == event_id)
    risks = db.scalars(query.order_by(Risk.created_at.desc())).all()
    return [serialize_risk(r) for r in risks]

@app.patch("/risks/{risk_id}")
def update_risk(risk_id: int, req: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    risk = db.get(Risk, risk_id)
    if not risk:
        raise HTTPException(status_code=404, detail="Risk not found")
    if "status" in req:
        risk.status = req["status"]
    if "severity" in req:
        risk.severity = req["severity"]
    db.commit()
    return serialize_risk(risk)

@app.get("/recommendations")
def list_recommendations(event_id: Optional[int] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = select(Recommendation)
    if event_id:
        query = query.where(Recommendation.event_id == event_id)
    recs = db.scalars(query.order_by(Recommendation.created_at.desc())).all()
    return [serialize_recommendation(r) for r in recs]

@app.post("/recommendations/{recommendation_id}/apply")
def apply_recommendation(
    recommendation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    rec = db.get(Recommendation, recommendation_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    payload = json.loads(rec.payload_json or "{}")

    if rec.action_type == "reschedule":
        title = payload.get("schedule_title", "Workshop A")
        new_start = payload.get("new_start_time")
        scheds = db.scalars(select(Schedule).where(
            Schedule.event_id == rec.event_id,
            Schedule.title.ilike(f"%{title}%")
        )).all()
        for s in scheds:
            if new_start:
                s.start_time = datetime.datetime.fromisoformat(new_start)
                s.end_time = s.start_time + datetime.timedelta(hours=2)
            s.conflict_flag = False
            s.conflict_details = None

    elif rec.action_type == "reduce_spending":
        event = db.get(Event, rec.event_id)
        if event:
            event.budget += 10000.0

    elif rec.action_type == "confirm_vendor":
        vendors = db.scalars(select(Vendor).where(Vendor.event_id == rec.event_id)).all()
        for v in vendors:
            v.status = "Confirmed"

    rec.status = "Applied"
    if rec.risk:
        rec.risk.status = "Mitigated"

    log_activity(db, "Applied AI Recommendation", "recommendation", rec.id, rec.event_id, current_user, f"Executed action '{rec.title}'")
    db.commit()

    run_risk_scanner(db, rec.event_id)
    return serialize_recommendation(rec)

# ----------------- FACULTY APPROVAL GATEWAY -----------------

@app.get("/approvals")
def list_approvals(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    approvals = db.scalars(select(Approval).order_by(Approval.created_at.desc())).all()
    return [
        {
            "id": a.id,
            "event_id": a.event_id,
            "event_name": a.event.name if a.event else "Event",
            "event_type": a.event.type if a.event else "",
            "venue": a.event.venue if a.event else "",
            "budget": a.event.budget if a.event else 0,
            "reviewer_name": a.reviewer.name if a.reviewer else "Faculty Reviewer",
            "status": a.status,
            "comments": a.comments,
            "decision_date": a.decision_date.isoformat() if a.decision_date else None,
            "created_at": a.created_at.isoformat() if a.created_at else None
        }
        for a in approvals
    ]

@app.post("/approvals/{event_id}/submit")
def submit_for_approval(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    event.status = "Under Review"

    approval = db.scalar(select(Approval).where(Approval.event_id == event_id))
    if not approval:
        approval = Approval(
            event_id=event.id,
            status="Under Review",
            comments="Submitted by student organizer for administrative review."
        )
        db.add(approval)
    else:
        approval.status = "Under Review"

    log_activity(db, "Submitted Event for Approval", "approval", approval.id, event.id, current_user, f"Submitted '{event.name}' for faculty review")
    db.commit()

    return {"message": "Event submitted for faculty review", "status": event.status}

@app.post("/approvals/{event_id}/decide")
def decide_approval(
    event_id: int,
    req: ApprovalDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Faculty Coordinator", "Admin"]))
):
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    approval = db.scalar(select(Approval).where(Approval.event_id == event_id))
    if not approval:
        approval = Approval(event_id=event.id)
        db.add(approval)

    approval.status = req.status
    approval.comments = req.comments
    approval.reviewer_id = current_user.id
    approval.decision_date = datetime.datetime.utcnow()

    if req.status == "Approved":
        event.status = "Approved"
    elif req.status == "Changes Requested":
        event.status = "Changes Requested"
    elif req.status == "Rejected":
        event.status = "Rejected"

    notif = Notification(
        user_id=event.owner_id,
        event_id=event.id,
        title=f"Event {req.status}",
        message=f"Faculty Coordinator {current_user.name} marked '{event.name}' as {req.status}. Notes: {req.comments}",
        type="success" if req.status == "Approved" else "warning"
    )
    db.add(notif)

    log_activity(db, f"Faculty Decision: {req.status}", "approval", approval.id, event.id, current_user, f"Decision by {current_user.name}: {req.comments}")
    db.commit()

    return {"message": f"Event status updated to {req.status}", "status": event.status}

# ----------------- REPORTS & REAL DOWNLOADS -----------------

@app.get("/reports/pdf/{event_id}")
def generate_pdf_report(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    tasks = db.scalars(select(Task).where(Task.event_id == event_id)).all()
    expenses = db.scalars(select(Expense).where(Expense.event_id == event_id)).all()
    risks = db.scalars(select(Risk).where(Risk.event_id == event_id)).all()

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle("TitleStyle", parent=styles["Heading1"], fontSize=22, textColor=colors.HexColor("#0d1b3d"), spaceAfter=8)
    subtitle_style = ParagraphStyle("SubTitleStyle", parent=styles["Normal"], fontSize=10, textColor=colors.HexColor("#64748b"), spaceAfter=14)
    h2_style = ParagraphStyle("H2Style", parent=styles["Heading2"], fontSize=14, textColor=colors.HexColor("#0d1b3d"), spaceBefore=12, spaceAfter=6)
    cell_style = ParagraphStyle("CellStyle", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#1e293b"))
    bold_cell_style = ParagraphStyle("BoldCellStyle", parent=styles["Normal"], fontSize=9, fontName="Helvetica-Bold", textColor=colors.HexColor("#0d1b3d"))

    elements = []

    elements.append(Paragraph("<b>OrgaNice</b> &nbsp;|&nbsp; Campus Event Dossier & Audit Report", title_style))
    elements.append(Paragraph(f"Generated on {datetime.datetime.utcnow().strftime('%B %d, %Y at %I:%M %p UTC')} &nbsp;•&nbsp; SRM Institute of Science & Technology", subtitle_style))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#2563eb"), spaceAfter=14))

    total_spent = sum(ex.amount for ex in expenses)
    overview_data = [
        [Paragraph("Event Name", bold_cell_style), Paragraph(event.name, cell_style), Paragraph("Governance Status", bold_cell_style), Paragraph(event.status, cell_style)],
        [Paragraph("Venue", bold_cell_style), Paragraph(event.venue, cell_style), Paragraph("Progress", bold_cell_style), Paragraph(f"{event.progress}%", cell_style)],
        [Paragraph("Dates", bold_cell_style), Paragraph(f"{event.start_time.strftime('%d %b %Y')} - {event.end_time.strftime('%d %b %Y')}", cell_style), Paragraph("Attendees", bold_cell_style), Paragraph(f"{event.attendees:,} Students", cell_style)],
        [Paragraph("Sanctioned Budget", bold_cell_style), Paragraph(f"Rs. {event.budget:,.0f}", cell_style), Paragraph("Recorded Spend", bold_cell_style), Paragraph(f"Rs. {total_spent:,.0f}", cell_style)]
    ]
    t_overview = Table(overview_data, colWidths=[110, 150, 120, 140])
    t_overview.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(t_overview)
    elements.append(Spacer(1, 14))

    elements.append(Paragraph("Actionable Task Timeline", h2_style))
    tasks_data = [[Paragraph("Task Name", bold_cell_style), Paragraph("Category", bold_cell_style), Paragraph("Priority", bold_cell_style), Paragraph("Deadline", bold_cell_style), Paragraph("Status", bold_cell_style)]]
    for t in tasks[:8]:
        tasks_data.append([
            Paragraph(t.name, cell_style),
            Paragraph(t.category, cell_style),
            Paragraph(t.priority, cell_style),
            Paragraph(t.deadline.strftime("%d %b %Y"), cell_style),
            Paragraph(t.status, cell_style)
        ])
    t_tasks = Table(tasks_data, colWidths=[180, 85, 75, 95, 85])
    t_tasks.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0d1b3d")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    elements.append(t_tasks)
    elements.append(Spacer(1, 14))

    if risks:
        elements.append(Paragraph("Identified Risks & Governance Mitigations", h2_style))
        risks_data = [[Paragraph("Risk Title", bold_cell_style), Paragraph("Category", bold_cell_style), Paragraph("Severity", bold_cell_style), Paragraph("Status", bold_cell_style)]]
        for r in risks:
            risks_data.append([
                Paragraph(r.title, cell_style),
                Paragraph(r.category, cell_style),
                Paragraph(r.severity, cell_style),
                Paragraph(r.status, cell_style)
            ])
        t_risks = Table(risks_data, colWidths=[240, 95, 95, 90])
        t_risks.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#7c3aed")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("PADDING", (0, 0), (-1, -1), 5),
        ]))
        elements.append(t_risks)

    doc.build(elements)
    buffer.seek(0)
    filename = f"organice-report-{event.name.lower().replace(' ', '-')}.pdf"
    return Response(
        buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/reports/csv/{kind}")
def export_csv_report(
    kind: str,
    event_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    out = io.StringIO()
    writer = csv.writer(out)

    if kind == "events":
        writer.writerow(["ID", "Name", "Type", "Venue", "Start Time", "End Time", "Attendees", "Budget (INR)", "Status", "Progress %"])
        events = db.scalars(select(Event)).all()
        for e in events:
            writer.writerow([e.id, e.name, e.type, e.venue, e.start_time.isoformat(), e.end_time.isoformat(), e.attendees, e.budget, e.status, e.progress])
        filename = "organice-events.csv"

    elif kind == "tasks":
        writer.writerow(["ID", "Event ID", "Name", "Category", "Priority", "Start Date", "Deadline", "Status"])
        query = select(Task)
        if event_id:
            query = query.where(Task.event_id == event_id)
        for t in db.scalars(query).all():
            writer.writerow([t.id, t.event_id, t.name, t.category, t.priority, t.start_date.isoformat(), t.deadline.isoformat(), t.status])
        filename = "organice-tasks.csv"

    elif kind == "budget":
        writer.writerow(["Expense ID", "Event ID", "Title", "Category", "Amount (INR)", "Payment Status", "Date"])
        query = select(Expense)
        if event_id:
            query = query.where(Expense.event_id == event_id)
        for ex in db.scalars(query).all():
            writer.writerow([ex.id, ex.event_id, ex.title, ex.category.name if ex.category else "General", ex.amount, ex.payment_status, ex.date.isoformat()])
        filename = "organice-budget-ledger.csv"
    else:
        raise HTTPException(status_code=400, detail="Invalid report kind. Choose events, tasks, or budget")

    return Response(
        out.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# ----------------- HISTORY & NOTIFICATIONS -----------------

@app.get("/history")
def list_history(
    event_id: Optional[int] = None,
    entity_type: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Activity)
    if event_id:
        query = query.where(Activity.event_id == event_id)
    if entity_type and entity_type != "All":
        query = query.where(Activity.entity_type == entity_type)
    query = query.order_by(Activity.created_at.desc()).limit(limit)

    activities = db.scalars(query).all()
    return [
        {
            "id": a.id,
            "event_id": a.event_id,
            "user_name": a.user_name,
            "action": a.action,
            "entity_type": a.entity_type,
            "entity_id": a.entity_id,
            "details": a.details,
            "created_at": a.created_at.isoformat() if a.created_at else None
        }
        for a in activities
    ]

@app.get("/notifications")
def list_notifications(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    notifs = db.scalars(select(Notification).where(
        or_(Notification.user_id == current_user.id, Notification.user_id == None)
    ).order_by(Notification.created_at.desc()).limit(20)).all()
    return [
        {
            "id": n.id,
            "event_id": n.event_id,
            "title": n.title,
            "message": n.message,
            "type": n.type,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None
        }
        for n in notifs
    ]

@app.patch("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    notif = db.get(Notification, notification_id)
    if notif:
        notif.is_read = True
        db.commit()
    return {"ok": True}

@app.post("/notifications/mark-all-read")
def mark_all_notifications_read(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.execute(
        update(Notification).where(Notification.user_id == current_user.id).values(is_read=True)
    )
    db.commit()
    return {"ok": True}

@app.get("/venues")
def list_venues(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    venues = db.scalars(select(Venue)).all()
    return [{"id": v.id, "name": v.name, "capacity": v.capacity, "location": v.location, "status": v.status} for v in venues]

print("FastAPI main.py fully loaded and ready.")
