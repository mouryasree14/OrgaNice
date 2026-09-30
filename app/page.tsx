'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  Sparkles,
  Calendar as CalendarIcon,
  CheckSquare,
  Users,
  Wallet,
  Briefcase,
  ShieldAlert,
  Lightbulb,
  Award,
  FileText,
  History as HistoryIcon,
  Settings as SettingsIcon,
  Plus,
  Search,
  Filter,
  Download,
  Send,
  Menu,
  X,
  ChevronRight,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronDown,
  Bell,
  Trash2,
  Copy,
  Archive,
  RefreshCw,
  Info,
  Check,
  UserCheck
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis
} from 'recharts';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Currency Formatter
const formatINR = (amount: number = 0) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

// Generic API Client
async function apiCall(endpoint: string, token?: string, method: string = 'GET', body?: any) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (!res.ok) {
    let errorDetail = 'API Request Failed';
    try {
      const errJson = await res.json();
      errorDetail = errJson.detail || errorDetail;
    } catch {
      errorDetail = res.statusText || errorDetail;
    }
    throw new Error(errorDetail);
  }

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  return res.blob();
}

// Navigation Items
interface NavItem {
  name: string;
  icon: any;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', icon: LayoutDashboard },
  { name: 'Events', icon: CalendarDays },
  { name: 'AI Planner', icon: Sparkles, badge: 'AI' },
  { name: 'Calendar', icon: CalendarIcon },
  { name: 'Tasks', icon: CheckSquare },
  { name: 'Team', icon: Users },
  { name: 'Budget', icon: Wallet },
  { name: 'Vendors', icon: Briefcase },
  { name: 'Risks', icon: ShieldAlert },
  { name: 'Recommendations', icon: Lightbulb, badge: 'Smart' },
  { name: 'Faculty Approval', icon: Award },
  { name: 'Reports', icon: FileText },
  { name: 'History', icon: HistoryIcon },
  { name: 'Settings', icon: SettingsIcon }
];

