import datetime
from typing import Optional, List
from sqlalchemy import (
    String, Integer, Float, DateTime, ForeignKey, Text, Boolean, Enum
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base

class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, default="SRMIST")
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    users: Mapped[List["User"]] = relationship(back_populates="organization_rel")
    events: Mapped[List["Event"]] = relationship(back_populates="organization_rel")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="Organizer")  # Organizer, Faculty Coordinator, Admin, Team Member
    organization: Mapped[str] = mapped_column(String(120), default="SRM Institute of Science & Technology")
    organization_id: Mapped[Optional[int]] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    organization_rel: Mapped[Optional["Organization"]] = relationship(back_populates="users")
    events: Mapped[List["Event"]] = relationship(back_populates="owner")
    team_memberships: Mapped[List["TeamMember"]] = relationship(back_populates="user")
    notifications: Mapped[List["Notification"]] = relationship(back_populates="user")


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[str] = mapped_column(String(80), default="Technical Fest")  # Technical Fest, Cultural, Hackathon, Workshop
    venue: Mapped[str] = mapped_column(String(150), default="Main Auditorium")
    start_time: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    attendees: Mapped[int] = mapped_column(Integer, default=500)
    budget: Mapped[float] = mapped_column(Float, default=100000.0)
    status: Mapped[str] = mapped_column(String(50), default="Draft")  # Draft, Submitted, Under Review, Approved, Active, Completed, Archived
    progress: Mapped[int] = mapped_column(Integer, default=0)
    description: Mapped[str] = mapped_column(Text, default="")
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    organization_id: Mapped[Optional[int]] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    owner: Mapped["User"] = relationship(back_populates="events")
    organization_rel: Mapped[Optional["Organization"]] = relationship(back_populates="events")
    tasks: Mapped[List["Task"]] = relationship(back_populates="event", cascade="all, delete-orphan")
    schedules: Mapped[List["Schedule"]] = relationship(back_populates="event", cascade="all, delete-orphan")
    team_members: Mapped[List["TeamMember"]] = relationship(back_populates="event", cascade="all, delete-orphan")
    expenses: Mapped[List["Expense"]] = relationship(back_populates="event", cascade="all, delete-orphan")
    vendors: Mapped[List["Vendor"]] = relationship(back_populates="event", cascade="all, delete-orphan")
    vendor_quotes: Mapped[List["VendorQuote"]] = relationship(back_populates="event", cascade="all, delete-orphan")
    risks: Mapped[List["Risk"]] = relationship(back_populates="event", cascade="all, delete-orphan")
    recommendations: Mapped[List["Recommendation"]] = relationship(back_populates="event", cascade="all, delete-orphan")
    approvals: Mapped[List["Approval"]] = relationship(back_populates="event", cascade="all, delete-orphan")
    activities: Mapped[List["Activity"]] = relationship(back_populates="event", cascade="all, delete-orphan")


class Venue(Base):
    __tablename__ = "venues"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False, unique=True)
    capacity: Mapped[int] = mapped_column(Integer, default=500)
    location: Mapped[str] = mapped_column(String(150), default="Campus Tech Park")
    status: Mapped[str] = mapped_column(String(50), default="Available")  # Available, Booked, Maintenance


class TeamMember(Base):
    __tablename__ = "team_members"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    event_id: Mapped[Optional[int]] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(80), default="Coordinator")  # Lead Organizer, Logistics Lead, Technical Lead, Finance Coordinator, Volunteer
    department: Mapped[str] = mapped_column(String(100), default="School of Computing")
    workload_status: Mapped[str] = mapped_column(String(50), default="Normal")  # Normal, Heavy, Overloaded
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    event: Mapped[Optional["Event"]] = relationship(back_populates="team_members")
    user: Mapped[Optional["User"]] = relationship(back_populates="team_memberships")
    assigned_tasks: Mapped[List["Task"]] = relationship(back_populates="assigned_member")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    assigned_member_id: Mapped[Optional[int]] = mapped_column(ForeignKey("team_members.id"), nullable=True)
    priority: Mapped[str] = mapped_column(String(40), default="Medium")  # Low, Medium, High, Critical
    start_date: Mapped[datetime.date] = mapped_column(nullable=False)
    deadline: Mapped[datetime.date] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="To Do")  # To Do, In Progress, Done
    category: Mapped[str] = mapped_column(String(80), default="Logistics")
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    event: Mapped["Event"] = relationship(back_populates="tasks")
    assigned_member: Mapped[Optional["TeamMember"]] = relationship(back_populates="assigned_tasks")
    dependencies: Mapped[List["TaskDependency"]] = relationship(
        foreign_keys="TaskDependency.task_id",
        back_populates="task",
        cascade="all, delete-orphan"
    )


class TaskDependency(Base):
    __tablename__ = "task_dependencies"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    depends_on_task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)

    task: Mapped["Task"] = relationship("Task", foreign_keys=[task_id], back_populates="dependencies")
    prerequisite: Mapped["Task"] = relationship("Task", foreign_keys=[depends_on_task_id])


class Schedule(Base):
    __tablename__ = "schedules"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    venue: Mapped[str] = mapped_column(String(150), default="Main Auditorium")
    start_time: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    team: Mapped[str] = mapped_column(String(100), default="Logistics")
    description: Mapped[str] = mapped_column(Text, default="")
    speaker: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    conflict_flag: Mapped[bool] = mapped_column(Boolean, default=False)
    conflict_details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    event: Mapped["Event"] = relationship(back_populates="schedules")


