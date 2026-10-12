import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, BadgeCheck, Bell, Check, ChevronDown, CircleDollarSign, Clock3, Command, CreditCard, LayoutDashboard, LogOut, Menu, Plus, Search, ShieldCheck, Users, X } from "lucide-react";
import { api, ApiError, Role, Summary, Transaction, User } from "./lib/api";
import TransactionIntelligence from "./TransactionIntelligence";

type AuthPayload = { token: string; user: User };
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value || 0);
const dateLabel = (value: string) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("secureops_token") || "");
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [page, setPage] = useState("Overview");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  const logout = useCallback(() => { localStorage.removeItem("secureops_token"); setToken(""); setUser(null); setTransactions([]); setSummary(null); setUsers([]); setPage("Overview"); }, []);

  const loadData = useCallback(async (activeToken: string) => {
    setLoading(true); setError("");
    try {
      const [me, tx, stats] = await Promise.all([
        api<{ user: User }>("/auth/me", activeToken),
        api<{ transactions: Transaction[] }>("/transactions", activeToken),
        api<{ summary: Summary }>("/dashboard/summary", activeToken)
      ]);
      setUser(me.user); setTransactions(tx.transactions); setSummary(stats.summary);
      if (me.user.role === "admin") {
        const response = await api<{ users: User[] }>("/users", activeToken);
        setUsers(response.users);
      } else setUsers([]);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unable to load dashboard.";
      if ((e instanceof ApiError && e.status === 401) || message.toLowerCase().includes("session") || message.toLowerCase().includes("authentication")) logout();
      setError(message);
    } finally { setLoading(false); }
  }, [logout]);

  useEffect(() => { if (token) { void loadData(token); } }, [token, loadData]);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setLoading(true);
    const form = new FormData(event.currentTarget);
    const body: Record<string, string> = { email: String(form.get("email") || ""), password: String(form.get("password") || "") };
    if (authMode === "register") body.name = String(form.get("name") || "");
    try {
      const result = await api<AuthPayload>(`/auth/${authMode === "login" ? "login" : "register"}`, undefined, { method: "POST", body: JSON.stringify(body) });
      localStorage.setItem("secureops_token", result.token); setToken(result.token); setUser(result.user); setNotice(`Welcome${result.user.name ? `, ${result.user.name}` : ""}.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Authentication failed."); }
    finally { setLoading(false); }
  }

  async function createTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!token) return;
    const form = new FormData(event.currentTarget);
    try {
      await api("/transactions", token, { method: "POST", body: JSON.stringify({ title: form.get("title"), description: form.get("description"), amount: Number(form.get("amount")) }) });
      setShowCreate(false); setNotice("Transaction submitted successfully."); await loadData(token);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create transaction."); }
  }

  async function updateStatus(id: string, status: "approved" | "rejected") {
    if (!token) return;
    try { await api(`/transactions/${id}/status`, token, { method: "PATCH", body: JSON.stringify({ status }) }); setNotice(`Transaction ${status}.`); await loadData(token); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not update transaction."); }
  }

  async function changeRole(id: string, role: Role) {
    if (!token) return;
    try { await api(`/users/${id}/role`, token, { method: "PATCH", body: JSON.stringify({ role }) }); setNotice("User role updated."); await loadData(token); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not update role."); }
  }

  const visibleTransactions = useMemo(() => transactions.filter((tx) => {
    const matchesSearch = `${tx.title} ${tx.createdBy?.name || ""} ${tx.createdBy?.email || ""}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (statusFilter === "all" || tx.status === statusFilter);
  }), [transactions, search, statusFilter]);

  if (!token || !user) return <AuthScreen mode={authMode} setMode={setAuthMode} onSubmit={handleAuth} loading={loading} error={error} />;
  const isReviewer = user.role === "admin" || user.role === "manager";
  const navItems = [{ label: "Overview", icon: LayoutDashboard }, { label: "Transactions", icon: CreditCard }, { label: "Transaction Intelligence", icon: Activity }, ...(user.role === "admin" ? [{ label: "Team", icon: Users }] : [])];

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <div className="brand"><span className="brand-mark"><ShieldCheck size={22} /></span><span>secure<span className="brand-accent">ops</span><small>OPERATIONS CONSOLE</small></span><button className="icon-btn mobile-close" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={18} /></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <div className="workspace"><div className="workspace-avatar">S</div><div><strong>SecureOps Inc.</strong><span>Enterprise plan</span></div><ChevronDown size={15} /></div>
      <div className="nav-label">MENU</div>
      <nav>{navItems.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${page === label ? "active" : ""}`} onClick={() => { setPage(label); setMobileNav(false); }}><Icon size={18} /><span>{label}</span>{label === "Transactions" && summary?.pending ? <b className="nav-count">{summary.pending}</b> : null}</button>)}</nav>
      <div className="sidebar-bottom"><div className="security-card"><div className="security-icon"><ShieldCheck size={18} /></div><strong>Security status</strong><p>Your workspace is protected and up to date.</p><span><i /> All systems operational</span></div><button className="nav-item" onClick={logout}><LogOut size={18} /><span>Sign out</span></button><div className="sidebar-version">SECUREOPS <span>v1.0.0</span></div></div>
    </aside>
    {mobileNav && <button className="nav-scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
    <main className="main-area">
      <header className="topbar"><button className="icon-btn menu-toggle" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={20} /></button><div className="breadcrumb">Workspace <span>/</span> <strong>{page}</strong></div><div className="topbar-actions"><div className="system-pill"><i /> Systems normal</div><button className="icon-btn notification-btn" aria-label="Notifications" onClick={() => setNotice("You're all caught up.")}><Bell size={18} /><i /></button><div className="topbar-divider" /><div className="user-mini"><div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div><div><strong>{user.name}</strong><span>{user.role}</span></div><ChevronDown size={15} /></div></div></header>
      <div className="content">
        <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot" /> OPERATIONS OVERVIEW</div><h1>{page === "Overview" ? "Good to see you, " : ""}{page === "Overview" ? <em>{user.name.split(" ")[0]}.</em> : page}</h1>
          <p>
            {page === "Overview"
              ? "Here's what's happening across your workspace today."
              : page === "Transactions"
                ? "Review and manage transaction activity."
                : page === "Transaction Intelligence"
                  ? "Explore transaction patterns and rule-based risk indicators."
                  : "Manage workspace access and team roles."}
          </p>
        </div><div className="welcome-actions"><span className="date-chip"><Clock3 size={15} />{new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span><button className="primary-btn" onClick={() => setShowCreate(true)}><Plus size={17} /> New transaction</button></div></div>
        {error && <div className="alert error-alert"><X size={17} /><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss"><X size={16} /></button></div>}
        {notice && <div className="alert success-alert"><Check size={17} /><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss"><X size={16} /></button></div>}
        {loading && <div className="loading-line"><span /> Syncing workspace data…</div>}

        {page === "Transaction Intelligence" ? (
          <TransactionIntelligence token={token} />
        ) : page === "Team" && user.role === "admin" ? (
          <TeamView users={users} onChangeRole={changeRole} />
        ) : <>

          {page === "Overview" && <><div className="section-heading"><div><h2>Performance snapshot</h2><p>A live summary of your transaction activity.</p></div><span className="live-label"><i /> LIVE DATA</span></div><div className="stats-grid">
            <StatCard label="Total transactions" value={String(summary?.totalTransactions ?? 0)} note="All recorded activity" icon={<Activity size={19} />} tone="violet" />
            <StatCard label="Pending review" value={String(summary?.pending ?? 0)} note={isReviewer ? "Awaiting your review" : "Awaiting review"} icon={<Clock3 size={19} />} tone="amber" />
            <StatCard label="Approved volume" value={money(summary?.approvedAmount ?? 0)} note="Successfully approved" icon={<CircleDollarSign size={19} />} tone="green" />
            <StatCard label="Rejected" value={String(summary?.rejected ?? 0)} note="Transactions declined" icon={<ArrowDownRight size={19} />} tone="rose" />
          </div><div className="dashboard-grid"><section className="panel activity-panel"><div className="panel-header"><div><h3>Recent transactions</h3><p>Your latest workspace activity</p></div><button className="text-btn" onClick={() => setPage("Transactions")}>View all <ArrowUpRight size={15} /></button></div><TransactionTable transactions={transactions.slice(0, 5)} isReviewer={isReviewer} onStatus={updateStatus} /></section><section className="panel summary-panel"><div className="panel-header"><div><h3>Transaction health</h3><p>Current status distribution</p></div><span className="panel-icon"><Activity size={17} /></span></div><div className="health-total"><strong>{summary?.totalTransactions ?? 0}</strong><span>total transactions</span></div><div className="health-bar"><span className="bar-approved" style={{ width: `${summary?.totalTransactions ? ((summary.approved || 0) / summary.totalTransactions) * 100 : 0}%` }} /><span className="bar-pending" style={{ width: `${summary?.totalTransactions ? ((summary.pending || 0) / summary.totalTransactions) * 100 : 0}%` }} /><span className="bar-rejected" style={{ width: `${summary?.totalTransactions ? ((summary.rejected || 0) / summary.totalTransactions) * 100 : 0}%` }} /></div><div className="health-legend"><Legend color="green" label="Approved" value={summary?.approved ?? 0} /><Legend color="amber" label="Pending" value={summary?.pending ?? 0} /><Legend color="rose" label="Rejected" value={summary?.rejected ?? 0} /></div><div className="summary-divider" /><div className="volume-row"><div className="volume-icon"><CircleDollarSign size={18} /></div><div><span>Total submitted volume</span><strong>{money(summary?.totalAmount ?? 0)}</strong></div><span className="volume-caption">USD</span></div></section></div></>}
          {page === "Transactions" && <section className="panel transactions-panel"><div className="panel-header"><div><h3>All transactions</h3><p>{visibleTransactions.length} records found</p></div><button className="primary-btn" onClick={() => setShowCreate(true)}><Plus size={16} /> Add transaction</button></div><div className="table-toolbar"><label className="search-box"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search transactions or people…" /></label><select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div><TransactionTable transactions={visibleTransactions} isReviewer={isReviewer} onStatus={updateStatus} /></section>}
        </>}
        <footer className="page-footer"><span>© {new Date().getFullYear()} SecureOps Inc.</span><span><i /> All systems operational <b>·</b> Secured with JWT</span></footer>
      </div>
    </main>
    {showCreate && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}><section className="modal"><div className="modal-header"><div><span className="modal-icon"><CreditCard size={20} /></span><h3>New transaction</h3><p>Submit a transaction for workspace review.</p></div><button className="icon-btn" onClick={() => setShowCreate(false)} aria-label="Close"><X size={19} /></button></div><form onSubmit={createTransaction} className="create-form"><label>Transaction title<input name="title" placeholder="e.g. Cloud infrastructure invoice" required minLength={2} maxLength={140} /></label><label>Amount (USD)<div className="amount-input"><span>$</span><input name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required /></div></label><label>Description <span className="optional">Optional</span><textarea name="description" placeholder="Add context for the reviewer…" rows={3} maxLength={1000} /></label><div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setShowCreate(false)}>Cancel</button><button type="submit" className="primary-btn"><Plus size={16} /> Submit transaction</button></div></form></section></div>}
  </div>;
}

function AuthScreen({ mode, setMode, onSubmit, loading, error }: { mode: "login" | "register"; setMode: (mode: "login" | "register") => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; loading: boolean; error: string }) {
  return <div className="auth-page"><div className="auth-decoration decoration-one" /><div className="auth-decoration decoration-two" /><div className="auth-left"><div className="brand auth-brand"><span className="brand-mark"><ShieldCheck size={23} /></span><span>secure<span className="brand-accent">ops</span><small>OPERATIONS CONSOLE</small></span></div><div className="auth-hero"><div className="auth-kicker"><span /> TRUSTED OPERATIONS PLATFORM</div><h1>Clarity for your<br /><em>critical operations.</em></h1><p>One secure workspace to monitor transactions, manage access, and keep your team moving with confidence.</p><div className="auth-feature"><span><ShieldCheck size={17} /></span><div><strong>Security by design</strong><small>Role-based access and protected sessions</small></div></div><div className="auth-feature"><span><Activity size={17} /></span><div><strong>Real-time visibility</strong><small>Stay on top of activity and approvals</small></div></div></div><div className="auth-left-footer"><span>© {new Date().getFullYear()} SecureOps Inc.</span><span>BUILT FOR OPERATIONAL CONFIDENCE</span></div></div><div className="auth-right"><form className="auth-card" onSubmit={onSubmit}><div className="auth-card-top"><div className="auth-card-symbol"><Command size={21} /></div><span className="secure-label"><ShieldCheck size={14} /> SECURE SIGN IN</span></div><h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2><p className="auth-subtitle">{mode === "login" ? "Enter your credentials to access your workspace." : "Create an account to start managing transactions."}</p>{error && <div className="alert error-alert"><X size={16} /><span>{error}</span></div>}{mode === "register" && <label>Full name<div className="field-wrap"><input name="name" placeholder="Your full name" required minLength={2} autoComplete="name" /></div></label>}<label>Email address<div className="field-wrap"><input name="email" type="email" placeholder="you@company.com" required autoComplete="email" /></div></label><label>Password<div className="field-wrap"><input name="password" type="password" placeholder={mode === "login" ? "Enter your password" : "At least 8 characters"} required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} /></div></label>{mode === "login" && <div className="auth-help"><span><ShieldCheck size={14} /> Protected connection</span><span>8-hour session</span></div>}<button className="primary-btn auth-submit" type="submit" disabled={loading}>{loading ? "Please wait…" : mode === "login" ? "Sign in to workspace" : "Create account"}<ArrowUpRight size={17} /></button><div className="auth-switch">{mode === "login" ? "New to SecureOps?" : "Already have an account?"} <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "Create account" : "Sign in"}</button></div><div className="auth-card-footer"><span><BadgeCheck size={15} /> Enterprise-grade access control</span><span>PRIVACY · SECURITY</span></div></form></div></div>;
}

function StatCard({ label, value, note, icon, tone }: { label: string; value: string; note: string; icon: ReactNode; tone: string }) { return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${tone}`}>{icon}</span></div><strong className="stat-value">{value}</strong><div className="stat-note"><span className={`note-dot ${tone}`} />{note}</div></div>; }
function Legend({ color, label, value }: { color: string; label: string; value: number }) { return <div className="legend-row"><span className={`legend-dot ${color}`} /><span>{label}</span><strong>{value}</strong></div>; }
function TransactionTable({ transactions, isReviewer, onStatus }: { transactions: Transaction[]; isReviewer: boolean; onStatus: (id: string, status: "approved" | "rejected") => void }) {
  if (!transactions.length) return <div className="empty-state"><span><CreditCard size={23} /></span><strong>No transactions yet</strong><p>When transactions are submitted, they will appear here.</p></div>;
  return <div className="table-scroll"><table><thead><tr><th>TRANSACTION</th><th>SUBMITTED BY</th><th>DATE</th><th>AMOUNT</th><th>STATUS</th>{isReviewer && <th>ACTIONS</th>}</tr></thead><tbody>{transactions.map((tx) => <tr key={tx._id}><td><div className="transaction-name"><span className="transaction-icon"><CreditCard size={16} /></span><div><strong>{tx.title}</strong><small>#{tx._id.slice(-7).toUpperCase()}</small></div></div></td><td><div className="submitter">{tx.createdBy?.name || "You"}<small>{tx.createdBy?.email || "Current account"}</small></div></td><td className="date-cell">{dateLabel(tx.createdAt)}</td><td className="amount-cell">{money(tx.amount)}</td><td><span className={`status-badge ${tx.status}`}><i />{tx.status}</span></td>{isReviewer && <td><div className="row-actions">{tx.status === "pending" ? <><button className="approve-btn" title="Approve" onClick={() => onStatus(tx._id, "approved")}><Check size={15} /></button><button className="reject-btn" title="Reject" onClick={() => onStatus(tx._id, "rejected")}><X size={15} /></button></> : <span className="action-complete"><Check size={14} /></span>}</div></td>}</tr>)}</tbody></table></div>;
}
function TeamView({ users, onChangeRole }: { users: User[]; onChangeRole: (id: string, role: Role) => void }) { return <section className="panel team-panel"><div className="panel-header"><div><h3>Workspace team</h3><p>{users.length} members with workspace access</p></div><span className="live-label"><Users size={14} /> ADMIN CONTROLS</span></div><div className="team-list">{users.map((member) => <div className="team-row" key={member.id || member._id}><div className="avatar team-avatar">{member.name.slice(0, 1).toUpperCase()}</div><div className="team-person"><strong>{member.name}</strong><span>{member.email}</span></div><span className={`role-chip ${member.role}`}>{member.role}</span><select aria-label={`Change role for ${member.name}`} value={member.role} onChange={(e) => onChangeRole(member.id || member._id!, e.target.value as Role)}><option value="user">User</option><option value="manager">Manager</option><option value="admin">Admin</option></select></div>)}{!users.length && <div className="empty-state"><span><Users size={22} /></span><strong>No team members found</strong></div>}</div></section>; }