export default function OrgaNiceApp() {
  const [token, setToken] = useState<string>('');
  const [user, setUser] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<string>('Landing');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [copilotOpen, setCopilotOpen] = useState<boolean>(false);

  // Global Context State
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [eventsList, setEventsList] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | undefined>(undefined);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: 'success' | 'error' | 'info' }>>([]);

  // Toast helper
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Initial Auth Check
  useEffect(() => {
    const savedToken = localStorage.getItem('organice-token');
    if (savedToken) {
      setToken(savedToken);
      setCurrentPage('Dashboard');
    }
  }, []);

  // Fetch Core Data when Token Changes
  const refreshCoreData = async () => {
    if (!token) return;
    try {
      const [dash, me, evs, notifs] = await Promise.all([
        apiCall('/dashboard', token),
        apiCall('/me', token),
        apiCall('/events', token),
        apiCall('/notifications', token).catch(() => [])
      ]);
      setDashboardData(dash);
      setUser(me);
      setEventsList(evs);
      setNotifications(notifs);

      // Default to first event if not set
      if (!selectedEventId && evs.length > 0) {
        setSelectedEventId(evs[0].id);
      }
    } catch (err: any) {
      console.error(err);
      if (err.message.includes('token') || err.message.includes('401')) {
        localStorage.removeItem('organice-token');
        setToken('');
        setCurrentPage('Login');
        showToast('Session expired. Please log in again.', 'error');
      }
    }
  };

  useEffect(() => {
    if (token) {
      refreshCoreData();
    }
  }, [token]);

  const handleLoginSuccess = (newToken: string, newUser: any) => {
    localStorage.setItem('organice-token', newToken);
    setToken(newToken);
    setUser(newUser);
    setCurrentPage('Dashboard');
    showToast(`Welcome back, ${newUser.name}!`, 'success');
  };

  const handleLogout = () => {
    localStorage.removeItem('organice-token');
    setToken('');
    setUser(null);
    setCurrentPage('Landing');
    showToast('Logged out successfully', 'info');
  };

  // Selected Event Object
  const currentEvent = useMemo(() => {
    return eventsList.find((e) => e.id === selectedEventId) || eventsList[0];
  }, [eventsList, selectedEventId]);

  // Unread Notifications Count
  const unreadNotifsCount = useMemo(() => {
    return notifications.filter((n) => !n.is_read).length;
  }, [notifications]);

  // If on landing or auth pages
  if (currentPage === 'Landing') {
    return (
      <LandingPageView
        onLogin={() => setCurrentPage('Login')}
        onRegister={() => setCurrentPage('Register')}
        onExplore={() => {
          if (token) setCurrentPage('Dashboard');
          else setCurrentPage('Login');
        }}
      />
    );
  }

  if (currentPage === 'Login' || currentPage === 'Register') {
    return (
      <AuthPageView
        mode={currentPage}
        onSuccess={handleLoginSuccess}
        onBack={() => setCurrentPage('Landing')}
        onSwitchMode={(m) => setCurrentPage(m)}
        showToast={showToast}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f8fc] flex">
      {/* Toast Notification Container */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-lg shadow-lg border text-sm font-medium flex items-center gap-2.5 transition-all ${
              t.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : t.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}
          >
            {t.type === 'success' && <CheckCircle2 size={16} className="text-emerald-600" />}
            {t.type === 'error' && <AlertTriangle size={16} className="text-rose-600" />}
            {t.type === 'info' && <Info size={16} className="text-blue-600" />}
            {t.message}
          </div>
        ))}
      </div>

      {/* Sidebar - Matching Figma Dark Navy #0d1b3d */}
      <aside
        className={`sidebar fixed inset-y-0 left-0 z-40 w-64 bg-[#0d1b3d] text-white flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800/60">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setCurrentPage('Dashboard')}>
            <div className="w-8 h-8 rounded-lg bg-blue flex items-center justify-center font-bold text-white shadow-md">
              <Sparkles size={18} />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white">
                Orga<span className="text-blue-400">Nice</span>
              </span>
              <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase -mt-0.5">Campus Event Hub</p>
            </div>
          </div>
          <button className="lg:hidden text-slate-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <p className="px-3 pb-2 text-[10px] font-bold tracking-wider uppercase text-slate-400">Workspace</p>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.name;
            return (
              <button
                key={item.name}
                onClick={() => {
                  setCurrentPage(item.name);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#20315f] text-white shadow-sm'
                    : 'text-slate-300 hover:bg-[#19274e] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={isActive ? 'text-blue-400' : 'text-slate-400'} />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      item.badge === 'AI'
                        ? 'bg-violet text-white'
                        : 'bg-blue-500/20 text-blue-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* User Profile & Role Switcher */}
        <div className="p-3 border-t border-slate-800/80 bg-[#09132c]">
          <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[#152248] transition-colors">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-blue text-white flex items-center justify-center font-bold text-xs">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : 'ON'}
              </div>
              <div className="truncate text-left">
                <p className="text-xs font-semibold text-white truncate">{user?.name || 'Aakash Sharma'}</p>
                <span className="inline-block text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-800 text-blue-300">
                  {user?.role || 'Organizer'}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Log out"
              className="text-slate-400 hover:text-rose-400 p-1.5 rounded transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 rounded-md hover:bg-slate-100 text-slate-600"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>Workspace</span>
              <ChevronRight size={14} />
              <span className="font-semibold text-slate-900">{currentPage}</span>
            </div>

            {/* Event Selector Dropdown */}
            {eventsList.length > 0 && (
              <div className="hidden sm:flex items-center gap-2 ml-4 pl-4 border-l border-slate-200">
                <span className="text-xs font-medium text-slate-400">Event:</span>
                <select
                  value={selectedEventId || ''}
                  onChange={(e) => setSelectedEventId(Number(e.target.value))}
                  className="text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 outline-none hover:bg-slate-100 cursor-pointer"
                >
                  {eventsList.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.status})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* AI Copilot Trigger */}
            <button
              onClick={() => setCopilotOpen(!copilotOpen)}
              className="btn btn-primary text-xs py-1.5 px-3 bg-gradient-to-r from-blue to-violet hover:from-blue-hover hover:to-violet-hover shadow-sm"
            >
              <Sparkles size={14} className="text-violet-200" />
              <span>AI Copilot</span>
            </button>

            {/* Notification Center */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 relative transition-colors"
                title="Notifications"
              >
                <Bell size={18} />
                {unreadNotifsCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadNotifsCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold uppercase text-slate-600">Notifications</span>
                    <button
                      onClick={async () => {
                        await apiCall('/notifications/mark-all-read', token, 'POST');
                        refreshCoreData();
                      }}
                      className="text-[11px] font-semibold text-blue hover:underline"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 mt-2">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4 text-center">No new notifications</p>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className="py-2 px-1 text-xs">
                          <p className="font-semibold text-slate-800">{n.title}</p>
                          <p className="text-slate-500 mt-0.5">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Refresh Data Button */}
            <button
              onClick={() => {
                refreshCoreData();
                showToast('Refreshed data from PostgreSQL', 'success');
              }}
              title="Refresh Workspace"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </header>

        {/* Page Content View */}
        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          {currentPage === 'Dashboard' && (
            <DashboardView
              dashboardData={dashboardData}
              onNavigate={(page) => setCurrentPage(page)}
              onSelectEvent={(id) => {
                setSelectedEventId(id);
                setCurrentPage('Events');
              }}
              token={token}
              showToast={showToast}
            />
          )}

          {currentPage === 'Events' && (
            <EventsView
              token={token}
              events={eventsList}
              selectedEventId={selectedEventId}
              onSelectEvent={setSelectedEventId}
              onRefresh={refreshCoreData}
              showToast={showToast}
            />
          )}

          {currentPage === 'AI Planner' && (
            <AIPlannerView
              token={token}
              onPlanGenerated={() => {
                refreshCoreData();
                setCurrentPage('Calendar');
              }}
              showToast={showToast}
            />
          )}

          {currentPage === 'Calendar' && (
            <CalendarView
              token={token}
              eventId={selectedEventId}
              events={eventsList}
              onRefresh={refreshCoreData}
              showToast={showToast}
            />
          )}

          {currentPage === 'Tasks' && (
            <TasksView
              token={token}
              eventId={selectedEventId}
              events={eventsList}
              onRefresh={refreshCoreData}
              showToast={showToast}
            />
          )}

          {currentPage === 'Team' && (
            <TeamView
              token={token}
              eventId={selectedEventId}
              events={eventsList}
              onRefresh={refreshCoreData}
              showToast={showToast}
            />
          )}

          {currentPage === 'Budget' && (
            <BudgetView
              token={token}
              eventId={selectedEventId}
              events={eventsList}
              onRefresh={refreshCoreData}
              showToast={showToast}
            />
          )}

          {currentPage === 'Vendors' && (
            <VendorsView
              token={token}
              eventId={selectedEventId}
              events={eventsList}
              onRefresh={refreshCoreData}
              showToast={showToast}
            />
          )}

          {currentPage === 'Risks' && (
            <RisksView
              token={token}
              eventId={selectedEventId}
              events={eventsList}
              onRefresh={refreshCoreData}
              showToast={showToast}
            />
          )}

          {currentPage === 'Recommendations' && (
            <RecommendationsView
              token={token}
              eventId={selectedEventId}
              events={eventsList}
              onRefresh={refreshCoreData}
              showToast={showToast}
            />
          )}

          {currentPage === 'Faculty Approval' && (
            <FacultyApprovalView
              token={token}
              user={user}
              events={eventsList}
              selectedEventId={selectedEventId}
              onRefresh={refreshCoreData}
              showToast={showToast}
            />
          )}

          {currentPage === 'Reports' && (
            <ReportsView
              token={token}
              events={eventsList}
              selectedEventId={selectedEventId}
              showToast={showToast}
            />
          )}

          {currentPage === 'History' && (
            <HistoryView
              token={token}
              eventId={selectedEventId}
              events={eventsList}
            />
          )}

          {currentPage === 'Settings' && (
            <SettingsView
              user={user}
              onRoleSwitched={(newRole) => {
                setUser({ ...user, role: newRole });
                showToast(`Switched simulation role to ${newRole}`, 'info');
              }}
            />
          )}
        </main>
      </div>

      {/* Floating AI Copilot Drawer */}
      {copilotOpen && (
        <AICopilotDrawer
          token={token}
          eventId={selectedEventId}
          onClose={() => setCopilotOpen(false)}
          onRefreshWorkspace={refreshCoreData}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ----------------- 1. LANDING PAGE VIEW -----------------

function LandingPageView({
  onLogin,
  onRegister,
  onExplore
}: {
  onLogin: () => void;
  onRegister: () => void;
  onExplore: () => void;
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue flex items-center justify-center font-bold text-white shadow-md">
              <Sparkles size={18} />
            </div>
            <span className="text-2xl font-bold tracking-tight text-navy">
              Orga<span className="text-blue">Nice</span>
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-blue transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-blue transition-colors">How It Works</a>
            <a href="#governance" className="hover:text-blue transition-colors">Faculty Governance</a>
            <a href="#about" className="hover:text-blue transition-colors">About</a>
          </nav>
          <div className="flex items-center gap-3">
            <button onClick={onLogin} className="btn btn-outline text-sm font-semibold px-4 py-2">
              Log in
            </button>
            <button onClick={onRegister} className="btn btn-primary text-sm font-semibold px-4 py-2">
              Sign up
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-20 lg:py-24 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue text-xs font-semibold uppercase tracking-wider mb-6">
            <Sparkles size={14} />
            AI-COORDINATED EVENT PLANNING
          </div>
          <h1 className="text-5xl lg:text-6xl font-extrabold text-navy tracking-tight leading-[1.15]">
            Plan smarter.<br />
            Manage better.
          </h1>
          <p className="mt-6 text-lg text-slate-600 leading-relaxed max-w-xl">
            Turn the chaos of coordinating university events into seamless execution. From initial idea to
            post-event budget reconciliation, OrgaNice handles timelines, team roles, budgets, and faculty approvals.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <button onClick={onRegister} className="btn btn-primary text-base px-6 py-3 shadow-md shadow-blue-500/20">
              <Sparkles size={18} />
              Create Your Event
            </button>
            <button onClick={onExplore} className="btn btn-outline text-base px-6 py-3">
              Explore Dashboard
            </button>
          </div>
        </div>

        {/* Hero Interactive Preview Card */}
        <div className="card p-6 shadow-xl border-slate-200/80 bg-white">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold tracking-wider uppercase text-slate-400">Preview</span>
              <h3 className="text-lg font-bold text-navy">TechFest 2.0</h3>
            </div>
            <span className="badge badge-approved">Active</span>
          </div>

          <div className="grid grid-cols-3 gap-3 my-5">
            <div className="p-3 bg-slate-50 rounded-lg text-center">
              <p className="text-xs text-slate-500 font-medium">Timeline Tasks</p>
              <p className="text-xl font-bold text-navy mt-0.5">8 Tasks</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg text-center">
              <p className="text-xs text-slate-500 font-medium">Sanctioned Budget</p>
              <p className="text-xl font-bold text-navy mt-0.5">₹1.50L</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg text-center">
              <p className="text-xs text-slate-500 font-medium">Progress</p>
              <p className="text-xl font-bold text-emerald-600 mt-0.5">65%</p>
            </div>
          </div>

          {/* AI Banner in Preview */}
          <div className="rounded-lg bg-[#0d1b3d] text-white p-4">
            <div className="flex items-center gap-2 text-violet-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles size={14} />
              AI Copilot is watching your plan
            </div>
            <p className="text-sm font-medium text-slate-200 mt-1">
              1 schedule overlap detected in Seminar Hall: Workshop A conflicts with Sponsor Meet.
            </p>
            <div className="mt-3 flex gap-2">
              <span className="text-[11px] font-semibold bg-violet text-white px-2.5 py-1 rounded">
                Suggestion: Move to 3:30 PM
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Section */}
      <section id="features" className="bg-slate-50 py-20 border-y border-slate-200/60">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl font-extrabold text-navy tracking-tight">
              Three ways OrgaNice keeps you organized
            </h2>
            <p className="mt-3 text-slate-600">
              A cohesive suite of coordinated systems designed specifically for modern campus events.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-12">
            <div className="card p-6 bg-white">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue flex items-center justify-center mb-5">
                <CalendarDays size={24} />
              </div>
              <h3 className="text-lg font-bold text-navy">Centralized Event Management</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Coordinate venues, track task dependencies, and keep all student organizers aligned with
                real-time PostgreSQL updates.
              </p>
            </div>

            <div className="card p-6 bg-white">
              <div className="w-12 h-12 rounded-xl bg-violet-light text-violet flex items-center justify-center mb-5">
                <Sparkles size={24} />
              </div>
              <h3 className="text-lg font-bold text-navy">AI Event & Timeline Creation</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Describe your event idea in natural language. Our AI instantly produces a structured blueprint
                with realistic budgets, schedules, and deadlines.
              </p>
            </div>

            <div className="card p-6 bg-white">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-5">
                <Wallet size={24} />
              </div>
              <h3 className="text-lg font-bold text-navy">Smart Budget & Governance</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Track vendor quotations, expense receipts, and budget variance. Automatically submit dossiers
                for faculty coordinator review and formal approval.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4-Step Process Section */}
      <section id="how-it-works" className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-extrabold text-navy text-center tracking-tight">
            From idea to execution
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12">
            {[
              { num: '1', title: 'Ideate', desc: 'Describe attendee scale, theme, and key tracks' },
              { num: '2', title: 'Plan', desc: 'AI generates timeline, budget allocation, and tasks' },
              { num: '3', title: 'Manage', desc: 'Resolve venue conflicts and assign team responsibilities' },
              { num: '4', title: 'Report', desc: 'Obtain faculty sign-off and download audit PDFs' }
            ].map((step) => (
              <div key={step.num} className="text-center p-4">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue font-extrabold text-lg flex items-center justify-center mx-auto mb-4 border border-blue-200">
                  {step.num}
                </div>
                <h4 className="font-bold text-navy text-base">{step.title}</h4>
                <p className="text-xs text-slate-500 mt-1">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dark Banner Matching Figma */}
      <section className="bg-[#0d1b3d] text-white py-16">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h3 className="text-3xl font-extrabold tracking-tight">
            An assistant that watches your event, not one that runs it.
          </h3>
          <p className="text-slate-300 max-w-xl mx-auto mt-3 text-sm">
            Continuous background scanners evaluate schedule clashes, vendor quote variances, and critical deadlines.
          </p>
          <div className="mt-8 flex justify-center">
            <button onClick={onRegister} className="btn btn-primary px-8 py-3 text-sm font-bold">
              Start Planning Now
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 bg-white text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 OrgaNice | SRM Institute of Science & Technology Campus Event Hub</p>
          <p className="font-medium text-slate-600">Built with Next.js, FastAPI & PostgreSQL 18</p>
        </div>
      </footer>
    </div>
  );
}

// ----------------- 2. AUTH PAGE VIEW -----------------

function AuthPageView({
  mode,
  onSuccess,
  onBack,
  onSwitchMode,
  showToast
}: {
  mode: string;
  onSuccess: (token: string, user: any) => void;
  onBack: () => void;
  onSwitchMode: (mode: string) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const isRegister = mode === 'Register';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('password123');
  const [name, setName] = useState('');
  const [role, setRole] = useState('Organizer');
  const [organization, setOrganization] = useState('SRM Institute of Science & Technology');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const payload = isRegister
        ? { name, email, password, role, organization }
        : { email, password };

      const res = await apiCall(endpoint, undefined, 'POST', payload);
      onSuccess(res.token, res.user);
    } catch (err: any) {
      showToast(err.message || 'Authentication failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Quick 1-Click Demo Login Helper
  const handleQuickDemo = async (demoEmail: string, demoRole: string) => {
    setLoading(true);
    try {
      const res = await apiCall('/auth/login', undefined, 'POST', {
        email: demoEmail,
        password: 'password123'
      });
      onSuccess(res.token, res.user);
    } catch (err: any) {
      showToast(err.message || 'Demo login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white font-sans">
      {/* Left Navy Showcase Panel */}
      <div className="hidden lg:flex flex-col justify-between bg-[#0d1b3d] text-white p-12 lg:p-16">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue flex items-center justify-center font-bold text-white shadow-md">
              <Sparkles size={20} />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">
              Orga<span className="text-blue-400">Nice</span>
            </span>
          </div>
          <div className="mt-24 max-w-md">
            <h2 className="text-4xl font-extrabold tracking-tight leading-tight">
              Your campus events, completely under control.
            </h2>
            <p className="mt-6 text-slate-300 leading-relaxed text-base">
              Plan confidently with an organized, AI-assisted workspace. Dynamic budgets, live conflict detection,
              and academic governance sign-offs in one place.
            </p>
          </div>
        </div>

        <div className="border-t border-slate-800/80 pt-6">
          <p className="text-xs text-slate-400">
            Powered by PostgreSQL 18 & FastAPI &bull; SRM Institute of Science & Technology
          </p>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <button
            onClick={onBack}
            className="text-xs font-semibold text-slate-500 hover:text-navy flex items-center gap-1.5 mb-8"
          >
            ← Back to home
          </button>

          <h2 className="text-2xl lg:text-3xl font-bold text-navy">
            {isRegister ? 'Create an account' : 'Welcome back'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {isRegister ? 'Start coordinating your next campus event.' : 'Enter your credentials to enter workspace.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {isRegister && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Aakash Sharma"
                  className="field"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email address</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. organizer@organice.local"
                className="field"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="field"
              />
            </div>

            {isRegister && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="field cursor-pointer"
                  >
                    <option value="Organizer">Organizer</option>
                    <option value="Faculty Coordinator">Faculty Coordinator</option>
                    <option value="Admin">Admin</option>
                    <option value="Team Member">Team Member</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Organization</label>
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    className="field"
                  />
                </div>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary w-full py-2.5 font-bold mt-2">
              {loading ? 'Processing…' : isRegister ? 'Create Account' : 'Sign in'}
            </button>
          </form>

          {/* Quick Demo Logins */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 text-center">
              Quick 1-Click Evaluation Logins
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemo('organizer@organice.local', 'Organizer')}
                className="btn btn-soft text-xs py-2"
              >
                Organizer Demo
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo('faculty@organice.local', 'Faculty Coordinator')}
                className="btn btn-soft text-xs py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              >
                Faculty Demo
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo('admin@organice.local', 'Admin')}
                className="btn btn-soft text-xs py-2 bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                Admin Demo
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo('priya@organice.local', 'Team Member')}
                className="btn btn-soft text-xs py-2 bg-purple-50 text-purple-700 hover:bg-purple-100"
              >
                Volunteer Demo
              </button>
            </div>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => onSwitchMode(isRegister ? 'Login' : 'Register')}
              className="text-xs font-semibold text-blue hover:underline"
            >
              {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------- 3. DASHBOARD VIEW -----------------

function DashboardView({
  dashboardData,
  onNavigate,
  onSelectEvent,
  token,
  showToast
}: {
  dashboardData: any;
  onNavigate: (page: string) => void;
  onSelectEvent: (id: number) => void;
  token: string;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  if (!dashboardData) {
    return (
      <div className="py-20 text-center">
        <RefreshCw size={24} className="animate-spin text-blue mx-auto" />
        <p className="text-sm font-medium text-slate-500 mt-3">Loading live workspace data from PostgreSQL…</p>
      </div>
    );
  }

  const m = dashboardData.metrics;
  const events = dashboardData.events || [];
  const deadlines = dashboardData.upcomingDeadlines || [];
  const activities = dashboardData.activities || [];

  // Donut Chart Data
  const spent = m.totalSpent || 0;
  const remaining = Math.max(0, m.totalBudget - spent);
  const chartData = [
    { name: 'Spent', value: spent, color: '#2563eb' },
    { name: 'Remaining', value: remaining, color: '#e2e8f0' }
  ];

  const handleDownloadPDF = async () => {
    if (events.length === 0) return;
    try {
      showToast('Generating official ReportLab PDF…', 'info');
      const blob = await apiCall(`/reports/pdf/${events[0].id}`, token);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `organice-dashboard-report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('PDF downloaded successfully', 'success');
    } catch (err: any) {
      showToast('Failed to download PDF: ' + err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Good morning, Campus Organizer</h1>
          <p className="text-sm text-slate-500 mt-0.5">Here is what needs your attention today across all active events.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('AI Planner')} className="btn btn-primary text-xs py-2 px-3">
            <Sparkles size={14} />
            Generate New Plan
          </button>
          <button onClick={handleDownloadPDF} className="btn btn-outline text-xs py-2 px-3">
            <Download size={14} />
            Generate PDF Report
          </button>
        </div>
      </div>

      {/* 6 KPI Stat Cards Matching Figma */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Events', val: m.totalEvents, color: '#2563eb', bg: '#eff6ff' },
          { label: 'Upcoming Events', val: m.upcomingEvents, color: '#059669', bg: '#ecfdf5' },
          { label: 'Active Events', val: m.activeEvents, color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'Total Budget', val: formatINR(m.totalBudget), color: '#0284c7', bg: '#f0f9ff' },
          { label: 'Pending Tasks', val: m.pendingTasks, color: '#ea580c', bg: '#fff7ed' },
          { label: 'High-Risk Items', val: m.highRisks, color: '#dc2626', bg: '#fef2f2' }
        ].map((kpi) => (
          <div key={kpi.label} className="card p-4 flex flex-col justify-between">
            <span className="text-xs font-medium text-slate-500">{kpi.label}</span>
            <p className="text-xl lg:text-2xl font-bold text-navy mt-2">{kpi.val}</p>
            <div className="h-1 rounded-full mt-3" style={{ background: kpi.color }} />
          </div>
        ))}
      </div>

      {/* Main Grid: Left Column & Right Column Matching Figma */}
      <div className="grid lg:grid-cols-[1.55fr_1fr] gap-6">
        {/* Left Column: Upcoming Events & Deadlines */}
        <div className="space-y-6">
          {/* Upcoming Events Card */}
          <div className="card p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="font-bold text-navy text-base">Upcoming Events</h2>
              <button
                onClick={() => onNavigate('Events')}
                className="text-xs font-semibold text-blue hover:underline"
              >
                View all ({events.length})
              </button>
            </div>

            <div className="divide-y divide-slate-100 mt-2">
              {events.map((ev: any) => (
                <div
                  key={ev.id}
                  onClick={() => onSelectEvent(ev.id)}
                  className="py-3.5 flex items-center justify-between hover:bg-slate-50/80 px-2 rounded-lg cursor-pointer transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-navy">{ev.name}</h4>
                      <span
                        className={`badge ${
                          ev.status === 'Approved'
                            ? 'badge-approved'
                            : ev.status === 'Active'
                            ? 'badge-active'
                            : ev.status === 'Under Review'
                            ? 'badge-review'
                            : 'badge-draft'
                        }`}
                      >
                        {ev.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {ev.venue} &bull; {new Date(ev.start_time).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-800">{ev.progress}% complete</span>
                    <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full bg-blue rounded-full" style={{ width: `${ev.progress}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Deadlines Card */}
          <div className="card p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="font-bold text-navy text-base">Upcoming Deadlines</h2>
              <button onClick={() => onNavigate('Tasks')} className="text-xs font-semibold text-blue hover:underline">
                Open Tasks
              </button>
            </div>

            <div className="space-y-3 mt-3">
              {deadlines.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No pending deadlines</p>
              ) : (
                deadlines.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-8 rounded-full ${
                          d.priority === 'Critical'
                            ? 'bg-rose-500'
                            : d.priority === 'High'
                            ? 'bg-amber-500'
                            : 'bg-blue-500'
                        }`}
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-800">{d.name}</p>
                        <p className="text-[11px] text-slate-500">
                          Due: {d.deadline} &bull; Assigned: {d.assigned_member_name || 'Unassigned'}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        d.priority === 'Critical'
                          ? 'bg-rose-100 text-rose-700'
                          : d.priority === 'High'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {d.priority}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Budget Overview & Recent Activity */}
        <div className="space-y-6">
          {/* Budget Overview Card with Recharts Donut */}
          <div className="card p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="font-bold text-navy text-base">Budget Overview</h2>
              <button onClick={() => onNavigate('Budget')} className="text-xs font-semibold text-blue hover:underline">
                Budget Ledger
              </button>
            </div>

            <div className="h-44 relative flex items-center justify-center mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    innerRadius={48}
                    outerRadius={68}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: any) => formatINR(Number(val))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[11px] font-semibold text-slate-400 uppercase">Total Budget</span>
                <span className="text-base font-extrabold text-navy">{formatINR(m.totalBudget)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100 text-center">
              <div>
                <span className="text-[11px] font-medium text-slate-500">Actual Spent</span>
                <p className="text-sm font-bold text-blue mt-0.5">{formatINR(spent)}</p>
              </div>
              <div>
                <span className="text-[11px] font-medium text-slate-500">Remaining</span>
                <p className="text-sm font-bold text-emerald-600 mt-0.5">{formatINR(remaining)}</p>
              </div>
            </div>
          </div>

          {/* Recent Activity Card */}
          <div className="card p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="font-bold text-navy text-base">Recent Activity</h2>
              <button onClick={() => onNavigate('History')} className="text-xs font-semibold text-blue hover:underline">
                Full Audit Log
              </button>
            </div>

            <div className="space-y-3 mt-3">
              {activities.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No recorded activity yet</p>
              ) : (
                activities.slice(0, 5).map((act: any) => (
                  <div key={act.id} className="flex items-start gap-2.5 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue mt-1.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-slate-800">
                        {act.action}: <span className="font-normal text-slate-600">{act.details}</span>
                      </p>
                      <span className="text-[10px] text-slate-400">
                        {act.created_at ? new Date(act.created_at).toLocaleTimeString() : 'Just now'} &bull; by {act.user_name}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------- 4. EVENTS VIEW -----------------

function EventsView({
  token,
  events,
  selectedEventId,
  onSelectEvent,
  onRefresh,
  showToast
}: {
  token: string;
  events: any[];
  selectedEventId?: number;
  onSelectEvent: (id: number) => void;
  onRefresh: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [filterStatus, setFilterStatus] = useState('All');
  const [search, setSearch] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<any>(null);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState('Technical Fest');
  const [venue, setVenue] = useState('Main Auditorium');
  const [attendees, setAttendees] = useState(500);
  const [budget, setBudget] = useState(120000);
  const [description, setDescription] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const now = new Date();
      const start_time = new Date(now.getTime() + 14 * 86400000).toISOString();
      const end_time = new Date(now.getTime() + 16 * 86400000).toISOString();

      await apiCall('/events', token, 'POST', {
        name,
        type,
        venue,
        start_time,
        end_time,
        attendees: Number(attendees),
        budget: Number(budget),
        description
      });

      setCreateModalOpen(false);
      setName('');
      setDescription('');
      onRefresh();
      showToast('Event created successfully', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDuplicate = async (id: number) => {
    try {
      await apiCall(`/events/${id}/duplicate`, token, 'POST');
      onRefresh();
      showToast('Event duplicated successfully', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleArchive = async (id: number) => {
    try {
      await apiCall(`/events/${id}/archive`, token, 'POST');
      onRefresh();
      showToast('Event archive status updated', 'info');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this event? All associated tasks, schedules and budget records will be removed.')) return;
    try {
      await apiCall(`/events/${id}`, token, 'DELETE');
      onRefresh();
      showToast('Event deleted from PostgreSQL', 'info');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const filteredEvents = events.filter((e) => {
    const matchesStatus = filterStatus === 'All' || e.status === filterStatus;
    const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.venue.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Campus Events</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage, duplicate, and monitor approval status across all events.</p>
        </div>
        <button onClick={() => setCreateModalOpen(true)} className="btn btn-primary text-xs py-2 px-3">
          <Plus size={16} />
          New Event
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search events or venues…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="field pl-9 text-xs py-2"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {['All', 'Active', 'Approved', 'Under Review', 'Draft'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                filterStatus === st ? 'bg-navy text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Events Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredEvents.map((ev) => {
          const isSelected = ev.id === selectedEventId;
          return (
            <div
              key={ev.id}
              className={`card p-5 flex flex-col justify-between transition-all ${
                isSelected ? 'ring-2 ring-blue border-transparent' : ''
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{ev.type}</span>
                  <span
                    className={`badge ${
                      ev.status === 'Approved'
                        ? 'badge-approved'
                        : ev.status === 'Active'
                        ? 'badge-active'
                        : ev.status === 'Under Review'
                        ? 'badge-review'
                        : 'badge-draft'
                    }`}
                  >
                    {ev.status}
                  </span>
                </div>

                <h3 className="text-base font-bold text-navy mt-2 hover:text-blue cursor-pointer" onClick={() => onSelectEvent(ev.id)}>
                  {ev.name}
                </h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{ev.description || 'No description provided.'}</p>

                <div className="grid grid-cols-2 gap-2 my-4 p-2.5 bg-slate-50 rounded-lg text-xs">
                  <div>
                    <span className="text-slate-400">Venue</span>
                    <p className="font-semibold text-slate-800 truncate">{ev.venue}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Sanctioned Budget</span>
                    <p className="font-semibold text-slate-800">{formatINR(ev.budget)}</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                    <span>Task Progress</span>
                    <span>{ev.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue rounded-full" style={{ width: `${ev.progress}%` }} />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => onSelectEvent(ev.id)}
                  className={`text-xs font-bold ${isSelected ? 'text-blue' : 'text-slate-600 hover:text-blue'}`}
                >
                  {isSelected ? '✓ Selected in Workspace' : 'Select Workspace'}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDuplicate(ev.id)}
                    title="Duplicate Event"
                    className="p-1.5 text-slate-400 hover:text-navy rounded hover:bg-slate-100"
                  >
                    <Copy size={15} />
                  </button>
                  <button
                    onClick={() => handleArchive(ev.id)}
                    title="Archive Event"
                    className="p-1.5 text-slate-400 hover:text-amber-600 rounded hover:bg-slate-100"
                  >
                    <Archive size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(ev.id)}
                    title="Delete Event"
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Event Modal */}
      {createModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-navy text-lg">Create New Event</h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Event Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Technova 2026"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="field"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Event Type</label>
                  <select value={type} onChange={(e) => setType(e.target.value)} className="field">
                    <option value="Technical Fest">Technical Fest</option>
                    <option value="Cultural">Cultural</option>
                    <option value="Hackathon">Hackathon</option>
                    <option value="Workshop">Workshop</option>
                    <option value="Conference">Conference</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Venue</label>
                  <select value={venue} onChange={(e) => setVenue(e.target.value)} className="field">
                    <option value="Main Auditorium">Main Auditorium</option>
                    <option value="Seminar Hall">Seminar Hall</option>
                    <option value="Open-Air Theatre">Open-Air Theatre</option>
                    <option value="Innovation Lab">Innovation Lab</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Expected Attendees</label>
                  <input
                    type="number"
                    value={attendees}
                    onChange={(e) => setAttendees(Number(e.target.value))}
                    className="field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sanctioned Budget (₹)</label>
                  <input
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    className="field"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description & Scope</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Summary of tracks, goals, and key delegates…"
                  className="field"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setCreateModalOpen(false)} className="btn btn-outline text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary text-xs">
                  Save to PostgreSQL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------- 5. AI PLANNER VIEW (MATCHING FIGMA) -----------------

function AIPlannerView({
  token,
  onPlanGenerated,
  showToast
}: {
  token: string;
  onPlanGenerated: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [prompt, setPrompt] = useState(
    'Create a 2-day technical fest for 500 students with workshops, competitions and a closing ceremony.'
  );
  const [generating, setGenerating] = useState(false);
  const [planResult, setPlanResult] = useState<any>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      showToast('Calling FastAPI AI Planner endpoint…', 'info');
      const res = await apiCall('/ai/plan', token, 'POST', { prompt });
      setPlanResult(res);
      showToast('Event plan & timeline successfully created in PostgreSQL!', 'success');
    } catch (err: any) {
      showToast('AI Generation failed: ' + err.message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleApplySuggestion = async () => {
    if (!planResult || !planResult.event) return;
    try {
      // Find recommendation
      const recs = await apiCall(`/recommendations?event_id=${planResult.event.id}`, token);
      if (recs && recs.length > 0) {
        await apiCall(`/recommendations/${recs[0].id}/apply`, token, 'POST');
        showToast('AI Suggestion applied! Workshop A rescheduled to 3:30 PM.', 'success');
        onPlanGenerated();
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">AI Event Planner</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Enter a plain-language prompt. Our AI architect converts it into an end-to-end database blueprint.
        </p>
      </div>

      {/* Top Prompt Card & AI Recommendations Matching Figma */}
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
        {/* Left: Input Box */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-violet flex items-center gap-1.5">
              <Sparkles size={14} />
              DESCRIBE YOUR EVENT
            </span>
            <span className="text-[11px] text-slate-400">Natural language to PostgreSQL</span>
          </div>

          <textarea
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="field text-sm font-medium"
            placeholder="e.g. 2-day technical fest for 500 students with AI keynote, hackathon, and guest lecture…"
          />

          {/* Quick Preset Chips */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-slate-400 font-medium self-center">Try:</span>
            {[
              '2-Day Tech Fest for 500',
              '24-Hour AI Hackathon for 200',
              'Campus Cultural Night with DJ',
              'Robotics Workshop for 150'
            ].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setPrompt(`Create a ${chip.toLowerCase()} with full timeline, budget, and risk evaluation.`)}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="btn btn-primary text-xs py-2.5 px-4 bg-gradient-to-r from-blue to-violet shadow-sm font-bold"
            >
              <Sparkles size={15} />
              {generating ? 'Generating Blueprint…' : 'Generate Plan'}
            </button>
            <span className="text-xs text-slate-500">
              Parses attendee count, timeline duration, and budgets automatically.
            </span>
          </div>
        </div>

        {/* Right: AI Recommendations Box Matching Figma */}
        <div className="card p-5 bg-gradient-to-br from-white to-violet-50/40">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Sparkles size={16} className="text-violet" />
            <h3 className="font-bold text-navy text-sm">AI Blueprint Recommendations</h3>
          </div>

          <div className="space-y-3 mt-3">
            {[
              '1. Start promotion & sponsor MoU three weeks before kickoff',
              '2. Allocate 12 student volunteers for Day 1 logistics registration desk',
              '3. Shift Workshop A to Seminar Hall at 3:30 PM to clear double-booking',
              '4. Lock sound & AV vendor contract 10 days before dry run'
            ].map((rec, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-slate-700">
                <span className="text-violet font-bold shrink-0">✦</span>
                <p className="leading-relaxed">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Generated Blueprint View (Once Generated) */}
      {planResult && (
        <div className="space-y-6">
          {/* Event Details Card Matching Figma */}
          <div className="card p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Generated Blueprint</span>
                <h3 className="text-lg font-bold text-navy mt-0.5">{planResult.event.name}</h3>
              </div>
              <button onClick={onPlanGenerated} className="btn btn-primary text-xs py-1.5 px-3">
                Open in Calendar →
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-[11px] text-slate-400 font-medium">Event Type</span>
                <p className="font-bold text-navy text-sm mt-0.5">{planResult.event.type}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-[11px] text-slate-400 font-medium">Primary Venue</span>
                <p className="font-bold text-navy text-sm mt-0.5">{planResult.event.venue}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-[11px] text-slate-400 font-medium">Expected Footfall</span>
                <p className="font-bold text-navy text-sm mt-0.5">{planResult.event.attendees} Attendees</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-[11px] text-slate-400 font-medium">Sanctioned Budget</span>
                <p className="font-bold text-navy text-sm mt-0.5">{formatINR(planResult.event.budget)}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-[11px] text-slate-400 font-medium">Generated Tasks</span>
                <p className="font-bold text-navy text-sm mt-0.5">{planResult.timeline.length} Tasks</p>
              </div>
            </div>
          </div>

          {/* AI-Generated Event Timeline Table Matching Figma */}
          <div className="card p-5">
            <h3 className="font-bold text-navy text-base mb-4">AI-Generated Event Timeline</h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[11px]">
                  <tr>
                    <th className="p-3">Task Name</th>
                    <th className="p-3">Team</th>
                    <th className="p-3">Priority</th>
                    <th className="p-3">Deadline</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {planResult.timeline.map((task: any) => (
                    <tr key={task.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-800">{task.name}</td>
                      <td className="p-3 text-slate-600">{task.category}</td>
                      <td className="p-3">
                        <span
                          className={`badge ${
                            task.priority === 'Critical'
                              ? 'badge-critical'
                              : task.priority === 'High'
                              ? 'badge-review'
                              : 'badge-active'
                          }`}
                        >
                          {task.priority}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600">{task.deadline}</td>
                      <td className="p-3 text-slate-600">To Do</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pink/Red Schedule Conflict Alert Banner Matching Figma */}
            <div className="mt-5 p-4 rounded-xl border border-rose-200 bg-rose-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-rose-800 flex items-center gap-1.5 uppercase tracking-wider">
                  <AlertTriangle size={15} />
                  Schedule Conflict Detected
                </span>
                <p className="text-xs text-rose-700 mt-1">
                  Workshop A overlaps with Sponsor Meet in Seminar Hall at 2:00 PM. Suggestion: Shift Workshop A to 3:30 PM.
                </p>
              </div>
              <button
                onClick={handleApplySuggestion}
                className="btn btn-primary text-xs py-2 px-4 whitespace-nowrap bg-rose-600 hover:bg-rose-700"
              >
                Apply Suggestion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------- 6. CALENDAR VIEW -----------------

function CalendarView({
  token,
  eventId,
  events,
  onRefresh,
  showToast
}: {
  token: string;
  eventId?: number;
  events: any[];
  onRefresh: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [venue, setVenue] = useState('Seminar Hall');
  const [startHour, setStartHour] = useState('10:00');
  const [endHour, setEndHour] = useState('12:00');
  const [team, setTeam] = useState('Logistics');
  const [speaker, setSpeaker] = useState('');

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const query = eventId ? `?event_id=${eventId}` : '';
      const data = await apiCall(`/schedules${query}`, token);
      setSchedules(data);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, [eventId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) return;
    try {
      const today = new Date();
      const sTime = new Date(`${today.toISOString().split('T')[0]}T${startHour}:00`).toISOString();
      const eTime = new Date(`${today.toISOString().split('T')[0]}T${endHour}:00`).toISOString();

      await apiCall('/schedules', token, 'POST', {
        event_id: eventId,
        title,
        venue,
        start_time: sTime,
        end_time: eTime,
        team,
        speaker: speaker || undefined
      });

      setModalOpen(false);
      setTitle('');
      setSpeaker('');
      loadSchedules();
      onRefresh();
      showToast('Schedule session added to calendar', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleApplyResolution = async (schedId: number) => {
    try {
      // Shift start time by 1.5 hours
      const target = schedules.find((s) => s.id === schedId);
      if (!target) return;
      const newStart = new Date(new Date(target.start_time).getTime() + 90 * 60000).toISOString();
      await apiCall(`/schedules/${schedId}`, token, 'PATCH', {
        start_time: newStart,
        conflict_flag: false
      });
      loadSchedules();
      onRefresh();
      showToast('AI Resolution applied! Conflict cleared.', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const hasConflicts = schedules.some((s) => s.conflict_flag);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Schedule & Calendar</h1>
          <p className="text-sm text-slate-500 mt-0.5">Real-time venue double-booking and schedule conflict detection.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn btn-primary text-xs py-2 px-3">
          <Plus size={16} />
          Add Schedule Entry
        </button>
      </div>

      {/* Conflict Warning Banner if any */}
      {hasConflicts && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-rose-600 shrink-0" />
            <div>
              <p className="text-xs font-bold text-rose-800">1 Venue Double-Booking Conflict Detected</p>
              <p className="text-xs text-rose-600 mt-0.5">
                Two sessions are scheduled for the same venue at the same time window.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              const clash = schedules.find((s) => s.conflict_flag);
              if (clash) handleApplyResolution(clash.id);
            }}
            className="btn btn-primary text-xs py-1.5 px-3 bg-rose-600 hover:bg-rose-700"
          >
            Auto-Resolve Clashes
          </button>
        </div>
      )}

      {/* Real Schedules List */}
      <div className="card p-5">
        <h3 className="font-bold text-navy text-base mb-4">Event Sessions</h3>

        <div className="divide-y divide-slate-100">
          {schedules.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No schedule sessions created yet.</p>
          ) : (
            schedules.map((s) => (
              <div key={s.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-navy">{s.title}</h4>
                    {s.conflict_flag && (
                      <span className="badge badge-critical">⚠️ Venue Double Booking</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Venue: <span className="font-semibold text-slate-700">{s.venue}</span> &bull; Speaker:{' '}
                    <span className="font-semibold text-slate-700">{s.speaker || 'TBD'}</span>
                  </p>
                  {s.conflict_details && (
                    <p className="text-xs text-rose-600 font-medium mt-1">{s.conflict_details}</p>
                  )}
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <div className="text-right text-xs">
                    <span className="font-semibold text-slate-800">
                      {new Date(s.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                      {new Date(s.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <p className="text-[11px] text-slate-400">{s.team} Track</p>
                  </div>
                  {s.conflict_flag && (
                    <button
                      onClick={() => handleApplyResolution(s.id)}
                      className="btn btn-outline text-xs py-1 px-2.5 text-blue border-blue-200 hover:bg-blue-50"
                    >
                      Shift Slot
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Schedule Modal */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-card p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-navy text-lg">Add Calendar Session</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Session Title</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. AI Keynote Talk"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="field"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Venue</label>
                  <select value={venue} onChange={(e) => setVenue(e.target.value)} className="field">
                    <option value="Main Auditorium">Main Auditorium</option>
                    <option value="Seminar Hall">Seminar Hall</option>
                    <option value="Innovation Lab">Innovation Lab</option>
                    <option value="Open-Air Theatre">Open-Air Theatre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Track/Team</label>
                  <input
                    type="text"
                    value={team}
                    onChange={(e) => setTeam(e.target.value)}
                    className="field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={startHour}
                    onChange={(e) => setStartHour(e.target.value)}
                    className="field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={endHour}
                    onChange={(e) => setEndHour(e.target.value)}
                    className="field"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Speaker or Guest</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Alex Rivera"
                  value={speaker}
                  onChange={(e) => setSpeaker(e.target.value)}
                  className="field"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-outline text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary text-xs">
                  Add to Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------- 7. TASKS VIEW -----------------

function TasksView({
  token,
  eventId,
  events,
  onRefresh,
  showToast
}: {
  token: string;
  eventId?: number;
  events: any[];
  onRefresh: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'Kanban' | 'Table'>('Kanban');
  const [modalOpen, setModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Logistics');
  const [priority, setPriority] = useState('Medium');
  const [deadline, setDeadline] = useState(new Date().toISOString().split('T')[0]);

  const loadTasks = async () => {
    try {
      const q = eventId ? `?event_id=${eventId}` : '';
      const data = await apiCall(`/tasks${q}`, token);
      setTasks(data);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  useEffect(() => {
    loadTasks();
  }, [eventId]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) return;
    try {
      await apiCall('/tasks', token, 'POST', {
        event_id: eventId,
        name,
        category,
        priority,
        start_date: new Date().toISOString().split('T')[0],
        deadline,
        status: 'To Do'
      });
      setModalOpen(false);
      setName('');
      loadTasks();
      onRefresh();
      showToast('Task added to database', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleStatusChange = async (taskId: number, newStatus: string) => {
    try {
      await apiCall(`/tasks/${taskId}`, token, 'PATCH', { status: newStatus });
      loadTasks();
      onRefresh();
      showToast(`Task status updated to ${newStatus}`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      await apiCall(`/tasks/${taskId}`, token, 'DELETE');
      loadTasks();
      onRefresh();
      showToast('Task removed', 'info');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Task Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real task CRUD with automatic event progress recomputation and dependent task shifting.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setViewMode('Kanban')}
              className={`px-3 py-1.5 rounded-md font-semibold ${
                viewMode === 'Kanban' ? 'bg-white text-navy shadow-xs' : 'text-slate-500'
              }`}
            >
              Kanban
            </button>
            <button
              onClick={() => setViewMode('Table')}
              className={`px-3 py-1.5 rounded-md font-semibold ${
                viewMode === 'Table' ? 'bg-white text-navy shadow-xs' : 'text-slate-500'
              }`}
            >
              Table
            </button>
          </div>
          <button onClick={() => setModalOpen(true)} className="btn btn-primary text-xs py-2 px-3">
            <Plus size={16} />
            New Task
          </button>
        </div>
      </div>

      {viewMode === 'Kanban' ? (
        /* Kanban Board Columns */
        <div className="grid md:grid-cols-3 gap-5">
          {['To Do', 'In Progress', 'Done'].map((colStatus) => {
            const colTasks = tasks.filter((t) => t.status === colStatus);
            return (
              <div key={colStatus} className="card p-4 bg-slate-50/60 border-slate-200/80 flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/70 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-navy">{colStatus}</span>
                    <span className="text-xs bg-slate-200/70 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                      {colTasks.length}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 flex-1">
                  {colTasks.map((t) => (
                    <div key={t.id} className="card p-3.5 bg-white shadow-xs border-slate-200/80">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-xs text-navy">{t.name}</h4>
                        <span
                          className={`badge ${
                            t.priority === 'Critical'
                              ? 'badge-critical'
                              : t.priority === 'High'
                              ? 'badge-review'
                              : 'badge-active'
                          }`}
                        >
                          {t.priority}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-100">
                        <span>Due: {t.deadline}</span>
                        <span>{t.category}</span>
                      </div>

                      {/* Status Transition Actions */}
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 text-[11px]">
                        <div className="flex gap-1">
                          {colStatus !== 'To Do' && (
                            <button
                              onClick={() => handleStatusChange(t.id, 'To Do')}
                              className="text-slate-500 hover:text-navy px-1.5 py-0.5 rounded bg-slate-100"
                            >
                              ← To Do
                            </button>
                          )}
                          {colStatus !== 'In Progress' && (
                            <button
                              onClick={() => handleStatusChange(t.id, 'In Progress')}
                              className="text-blue px-1.5 py-0.5 rounded bg-blue-50 font-semibold"
                            >
                              In Progress
                            </button>
                          )}
                          {colStatus !== 'Done' && (
                            <button
                              onClick={() => handleStatusChange(t.id, 'Done')}
                              className="text-emerald-700 px-1.5 py-0.5 rounded bg-emerald-50 font-semibold"
                            >
                              ✓ Done
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteTask(t.id)}
                          className="text-slate-400 hover:text-rose-600"
                          title="Delete task"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {colTasks.length === 0 && (
                    <div className="py-8 text-center text-xs text-slate-400">No tasks in {colStatus}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[11px]">
              <tr>
                <th className="p-3">Task Name</th>
                <th className="p-3">Category</th>
                <th className="p-3">Priority</th>
                <th className="p-3">Deadline</th>
                <th className="p-3">Assignee</th>
                <th className="p-3">Status</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/50">
                  <td className="p-3 font-semibold text-slate-800">{t.name}</td>
                  <td className="p-3 text-slate-600">{t.category}</td>
                  <td className="p-3">
                    <span className="badge badge-active">{t.priority}</span>
                  </td>
                  <td className="p-3 text-slate-600">{t.deadline}</td>
                  <td className="p-3 text-slate-600">{t.assigned_member_name || 'Unassigned'}</td>
                  <td className="p-3">
                    <select
                      value={t.status}
                      onChange={(e) => handleStatusChange(t.id, e.target.value)}
                      className="bg-slate-100 border border-slate-200 rounded px-2 py-1 text-xs font-semibold cursor-pointer"
                    >
                      <option value="To Do">To Do</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Done">Done</option>
                    </select>
                  </td>
                  <td className="p-3">
                    <button onClick={() => handleDeleteTask(t.id)} className="text-rose-600 hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Task Modal */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-card p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-navy text-lg">Create New Task</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Task Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Procure stage sound equipment"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="field"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="field">
                    <option value="Logistics">Logistics</option>
                    <option value="Technical">Technical</option>
                    <option value="Tech & AV">Tech & AV</option>
                    <option value="Sponsorship">Sponsorship</option>
                    <option value="Volunteers">Volunteers</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value)} className="field">
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Deadline</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="field"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-outline text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary text-xs">
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------- 8. TEAM VIEW -----------------

function TeamView({
  token,
  eventId,
  events,
  onRefresh,
  showToast
}: {
  token: string;
  eventId?: number;
  events: any[];
  onRefresh: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [team, setTeam] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Coordinator');
  const [department, setDepartment] = useState('School of Computing');

  const loadTeam = async () => {
    try {
      const q = eventId ? `?event_id=${eventId}` : '';
      const data = await apiCall(`/team${q}`, token);
      setTeam(data);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  useEffect(() => {
    loadTeam();
  }, [eventId]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiCall('/team', token, 'POST', {
        event_id: eventId,
        name,
        email,
        role,
        department
      });
      setModalOpen(false);
      setName('');
      setEmail('');
      loadTeam();
      onRefresh();
      showToast('Team member added', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleRemove = async (id: number) => {
    try {
      await apiCall(`/team/${id}`, token, 'DELETE');
      loadTeam();
      onRefresh();
      showToast('Team member removed', 'info');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Team & Workload</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Monitor committee allocations and auto-detect member workload bottlenecks.
          </p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn btn-primary text-xs py-2 px-3">
          <Plus size={16} />
          Add Member
        </button>
      </div>

      {/* Member Cards Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
        {team.map((m) => (
          <div key={m.id} className="card p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue font-bold text-sm flex items-center justify-center">
                  {m.name.slice(0, 2).toUpperCase()}
                </div>
                <span
                  className={`badge ${
                    m.workload_status === 'Overloaded'
                      ? 'badge-critical'
                      : m.workload_status === 'Heavy'
                      ? 'badge-review'
                      : 'badge-approved'
                  }`}
                >
                  {m.workload_status}
                </span>
              </div>

              <h3 className="font-bold text-navy text-sm mt-3">{m.name}</h3>
              <p className="text-xs text-slate-500">{m.role}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{m.department}</p>

              <div className="mt-4 p-2.5 bg-slate-50 rounded-lg flex items-center justify-between text-xs">
                <span className="text-slate-500">Assigned Tasks</span>
                <span className="font-bold text-navy">{m.tasks_count} tasks</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
              <span className="text-[11px] text-slate-400 truncate">{m.email}</span>
              <button onClick={() => handleRemove(m.id)} className="text-rose-600 hover:underline">
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Member Modal */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-card p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-navy text-lg">Add Team Member</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Arun Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="field"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email address</label>
                <input
                  required
                  type="email"
                  placeholder="arun@organice.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                  <select value={role} onChange={(e) => setRole(e.target.value)} className="field">
                    <option value="Lead Organizer">Lead Organizer</option>
                    <option value="Logistics Lead">Logistics Lead</option>
                    <option value="Technical Lead">Technical Lead</option>
                    <option value="Finance Coordinator">Finance Coordinator</option>
                    <option value="Volunteer">Volunteer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="field"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-outline text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary text-xs">
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------- 9. BUDGET VIEW (MATCHING FIGMA) -----------------

function BudgetView({
  token,
  eventId,
  events,
  onRefresh,
  showToast
}: {
  token: string;
  eventId?: number;
  events: any[];
  onRefresh: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [budgetData, setBudgetData] = useState<any>(null);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);

  // Expense Form
  const [exTitle, setExTitle] = useState('');
  const [exAmount, setExAmount] = useState<number>(0);
  const [exCategoryId, setExCategoryId] = useState<number | undefined>(undefined);

  const loadBudget = async () => {
    if (!eventId) return;
    try {
      const data = await apiCall(`/budgets/${eventId}`, token);
      setBudgetData(data);
      if (data.categories && data.categories.length > 0) {
        setExCategoryId(data.categories[0].id);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  useEffect(() => {
    loadBudget();
  }, [eventId]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) return;
    try {
      await apiCall('/expenses', token, 'POST', {
        event_id: eventId,
        category_id: exCategoryId,
        title: exTitle,
        amount: Number(exAmount),
        payment_status: 'Paid',
        date: new Date().toISOString().split('T')[0]
      });
      setExpenseModalOpen(false);
      setExTitle('');
      setExAmount(0);
      loadBudget();
      onRefresh();
      showToast('Expense recorded & budget recalculated', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteExpense = async (id: number) => {
    try {
      await apiCall(`/expenses/${id}`, token, 'DELETE');
      loadBudget();
      onRefresh();
      showToast('Expense removed', 'info');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  if (!budgetData) {
    return <div className="py-20 text-center text-xs text-slate-400">Loading budget records…</div>;
  }

  const isOverrun = budgetData.projected_spend > budgetData.total_budget;
  const overrunDiff = budgetData.projected_spend - budgetData.total_budget;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Budget Planner</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Dynamic ledger tracking actual disbursements, vendor quotes, and projected variance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setExpenseModalOpen(true)} className="btn btn-primary text-xs py-2 px-3">
            <Plus size={16} />
            Add Expense
          </button>
        </div>
      </div>

      {/* Top 4 KPI Cards Matching Figma */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Budget', val: formatINR(budgetData.total_budget), color: '#2563eb' },
          { label: 'Actual Spend', val: formatINR(budgetData.actual_spend), color: '#0284c7' },
          { label: 'Remaining', val: formatINR(budgetData.remaining), color: '#059669' },
          { label: 'Projected Spend', val: formatINR(budgetData.projected_spend), color: isOverrun ? '#dc2626' : '#7c3aed' }
        ].map((c) => (
          <div key={c.label} className="card p-4">
            <span className="text-xs font-medium text-slate-500">{c.label}</span>
            <p className="text-2xl font-extrabold text-navy mt-1" style={{ color: c.color }}>
              {c.val}
            </p>
          </div>
        ))}
      </div>

      {/* Main Budget Grid: Left Expense Table, Right Category Breakdown Matching Figma */}
      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6">
        {/* Left: Expense Tracking Table */}
        <div className="card p-5 space-y-4">
          <h3 className="font-bold text-navy text-base">Expense Tracking</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="p-3">Item / Description</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {budgetData.expenses.map((ex: any) => (
                  <tr key={ex.id} className="hover:bg-slate-50/50">
                    <td className="p-3 font-semibold text-slate-800">{ex.title}</td>
                    <td className="p-3 text-slate-600">{ex.category_name}</td>
                    <td className="p-3 font-bold text-navy">{formatINR(ex.amount)}</td>
                    <td className="p-3">
                      <span className="badge badge-approved">{ex.payment_status}</span>
                    </td>
                    <td className="p-3">
                      <button onClick={() => handleDeleteExpense(ex.id)} className="text-rose-600 hover:underline">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {budgetData.expenses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400">
                      No expenses logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Overrun Alert Banner Matching Figma */}
          {isOverrun && (
            <div className="p-4 rounded-xl bg-[#0d1b3d] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs text-rose-300 font-bold uppercase tracking-wider">Budget Alert</p>
                <p className="text-sm font-semibold mt-0.5">
                  You are projected to exceed your budget by {formatINR(overrunDiff)}.
                </p>
              </div>
              <button
                onClick={() => showToast('Applied automatic vendor quotation optimization filter.', 'success')}
                className="btn btn-primary text-xs py-2 px-4 whitespace-nowrap"
              >
                Apply Optimization
              </button>
            </div>
          )}
        </div>

        {/* Right: Budget Allocation Category Breakdown Matching Figma */}
        <div className="card p-5 space-y-4">
          <h3 className="font-bold text-navy text-base">Budget Allocation</h3>

          <div className="space-y-4">
            {budgetData.categories.map((c: any) => {
              const pct = c.allocated_amount > 0 ? Math.min(100, Math.round((c.spent_amount / c.allocated_amount) * 100)) : 0;
              return (
                <div key={c.id} className="space-y-1 text-xs">
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-800">{c.name}</span>
                    <span className="text-slate-500">
                      {formatINR(c.spent_amount)} / {formatINR(c.allocated_amount)}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        pct > 90 ? 'bg-rose-500' : pct > 75 ? 'bg-amber-500' : 'bg-blue'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add Expense Modal */}
      {expenseModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-navy text-lg">Record Expense</h3>
              <button onClick={() => setExpenseModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Expense Title</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Refreshments for Guest Speakers"
                  value={exTitle}
                  onChange={(e) => setExTitle(e.target.value)}
                  className="field"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (₹)</label>
                  <input
                    required
                    type="number"
                    value={exAmount}
                    onChange={(e) => setExAmount(Number(e.target.value))}
                    className="field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={exCategoryId}
                    onChange={(e) => setExCategoryId(Number(e.target.value))}
                    className="field"
                  >
                    {budgetData.categories.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setExpenseModalOpen(false)} className="btn btn-outline text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary text-xs">
                  Record Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------- 10. VENDORS VIEW -----------------

function VendorsView({
  token,
  eventId,
  events,
  onRefresh,
  showToast
}: {
  token: string;
  eventId?: number;
  events: any[];
  onRefresh: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [vendors, setVendors] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [service, setService] = useState('Audio/Visual');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const loadVendors = async () => {
    try {
      const q = eventId ? `?event_id=${eventId}` : '';
      const [vData, qData] = await Promise.all([
        apiCall(`/vendors${q}`, token),
        apiCall(`/vendor-quotes${q}`, token)
      ]);
      setVendors(vData);
      setQuotes(qData);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  useEffect(() => {
    loadVendors();
  }, [eventId]);

  const handleAddVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiCall('/vendors', token, 'POST', {
        event_id: eventId,
        name,
        service,
        contact_name: contact,
        email,
        phone,
        status: 'Confirmed',
        rating: 4.8
      });
      setModalOpen(false);
      setName('');
      loadVendors();
      onRefresh();
      showToast('Vendor added successfully', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Vendors & Quotations</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Evaluate quotations, link accepted bids directly to budget disbursements, and confirm vendors.
          </p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn btn-primary text-xs py-2 px-3">
          <Plus size={16} />
          Add Vendor
        </button>
      </div>

      {/* Vendors Catalog Cards */}
      <div className="grid md:grid-cols-3 gap-5">
        {vendors.map((v) => (
          <div key={v.id} className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{v.service}</span>
              <span className="badge badge-approved">{v.status}</span>
            </div>

            <h3 className="font-bold text-navy text-base">{v.name}</h3>
            <p className="text-xs text-slate-600">Contact: {v.contact_name || 'Primary Representative'}</p>

            <div className="p-2.5 bg-slate-50 rounded-lg text-xs space-y-1">
              <p className="text-slate-500">Phone: {v.phone || '+91 98401 23456'}</p>
              <p className="text-slate-500 truncate">Email: {v.email || 'orders@vendor.com'}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Vendor Quotes Table */}
      <div className="card p-5 space-y-4">
        <h3 className="font-bold text-navy text-base">Active Vendor Quotations</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[11px]">
              <tr>
                <th className="p-3">Vendor</th>
                <th className="p-3">Service Scope</th>
                <th className="p-3">Quoted Amount</th>
                <th className="p-3">Status</th>
                <th className="p-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quotes.map((q) => (
                <tr key={q.id} className="hover:bg-slate-50/50">
                  <td className="p-3 font-semibold text-slate-800">{q.vendor_name}</td>
                  <td className="p-3 text-slate-600">{q.service}</td>
                  <td className="p-3 font-bold text-navy">{formatINR(q.amount)}</td>
                  <td className="p-3">
                    <span
                      className={`badge ${
                        q.status === 'Accepted'
                          ? 'badge-approved'
                          : q.status === 'Shortlisted'
                          ? 'badge-active'
                          : 'badge-draft'
                      }`}
                    >
                      {q.status}
                    </span>
                  </td>
                  <td className="p-3 text-slate-500">{q.notes || 'Standard agreement'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Vendor Modal */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-card p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-navy text-lg">Add Vendor Profile</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddVendor} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Company / Vendor Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Aura Stage Lighting & Audio"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="field"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Service Category</label>
                <select value={service} onChange={(e) => setService(e.target.value)} className="field">
                  <option value="Audio/Visual">Audio/Visual</option>
                  <option value="Catering & Hospitality">Catering & Hospitality</option>
                  <option value="Stage & Lighting">Stage & Lighting</option>
                  <option value="Banners & Printing">Banners & Printing</option>
                  <option value="Security & Logistics">Security & Logistics</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="field"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-outline text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary text-xs">
                  Save Vendor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------- 11. RISKS VIEW -----------------

function RisksView({
  token,
  eventId,
  events,
  onRefresh,
  showToast
}: {
  token: string;
  eventId?: number;
  events: any[];
  onRefresh: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [risks, setRisks] = useState<any[]>([]);

  const loadRisks = async () => {
    try {
      const q = eventId ? `?event_id=${eventId}` : '';
      const data = await apiCall(`/risks${q}`, token);
      setRisks(data);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  useEffect(() => {
    loadRisks();
  }, [eventId]);

  const handleResolveRisk = async (id: number) => {
    try {
      await apiCall(`/risks/${id}`, token, 'PATCH', { status: 'Resolved' });
      loadRisks();
      onRefresh();
      showToast('Risk marked as resolved', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Risk Register</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Real-time risk scanner evaluating budget overruns, venue double bookings, and volunteer shortages.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {risks.map((r) => (
          <div key={r.id} className="card p-5 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{r.category}</span>
                <span
                  className={`badge ${
                    r.severity === 'Critical'
                      ? 'badge-critical'
                      : r.severity === 'High'
                      ? 'badge-review'
                      : 'badge-active'
                  }`}
                >
                  {r.severity} Severity
                </span>
              </div>

              <h3 className="font-bold text-navy text-sm mt-2">{r.title}</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{r.detail}</p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span
                className={`text-[11px] font-bold ${
                  r.status === 'Resolved'
                    ? 'text-emerald-600'
                    : r.status === 'Mitigated'
                    ? 'text-blue'
                    : 'text-rose-600'
                }`}
              >
                Status: {r.status}
              </span>

              {r.status === 'Open' && (
                <button
                  onClick={() => handleResolveRisk(r.id)}
                  className="btn btn-outline text-xs py-1 px-2.5 text-blue hover:bg-blue-50"
                >
                  Mark Resolved
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------- 12. RECOMMENDATIONS VIEW -----------------

function RecommendationsView({
  token,
  eventId,
  events,
  onRefresh,
  showToast
}: {
  token: string;
  eventId?: number;
  events: any[];
  onRefresh: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [recommendations, setRecommendations] = useState<any[]>([]);

  const loadRecs = async () => {
    try {
      const q = eventId ? `?event_id=${eventId}` : '';
      const data = await apiCall(`/recommendations${q}`, token);
      setRecommendations(data);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  useEffect(() => {
    loadRecs();
  }, [eventId]);

  const handleApply = async (id: number) => {
    try {
      showToast('Executing automated API operation in PostgreSQL…', 'info');
      await apiCall(`/recommendations/${id}/apply`, token, 'POST');
      loadRecs();
      onRefresh();
      showToast('Recommendation successfully applied to live workspace!', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">AI Recommendations</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Actionable intelligence generated directly from real database conditions. Applying executes live mutations.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {recommendations.map((rec) => (
          <div key={rec.id} className="card p-5 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-violet flex items-center gap-1.5">
                  <Sparkles size={14} />
                  {rec.action_type}
                </span>
                <span className={`badge ${rec.status === 'Applied' ? 'badge-approved' : 'badge-active'}`}>
                  {rec.status}
                </span>
              </div>

              <h3 className="font-bold text-navy text-base mt-2">{rec.title}</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {JSON.stringify(rec.payload)}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Created on {rec.created_at ? new Date(rec.created_at).toLocaleDateString() : 'Today'}
              </span>

              {rec.status === 'Open' ? (
                <button
                  onClick={() => handleApply(rec.id)}
                  className="btn btn-primary text-xs py-1.5 px-3 bg-gradient-to-r from-blue to-violet shadow-xs"
                >
                  Apply Recommendation
                </button>
              ) : (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                  <Check size={14} /> Applied
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------- 13. FACULTY APPROVAL VIEW -----------------

function FacultyApprovalView({
  token,
  user,
  events,
  selectedEventId,
  onRefresh,
  showToast
}: {
  token: string;
  user: any;
  events: any[];
  selectedEventId?: number;
  onRefresh: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [approvals, setApprovals] = useState<any[]>([]);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isFacultyOrAdmin = user?.role === 'Faculty Coordinator' || user?.role === 'Admin';

  const loadApprovals = async () => {
    try {
      const data = await apiCall('/approvals', token);
      setApprovals(data);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  useEffect(() => {
    loadApprovals();
  }, []);

  const handleDecision = async (eventId: number, status: string) => {
    if (!comments.trim() && status !== 'Approved') {
      showToast('Please provide coordinator notes or review feedback.', 'info');
      return;
    }
    setSubmitting(true);
    try {
      await apiCall(`/approvals/${eventId}/decide`, token, 'POST', {
        status,
        comments: comments || `Formally approved by ${user?.name || 'Faculty Board'}.`
      });
      setComments('');
      loadApprovals();
      onRefresh();
      showToast(`Event status updated to ${status}`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Faculty Coordinator Gateway</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Formal administrative governance workflow: Draft → Submitted → Under Review → Approved / Changes Requested.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Your logged-in role:</span>
          <span className="badge badge-active">{user?.role || 'Organizer'}</span>
        </div>
      </div>

      {/* Governance Pipeline Progress Tracker */}
      <div className="card p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          University Governance Lifecycle
        </h3>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="badge badge-draft px-3 py-1">1. Draft</span>
          <ChevronRight size={14} className="text-slate-400" />
          <span className="badge badge-review px-3 py-1">2. Submitted</span>
          <ChevronRight size={14} className="text-slate-400" />
          <span className="badge badge-active px-3 py-1">3. Under Review</span>
          <ChevronRight size={14} className="text-slate-400" />
          <span className="badge badge-approved px-3 py-1">4. Approved</span>
        </div>
      </div>

      {/* Approval Proposals List */}
      <div className="space-y-5">
        {approvals.map((appr) => (
          <div key={appr.id} className="card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{appr.event_type}</span>
                <h3 className="text-lg font-bold text-navy mt-0.5">{appr.event_name}</h3>
              </div>
              <span
                className={`badge ${
                  appr.status === 'Approved'
                    ? 'badge-approved'
                    : appr.status === 'Under Review'
                    ? 'badge-review'
                    : appr.status === 'Changes Requested'
                    ? 'badge-critical'
                    : 'badge-draft'
                }`}
              >
                {appr.status}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-slate-50 p-3.5 rounded-lg">
              <div>
                <span className="text-slate-400">Venue</span>
                <p className="font-semibold text-slate-800">{appr.venue || 'Main Auditorium'}</p>
              </div>
              <div>
                <span className="text-slate-400">Sanctioned Budget</span>
                <p className="font-semibold text-slate-800">{formatINR(appr.budget)}</p>
              </div>
              <div>
                <span className="text-slate-400">Reviewer</span>
                <p className="font-semibold text-slate-800">{appr.reviewer_name || 'Dr. Radhika Menon'}</p>
              </div>
              <div>
                <span className="text-slate-400">Decision Date</span>
                <p className="font-semibold text-slate-800">
                  {appr.decision_date ? new Date(appr.decision_date).toLocaleDateString() : 'Pending'}
                </p>
              </div>
            </div>

            {appr.comments && (
              <div className="p-3 bg-blue-50/60 rounded-lg text-xs border border-blue-100">
                <span className="font-bold text-blue">Coordinator Comments:</span>
                <p className="text-slate-700 mt-0.5">{appr.comments}</p>
              </div>
            )}

            {/* Coordinator Actions */}
            {isFacultyOrAdmin && (
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
                <input
                  type="text"
                  placeholder="Enter feedback notes or conditions…"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="field text-xs py-1.5 flex-1"
                />
                <div className="flex items-center gap-2">
                  <button
                    disabled={submitting}
                    onClick={() => handleDecision(appr.event_id, 'Approved')}
                    className="btn btn-primary text-xs py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700"
                  >
                    ✓ Approve Event
                  </button>
                  <button
                    disabled={submitting}
                    onClick={() => handleDecision(appr.event_id, 'Changes Requested')}
                    className="btn btn-outline text-xs py-1.5 px-3 text-amber-700 border-amber-200 hover:bg-amber-50"
                  >
                    Request Changes
                  </button>
                  <button
                    disabled={submitting}
                    onClick={() => handleDecision(appr.event_id, 'Rejected')}
                    className="btn btn-danger text-xs py-1.5 px-3"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------- 14. REPORTS VIEW -----------------

function ReportsView({
  token,
  events,
  selectedEventId,
  showToast
}: {
  token: string;
  events: any[];
  selectedEventId?: number;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const targetEventId = selectedEventId || (events[0] ? events[0].id : 1);

  const handleDownloadPDF = async () => {
    try {
      showToast('Rendering official ReportLab PDF…', 'info');
      const blob = await apiCall(`/reports/pdf/${targetEventId}`, token);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `organice-event-dossier-${targetEventId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('ReportLab PDF downloaded successfully', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDownloadCSV = async (kind: string) => {
    try {
      showToast(`Generating ${kind} spreadsheet CSV…`, 'info');
      const blob = await apiCall(`/reports/csv/${kind}?event_id=${targetEventId}`, token);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `organice-${kind}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast(`${kind} CSV exported successfully`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Audit Reports & Export</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Generate real multi-page PDF documents and structured CSV files directly from PostgreSQL.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* PDF Card */}
        <div className="card p-6 space-y-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue flex items-center justify-center">
            <FileText size={20} />
          </div>
          <div>
            <h3 className="font-bold text-navy text-lg">Official Event PDF Dossier</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Complete administrative package formatted with ReportLab containing Executive Summary, Timeline,
              Tasks, Team allocations, Budget & Expenses ledger, and Risk Registry.
            </p>
          </div>
          <button onClick={handleDownloadPDF} className="btn btn-primary text-xs py-2.5 px-4 font-bold">
            <Download size={15} />
            Download PDF Report
          </button>
        </div>

        {/* CSV Card */}
        <div className="card p-6 space-y-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Download size={20} />
          </div>
          <div>
            <h3 className="font-bold text-navy text-lg">CSV Spreadsheet Exports</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Export granular tabular data into Excel/Sheets format for university financial audits and scheduling analysis.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => handleDownloadCSV('budget')} className="btn btn-outline text-xs py-2 px-3">
              Export Budget CSV
            </button>
            <button onClick={() => handleDownloadCSV('tasks')} className="btn btn-outline text-xs py-2 px-3">
              Export Tasks CSV
            </button>
            <button onClick={() => handleDownloadCSV('events')} className="btn btn-outline text-xs py-2 px-3">
              Export Events CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------- 15. HISTORY VIEW -----------------

function HistoryView({
  token,
  eventId,
  events
}: {
  token: string;
  eventId?: number;
  events: any[];
}) {
  const [history, setHistory] = useState<any[]>([]);
  const [entityFilter, setEntityFilter] = useState('All');

  const loadHistory = async () => {
    try {
      const q = entityFilter !== 'All' ? `?entity_type=${entityFilter.toLowerCase()}` : '';
      const data = await apiCall(`/history${q}`, token);
      setHistory(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [entityFilter, eventId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Audit Trail & History</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Append-only tamper-evident record of all system events, status changes, and budget updates.
          </p>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {['All', 'Event', 'Task', 'Expense', 'Schedule', 'Approval'].map((f) => (
            <button
              key={f}
              onClick={() => setEntityFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                entityFilter === f ? 'bg-navy text-white' : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <div className="divide-y divide-slate-100">
          {history.map((act) => (
            <div key={act.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-navy">{act.action}</span>
                  <span className="badge badge-draft uppercase">{act.entity_type}</span>
                </div>
                <p className="text-slate-600 mt-0.5">{act.details}</p>
              </div>

              <div className="text-right text-slate-400 text-[11px] whitespace-nowrap">
                <p>{act.created_at ? new Date(act.created_at).toLocaleString() : 'Just now'}</p>
                <p>by {act.user_name}</p>
              </div>
            </div>
          ))}
          {history.length === 0 && (
            <p className="text-center text-xs text-slate-400 py-6">No historical records found.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------- 16. SETTINGS VIEW -----------------

function SettingsView({
  user,
  onRoleSwitched
}: {
  user: any;
  onRoleSwitched: (newRole: string) => void;
}) {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-navy">Settings & Access Control</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Configure profile details and simulate different RBAC roles to test access governance.
        </p>
      </div>

      <div className="card p-6 space-y-6">
        <h3 className="font-bold text-navy text-base">User Profile</h3>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
            <input type="text" value={user?.name || ''} readOnly className="field bg-slate-50" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <input type="text" value={user?.email || ''} readOnly className="field bg-slate-50" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Campus Hub Organization</label>
          <input
            type="text"
            value={user?.organization || 'SRM Institute of Science & Technology'}
            readOnly
            className="field bg-slate-50"
          />
        </div>

        {/* RBAC Role Simulator */}
        <div className="pt-4 border-t border-slate-100">
          <h4 className="font-bold text-navy text-sm mb-1">RBAC Role Simulator</h4>
          <p className="text-xs text-slate-500 mb-3">
            Quickly test the UI as different actors (e.g. Faculty Coordinator to approve proposals).
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {['Organizer', 'Faculty Coordinator', 'Admin', 'Team Member'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onRoleSwitched(r)}
                className={`p-2.5 rounded-lg text-xs font-bold border transition-colors ${
                  user?.role === r
                    ? 'bg-blue text-white border-blue shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* System Diagnostics */}
        <div className="pt-4 border-t border-slate-100">
          <h4 className="font-bold text-navy text-sm mb-2">System Diagnostics</h4>
          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg">
            <div>
              <span className="text-slate-400">Database Engine</span>
              <p className="font-bold text-slate-800 mt-0.5">PostgreSQL 18.6 (Port 5433)</p>
            </div>
            <div>
              <span className="text-slate-400">Backend API</span>
              <p className="font-bold text-slate-800 mt-0.5">FastAPI + Python 3.13</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------- 17. FLOATING AI COPILOT DRAWER -----------------

function AICopilotDrawer({
  token,
  eventId,
  onClose,
  onRefreshWorkspace,
  showToast
}: {
  token: string;
  eventId?: number;
  onClose: () => void;
  onRefreshWorkspace: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [messages, setMessages] = useState<Array<{ sender: 'ai' | 'user'; text: string; action?: any }>>([
    {
      sender: 'ai',
      text: 'Hello! I am your OrgaNice AI Copilot. I analyze your live database for budget overruns, pending tasks, and scheduling conflicts. What would you like to know?'
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const askCopilot = async (questionText: string) => {
    if (!questionText.trim()) return;
    const q = questionText.trim();
    setInputQuery('');
    setMessages((prev) => [...prev, { sender: 'user', text: q }]);
    setBusy(true);

    try {
      const res = await apiCall('/copilot', token, 'POST', {
        prompt: q,
        event_id: eventId
      });

      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: res.answer,
          action: res.requires_confirmation
            ? {
                type: res.action_type,
                payload: res.action_payload,
                prompt: res.action_prompt
              }
            : undefined
        }
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { sender: 'ai', text: 'Sorry, I encountered an error querying the workspace API.' }
      ]);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmAction = async (action: any) => {
    setBusy(true);
    try {
      const res = await apiCall('/copilot', token, 'POST', {
        prompt: 'confirm',
        event_id: eventId,
        confirm_action: true,
        action_type: action.type,
        action_payload: action.payload
      });

      setMessages((prev) => [...prev, { sender: 'ai', text: res.answer }]);
      onRefreshWorkspace();
      showToast('Action confirmed & applied to database', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="fixed bottom-5 right-5 z-50 w-96 max-w-[calc(100vw-2rem)] h-[540px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
      {/* Header */}
      <div className="h-14 bg-[#0d1b3d] px-4 flex items-center justify-between text-white">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-violet-300" />
          <span className="font-bold text-sm tracking-tight">AI Copilot</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
          <X size={18} />
        </button>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`p-3 rounded-xl max-w-[85%] leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-blue text-white rounded-tr-none'
                  : 'bg-slate-100 text-slate-800 rounded-tl-none'
              }`}
            >
              {m.text}
            </div>

            {/* Confirmation Action Button */}
            {m.action && (
              <div className="mt-2 p-2.5 bg-violet-50 rounded-lg border border-violet-200 max-w-[85%] text-violet-900">
                <p className="font-bold">{m.action.prompt || 'Confirm this resolution?'}</p>
                <button
                  onClick={() => handleConfirmAction(m.action)}
                  disabled={busy}
                  className="btn btn-primary text-xs py-1 px-3 mt-2 bg-violet hover:bg-violet-hover"
                >
                  Confirm & Execute in DB
                </button>
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="text-slate-400 flex items-center gap-1.5 text-[11px]">
            <Sparkles size={12} className="animate-spin text-violet" />
            Analyzing live database records…
          </div>
        )}
      </div>

      {/* Quick Prompts Suggestions */}
      <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[11px]">
        {[
          'Which tasks need attention?',
          'Will we exceed the budget?',
          'Are there scheduling conflicts?',
          'Who has too many tasks?',
          'What should I focus on this week?'
        ].map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => askCopilot(chip)}
            className="px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-700 whitespace-nowrap hover:bg-slate-100"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input Query Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          askCopilot(inputQuery);
        }}
        className="p-3 border-t border-slate-200 flex gap-2 bg-white"
      >
        <input
          type="text"
          placeholder="Ask anything about your events…"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          className="field text-xs py-2 flex-1"
        />
        <button type="submit" disabled={busy || !inputQuery.trim()} className="btn btn-primary px-3 py-2">
          <Send size={14} />
        </button>
      </form>
    </aside>
  );
}