class Budget(Base):
    __tablename__ = "budgets"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), unique=True, nullable=False)
    total_budget: Mapped[float] = mapped_column(Float, default=100000.0)
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    categories: Mapped[List["BudgetCategory"]] = relationship(back_populates="budget", cascade="all, delete-orphan")


class BudgetCategory(Base):
    __tablename__ = "budget_categories"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    budget_id: Mapped[int] = mapped_column(ForeignKey("budgets.id", ondelete="CASCADE"), nullable=False)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # Logistics, Marketing, Tech & AV, Catering, Speakers, Prizes
    allocated_amount: Mapped[float] = mapped_column(Float, default=0.0)
    spent_amount: Mapped[float] = mapped_column(Float, default=0.0)

    budget: Mapped["Budget"] = relationship(back_populates="categories")
    expenses: Mapped[List["Expense"]] = relationship(back_populates="category")


class Vendor(Base):
    __tablename__ = "vendors"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    event_id: Mapped[Optional[int]] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    service: Mapped[str] = mapped_column(String(120), nullable=False)  # Catering, Audio/Visual, Stage & Lights, Printing & Merchandise, Security
    contact_name: Mapped[str] = mapped_column(String(120), default="")
    email: Mapped[str] = mapped_column(String(255), default="")
    phone: Mapped[str] = mapped_column(String(40), default="")
    status: Mapped[str] = mapped_column(String(50), default="Confirmed")  # Confirmed, Pending, Contacted
    rating: Mapped[float] = mapped_column(Float, default=4.5)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    event: Mapped[Optional["Event"]] = relationship(back_populates="vendors")
    quotes: Mapped[List["VendorQuote"]] = relationship(back_populates="vendor", cascade="all, delete-orphan")
    expenses: Mapped[List["Expense"]] = relationship(back_populates="vendor")


class VendorQuote(Base):
    __tablename__ = "vendor_quotes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(50), default="Shortlisted")  # Received, Shortlisted, Accepted, Rejected
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    vendor: Mapped["Vendor"] = relationship(back_populates="quotes")
    event: Mapped["Event"] = relationship(back_populates="vendor_quotes")


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("budget_categories.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    vendor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("vendors.id"), nullable=True)
    payment_status: Mapped[str] = mapped_column(String(40), default="Paid")  # Paid, Pending, Approved
    receipt_url: Mapped[str] = mapped_column(String(255), default="")
    date: Mapped[datetime.date] = mapped_column(nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    event: Mapped["Event"] = relationship(back_populates="expenses")
    category: Mapped[Optional["BudgetCategory"]] = relationship(back_populates="expenses")
    vendor: Mapped[Optional["Vendor"]] = relationship(back_populates="expenses")


class Risk(Base):
    __tablename__ = "risks"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(80), default="Schedule")  # Budget, Schedule, Venue, Staffing, Approval, Technical
    severity: Mapped[str] = mapped_column(String(40), default="High")  # Low, Medium, High, Critical
    status: Mapped[str] = mapped_column(String(40), default="Open")  # Open, Mitigated, Resolved
    detail: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    event: Mapped["Event"] = relationship(back_populates="risks")
    recommendations: Mapped[List["Recommendation"]] = relationship(back_populates="risk", cascade="all, delete-orphan")


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    risk_id: Mapped[Optional[int]] = mapped_column(ForeignKey("risks.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    action_type: Mapped[str] = mapped_column(String(80), default="reschedule")  # reschedule, reallocate_budget, assign_volunteer, confirm_vendor, reduce_spending
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    status: Mapped[str] = mapped_column(String(40), default="Open")  # Open, Applied, Dismissed
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    event: Mapped["Event"] = relationship(back_populates="recommendations")
    risk: Mapped[Optional["Risk"]] = relationship(back_populates="recommendations")


class Approval(Base):
    __tablename__ = "approvals"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    reviewer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="Submitted")  # Draft, Submitted, Under Review, Approved, Changes Requested, Rejected
    comments: Mapped[str] = mapped_column(Text, default="")
    decision_date: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    event: Mapped["Event"] = relationship(back_populates="approvals")
    reviewer: Mapped[Optional["User"]] = relationship()


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    event_id: Mapped[Optional[int]] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=True)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(String(50), default="info")  # info, warning, success, error
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="notifications")


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    event_id: Mapped[Optional[int]] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    user_name: Mapped[str] = mapped_column(String(120), default="System")
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(60), default="event")  # event, task, expense, schedule, approval, ai
    entity_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    details: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    event: Mapped[Optional["Event"]] = relationship(back_populates="activities")


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    event_id: Mapped[Optional[int]] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=True)
    report_type: Mapped[str] = mapped_column(String(50), default="PDF")  # PDF, CSV
    file_path: Mapped[str] = mapped_column(String(255), default="")
    generated_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)


class AIGeneration(Base):
    __tablename__ = "ai_generations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    event_id: Mapped[Optional[int]] = mapped_column(ForeignKey("events.id", ondelete="SET NULL"), nullable=True)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    response_json: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str] = mapped_column(String(80), default="gpt-4o-mini")
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
