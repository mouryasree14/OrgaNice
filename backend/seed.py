import datetime
import json
from passlib.context import CryptContext
from sqlalchemy import select, func
from database import engine, SessionLocal, Base
from models import (
    User, Organization, Event, Venue, TeamMember, Task, TaskDependency,
    Schedule, Budget, BudgetCategory, Expense, Vendor, VendorQuote,
    Risk, Recommendation, Approval, Notification, Activity
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def run_seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Check if already seeded
        user_count = db.scalar(select(func.count(User.id)))
        if user_count and user_count > 0:
            print("Database already contains data, skipping seed.")
            return

        print("Seeding database with realistic campus data...")

        # 1. Organization
        org = Organization(
            name="SRM Institute of Science & Technology",
            code="SRMIST"
        )
        db.add(org)
        db.commit()
        db.refresh(org)

        # 2. Users
        users = [
            User(
                name="Aakash Sharma",
                email="organizer@organice.local",
                hashed_password=pwd_context.hash("password123"),
                role="Organizer",
                organization="School of Computing, SRMIST",
                organization_id=org.id
            ),
            User(
                name="Dr. Radhika Menon",
                email="faculty@organice.local",
                hashed_password=pwd_context.hash("password123"),
                role="Faculty Coordinator",
                organization="Dean Student Affairs, SRMIST",
                organization_id=org.id
            ),
            User(
                name="Siddharth Roy",
                email="admin@organice.local",
                hashed_password=pwd_context.hash("password123"),
                role="Admin",
                organization="Campus Administration Hub",
                organization_id=org.id
            ),
            User(
                name="Priya Patel",
                email="priya@organice.local",
                hashed_password=pwd_context.hash("password123"),
                role="Team Member",
                organization="Logistics Committee",
                organization_id=org.id
            ),
            User(
                name="Arun Kumar",
                email="arun@organice.local",
                hashed_password=pwd_context.hash("password123"),
                role="Team Member",
                organization="Technical Committee",
                organization_id=org.id
            )
        ]
        db.add_all(users)
        db.commit()
        for u in users:
            db.refresh(u)

        organizer_user = users[0]
        faculty_user = users[1]

        # 3. Venues
        venues = [
            Venue(name="Main Auditorium", capacity=1200, location="Tech Park Block 1", status="Available"),
            Venue(name="Seminar Hall", capacity=300, location="TP Ganesan Building", status="Available"),
            Venue(name="Open-Air Theatre", capacity=2500, location="Campus Central Lawns", status="Available"),
            Venue(name="Innovation Lab", capacity=200, location="Bio-Engineering Block 4", status="Available"),
            Venue(name="Tech Park Amphitheatre", capacity=800, location="Tech Park Plaza", status="Available")
        ]
        db.add_all(venues)
        db.commit()

        # 4. Events
        now = datetime.datetime.utcnow()
        # Dates: TechFest 2.0 starts in 14 days, Cultural Night in 28 days, Hackathon in 40 days
        tf_start = (now + datetime.timedelta(days=14)).replace(hour=9, minute=0, second=0, microsecond=0)
        tf_end = tf_start + datetime.timedelta(days=2, hours=9)

        cn_start = (now + datetime.timedelta(days=28)).replace(hour=17, minute=0, second=0, microsecond=0)
        cn_end = cn_start + datetime.timedelta(hours=6)

        hk_start = (now + datetime.timedelta(days=40)).replace(hour=10, minute=0, second=0, microsecond=0)
        hk_end = hk_start + datetime.timedelta(days=1, hours=8)

        event_tf = Event(
            name="TechFest 2.0",
            type="Technical Fest",
            venue="Main Auditorium",
            start_time=tf_start,
            end_time=tf_end,
            attendees=500,
            budget=150000.0,
            status="Active",
            progress=65,
            description="Flagship annual inter-collegiate technical fest with hackathons, robotic workshops, AI keynote talks, and project exhibitions.",
            owner_id=organizer_user.id,
            organization_id=org.id
        )

        event_cn = Event(
            name="Cultural Night 2026",
            type="Cultural",
            venue="Open-Air Theatre",
            start_time=cn_start,
            end_time=cn_end,
            attendees=800,
            budget=80000.0,
            status="Approved",
            progress=45,
            description="Grand cultural evening featuring musical performances, dance troupes, drama showcases, and celebrity guest appearance.",
            owner_id=organizer_user.id,
            organization_id=org.id
        )

        event_hk = Event(
            name="Hackathon 2026",
            type="Hackathon",
            venue="Innovation Lab",
            start_time=hk_start,
            end_time=hk_end,
            attendees=200,
            budget=45000.0,
            status="Under Review",
            progress=25,
            description="24-hour rapid prototyping hackathon focusing on generative AI and sustainability solutions with cash prizes.",
            owner_id=organizer_user.id,
            organization_id=org.id
        )

        db.add_all([event_tf, event_cn, event_hk])
        db.commit()
        db.refresh(event_tf)
        db.refresh(event_cn)
        db.refresh(event_hk)

        # 5. Team Members for TechFest 2.0
        members_tf = [
            TeamMember(
                event_id=event_tf.id,
                user_id=organizer_user.id,
                name="Aakash Sharma",
                email="organizer@organice.local",
                role="Lead Organizer",
                department="School of Computing",
                workload_status="Normal"
            ),
            TeamMember(
                event_id=event_tf.id,
                user_id=users[3].id,
                name="Priya Patel",
                email="priya@organice.local",
                role="Logistics Lead",
                department="Logistics Committee",
                workload_status="Normal"
            ),
            TeamMember(
                event_id=event_tf.id,
                user_id=users[4].id,
                name="Arun Kumar",
                email="arun@organice.local",
                role="Technical Lead",
                department="Technical Committee",
                workload_status="Heavy"
            ),
            TeamMember(
                event_id=event_tf.id,
                name="Sneha Rao",
                email="sneha.rao@srmist.edu.in",
                role="Finance Coordinator",
                department="Management Studies",
                workload_status="Normal"
            )
        ]
        db.add_all(members_tf)
        db.commit()
        for m in members_tf:
            db.refresh(m)

        # 6. Tasks for TechFest 2.0
        today = now.date()
        tasks_data = [
            ("Confirm Venue Booking & Permissions", "Logistics", "High", "Done", members_tf[1].id, today - datetime.timedelta(days=10), today - datetime.timedelta(days=2)),
            ("Finalize Corporate Sponsors & MoU", "Sponsorship", "High", "Done", members_tf[0].id, today - datetime.timedelta(days=8), today - datetime.timedelta(days=1)),
            ("Launch Website & Online Registrations", "Technical", "Medium", "Done", members_tf[2].id, today - datetime.timedelta(days=5), today + datetime.timedelta(days=2)),
            ("Procure High-Power Sound & AV Systems", "Tech & AV", "Critical", "In Progress", members_tf[1].id, today - datetime.timedelta(days=2), today + datetime.timedelta(days=5)),
            ("Brief 20 Student Volunteers for Registration Desk", "Volunteers", "Medium", "To Do", members_tf[1].id, today + datetime.timedelta(days=2), today + datetime.timedelta(days=8)),
            ("Prepare Certificate & Cash Prize Mementos", "Logistics", "Low", "To Do", members_tf[3].id, today + datetime.timedelta(days=4), today + datetime.timedelta(days=10)),
            ("Coordinate Guest Keynote Travel & Hospitality", "Public Relations", "High", "In Progress", members_tf[0].id, today - datetime.timedelta(days=1), today + datetime.timedelta(days=6)),
            ("Run Full Stage Audio-Visual Dry Run", "Technical", "Critical", "To Do", members_tf[2].id, today + datetime.timedelta(days=11), today + datetime.timedelta(days=13))
        ]

        created_tasks = []
        for name, cat, priority, status, assigned_id, sdate, ddate in tasks_data:
            t = Task(
                event_id=event_tf.id,
                name=name,
                category=cat,
                priority=priority,
                status=status,
                assigned_member_id=assigned_id,
                start_date=sdate,
                deadline=ddate,
                description=f"Detailed execution checklist for {name} regarding {cat} requirements."
            )
            db.add(t)
            created_tasks.append(t)
        db.commit()
        for t in created_tasks:
            db.refresh(t)

        # Task Dependencies (Dry Run depends on Sound procurement)
        if len(created_tasks) >= 8:
            dep1 = TaskDependency(task_id=created_tasks[7].id, depends_on_task_id=created_tasks[3].id)
            db.add(dep1)
            db.commit()

        # 7. Schedules for TechFest 2.0 (with intentional overlap to demonstrate real conflict resolution!)
        sched_day1 = tf_start
        schedules = [
            Schedule(
                event_id=event_tf.id,
                title="Inauguration Ceremony & Lamp Lighting",
                venue="Main Auditorium",
                start_time=sched_day1.replace(hour=9, minute=30),
                end_time=sched_day1.replace(hour=11, minute=0),
                team="Logistics",
                description="Opening address by Vice Chancellor and Dean of Computing.",
                speaker="Dr. C. Muthamizhchelvan"
            ),
            Schedule(
                event_id=event_tf.id,
                title="Workshop A: Hands-on Large Language Models",
                venue="Seminar Hall",
                start_time=sched_day1.replace(hour=14, minute=0),
                end_time=sched_day1.replace(hour=16, minute=0),
                team="Technical",
                description="Hands-on workshop on training and fine-tuning open source models.",
                speaker="Dr. Alex Rivera",
                conflict_flag=True,
                conflict_details="Venue double-booking: Seminar Hall is also scheduled for Sponsor Executive Meet at 2:00 PM."
            ),
            Schedule(
                event_id=event_tf.id,
                title="Sponsor Executive Meet & Networking",
                venue="Seminar Hall",
                start_time=sched_day1.replace(hour=14, minute=0),
                end_time=sched_day1.replace(hour=15, minute=30),
                team="Sponsorship",
                description="Executive discussion with title sponsors and industry delegates.",
                speaker="Campus Placement Cell",
                conflict_flag=True,
                conflict_details="Venue double-booking: Seminar Hall is also scheduled for Workshop A at 2:00 PM."
            ),
            Schedule(
                event_id=event_tf.id,
                title="Grand Hackathon Pitching Round",
                venue="Main Auditorium",
                start_time=sched_day1 + datetime.timedelta(days=1, hours=1),
                end_time=sched_day1 + datetime.timedelta(days=1, hours=4),
                team="Technical",
                description="Top 10 finalists present prototypes before the jury.",
                speaker="Panel of Industry Judges"
            ),
            Schedule(
                event_id=event_tf.id,
                title="Valedictory & Prize Distribution Ceremony",
                venue="Main Auditorium",
                start_time=sched_day1 + datetime.timedelta(days=1, hours=6),
                end_time=sched_day1 + datetime.timedelta(days=1, hours=8),
                team="Logistics",
                description="Announcement of winners, trophy handover, and cultural musical sendoff.",
                speaker="Registrar & Chief Guest"
            )
        ]
        db.add_all(schedules)
        db.commit()

        # 8. Budget & Budget Categories for TechFest 2.0
        budget_tf = Budget(
            event_id=event_tf.id,
            total_budget=150000.0,
            currency="INR",
            notes="Allocated from University Student Affairs & Corporate Sponsorship pool."
        )
        db.add(budget_tf)
        db.commit()
        db.refresh(budget_tf)

        categories = [
            BudgetCategory(budget_id=budget_tf.id, event_id=event_tf.id, name="Logistics & Venue", allocated_amount=40000.0, spent_amount=35000.0),
            BudgetCategory(budget_id=budget_tf.id, event_id=event_tf.id, name="Tech & AV Equipment", allocated_amount=30000.0, spent_amount=25000.0),
            BudgetCategory(budget_id=budget_tf.id, event_id=event_tf.id, name="Catering & Hospitality", allocated_amount=45000.0, spent_amount=30000.0),
            BudgetCategory(budget_id=budget_tf.id, event_id=event_tf.id, name="Marketing & Merchandise", allocated_amount=20000.0, spent_amount=15000.0),
            BudgetCategory(budget_id=budget_tf.id, event_id=event_tf.id, name="Prizes & Mementos", allocated_amount=15000.0, spent_amount=0.0)
        ]
        db.add_all(categories)
        db.commit()
        for c in categories:
            db.refresh(c)

        # 9. Vendors & Quotes
        vendors = [
            Vendor(
                event_id=event_tf.id,
                name="Aura Sound & Visuals",
                service="Audio/Visual & Stage Lights",
                contact_name="Ramesh Kumar",
                email="ramesh@aurasound.in",
                phone="+91 98401 23456",
                status="Confirmed",
                rating=4.8
            ),
            Vendor(
                event_id=event_tf.id,
                name="Anand Caterers & Hospitality",
                service="Lunch & Hi-Tea Catering",
                contact_name="Gopal Anand",
                email="orders@anandcaterers.com",
                phone="+91 98402 34567",
                status="Confirmed",
                rating=4.6
            ),
            Vendor(
                event_id=event_tf.id,
                name="SpeedyPrint Media Solutions",
                service="Banners, ID Badges & Standees",
                contact_name="Deepak Verma",
                email="deepak@speedyprint.in",
                phone="+91 98403 45678",
                status="Pending",
                rating=4.3
            )
        ]
        db.add_all(vendors)
        db.commit()
        for v in vendors:
            db.refresh(v)

        quotes = [
            VendorQuote(vendor_id=vendors[0].id, event_id=event_tf.id, amount=25000.0, notes="Line array speakers, 2 digital mixers, 6 wireless microphones", status="Accepted"),
            VendorQuote(vendor_id=vendors[1].id, event_id=event_tf.id, amount=42000.0, notes="Buffet lunch for 500 attendees x 2 days + guest hi-tea", status="Shortlisted"),
            VendorQuote(vendor_id=vendors[2].id, event_id=event_tf.id, amount=18000.0, notes="500 participant kits, lanyard badges, 6 backdrop flex banners", status="Received")
        ]
        db.add_all(quotes)
        db.commit()

        # 10. Expenses for TechFest 2.0
        expenses = [
            Expense(
                event_id=event_tf.id,
                category_id=categories[0].id,
                title="Auditorium AC & Electric Setup Advance",
                amount=35000.0,
                vendor_id=None,
                payment_status="Paid",
                date=today - datetime.timedelta(days=7)
            ),
            Expense(
                event_id=event_tf.id,
                category_id=categories[1].id,
                title="Audio/Visual Equipment Booking Advance",
                amount=25000.0,
                vendor_id=vendors[0].id,
                payment_status="Paid",
                date=today - datetime.timedelta(days=5)
            ),
            Expense(
                event_id=event_tf.id,
                category_id=categories[2].id,
                title="Guest Speaker Welcome Refreshments",
                amount=5000.0,
                vendor_id=vendors[1].id,
                payment_status="Paid",
                date=today - datetime.timedelta(days=2)
            ),
            Expense(
                event_id=event_tf.id,
                category_id=categories[3].id,
                title="Instagram & Campus Digital Promotion Ad Spend",
                amount=7500.0,
                vendor_id=None,
                payment_status="Approved",
                date=today - datetime.timedelta(days=1)
            )
        ]
        db.add_all(expenses)
        db.commit()

        # 11. Risks
        risks = [
            Risk(
                event_id=event_tf.id,
                title="Venue Schedule Conflict in Seminar Hall",
                category="Schedule",
                severity="High",
                status="Open",
                detail="Workshop A and Sponsor Executive Meet are both scheduled for Seminar Hall on Day 1 at 2:00 PM."
            ),
            Risk(
                event_id=event_tf.id,
                title="Projected Catering Cost Approaching Limit",
                category="Budget",
                severity="Medium",
                status="Open",
                detail="Vendor quotation for catering (₹42,000) coupled with incidental hospitality will push total spending close to allocated ceiling."
            ),
            Risk(
                event_id=event_tf.id,
                title="Keynote Speaker Travel Confirmation Pending",
                category="Staffing",
                severity="High",
                status="Open",
                detail="Keynote speaker flight itinerary has not been finalized 14 days before the event."
            )
        ]
        db.add_all(risks)
        db.commit()
        for r in risks:
            db.refresh(r)

        # 12. Recommendations
        new_slot_time = (sched_day1.replace(hour=15, minute=30)).isoformat()
        rec1 = Recommendation(
            event_id=event_tf.id,
            risk_id=risks[0].id,
            title="Shift Workshop A to Seminar Hall at 3:30 PM",
            action_type="reschedule",
            payload_json=json.dumps({
                "schedule_title": "Workshop A: Hands-on Large Language Models",
                "new_start_time": new_slot_time,
                "duration_minutes": 120,
                "venue": "Seminar Hall"
            }),
            status="Open"
        )
        rec2 = Recommendation(
            event_id=event_tf.id,
            risk_id=risks[1].id,
            title="Optimize Hi-Tea Package to Save ₹7,000",
            action_type="reduce_spending",
            payload_json=json.dumps({
                "category": "Catering & Hospitality",
                "target_reduction": 7000.0,
                "recommendation": "Switch secondary break to campus cafeteria partner coupon model"
            }),
            status="Open"
        )
        rec3 = Recommendation(
            event_id=event_tf.id,
            risk_id=risks[2].id,
            title="Confirm Travel Ticket with Institute Travel Desk",
            action_type="confirm_vendor",
            payload_json=json.dumps({
                "contact": "Dean Office Travel Coordinator",
                "urgency": "Immediate"
            }),
            status="Open"
        )
        db.add_all([rec1, rec2, rec3])
        db.commit()

        # 13. Approvals
        approval_tf = Approval(
            event_id=event_tf.id,
            reviewer_id=faculty_user.id,
            status="Under Review",
            comments="Proposal received. Please resolve the Seminar Hall double booking and confirm student volunteer attendance lists before final sign-off.",
            decision_date=now - datetime.timedelta(days=1)
        )
        approval_cn = Approval(
            event_id=event_cn.id,
            reviewer_id=faculty_user.id,
            status="Approved",
            comments="Approved by Dean Student Affairs. Ensure sound permits comply with campus 10:00 PM cutoff.",
            decision_date=now - datetime.timedelta(days=3)
        )
        approval_hk = Approval(
            event_id=event_hk.id,
            reviewer_id=faculty_user.id,
            status="Submitted",
            comments="Submitted by student coordinator for initial administrative screening."
        )
        db.add_all([approval_tf, approval_cn, approval_hk])
        db.commit()

        # 14. Notifications
        notifications = [
            Notification(
                user_id=organizer_user.id,
                event_id=event_tf.id,
                title="Schedule Conflict Detected",
                message="Workshop A and Sponsor Executive Meet are scheduled at the same time in Seminar Hall.",
                type="warning"
            ),
            Notification(
                user_id=organizer_user.id,
                event_id=event_tf.id,
                title="Faculty Coordinator Comment",
                message="Dr. Radhika Menon requested resolution of venue conflicts before final approval.",
                type="info"
            ),
            Notification(
                user_id=organizer_user.id,
                event_id=event_cn.id,
                title="Event Approved",
                message="Cultural Night 2026 has been approved by Faculty Coordinator.",
                type="success"
            )
        ]
        db.add_all(notifications)
        db.commit()

        # 15. Activities (Audit Log)
        activities = [
            Activity(
                event_id=event_tf.id,
                user_id=organizer_user.id,
                user_name=organizer_user.name,
                action="Created Event",
                entity_type="event",
                entity_id=event_tf.id,
                details="Created initial blueprint for TechFest 2.0 with budget ₹1,50,000."
            ),
            Activity(
                event_id=event_tf.id,
                user_id=organizer_user.id,
                user_name=organizer_user.name,
                action="Added Expense",
                entity_type="expense",
                entity_id=1,
                details="Recorded Auditorium AC & electric setup advance payment of ₹35,000."
            ),
            Activity(
                event_id=event_tf.id,
                user_id=faculty_user.id,
                user_name=faculty_user.name,
                action="Updated Approval",
                entity_type="approval",
                entity_id=approval_tf.id,
                details="Moved TechFest 2.0 to Under Review with comments."
            ),
            Activity(
                event_id=event_cn.id,
                user_id=faculty_user.id,
                user_name=faculty_user.name,
                action="Approved Event",
                entity_type="approval",
                entity_id=approval_cn.id,
                details="Formally approved Cultural Night 2026 for Open-Air Theatre."
            )
        ]
        db.add_all(activities)
        db.commit()

        print("Database successfully seeded with realistic OrgaNice campus records!")
    finally:
        db.close()

if __name__ == "__main__":
    run_seed()
