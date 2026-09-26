import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../services/api';
import { useLoad } from '../csr/CSRLayout';
import AsyncState from '../../components/AsyncState';
import AdminStatCard from '../../components/admin/AdminStatCard';
import SimpleGrowthChart from '../../components/admin/SimpleGrowthChart';
import VerificationReviewCard from '../../components/admin/VerificationReviewCard';
import ReportReviewCard from '../../components/admin/ReportReviewCard';
import UserTableRow from '../../components/admin/UserTableRow';
import StatusBadge from '../../components/StatusBadge';
const field = 'block w-full border rounded-lg p-2';
function Pager({
  data,
  page,
  setPage
}) {
  return data && data.totalPages > 1 && <div className="flex justify-between gap-3"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {data.totalPages}</span><button disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Next</button></div>;
}
export function AdminDashboard() {
  const [interval, setInterval] = useState('month');
  const state = useLoad(async () => {
    const [overview, growth] = await Promise.all([api.get('/admin/stats/overview'), api.get('/admin/stats/growth', {
      params: {
        interval
      }
    })]);
    return {
      data: {
        ...overview.data,
        growth: growth.data
      }
    };
  }, [interval]);
  const d = state.data;
  return <div className="space-y-6"><h1 className="text-3xl font-bold">Platform overview</h1><AsyncState {...state} onRetry={state.refresh}>{d && <><div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">{[['Total users', Object.values(d.users).reduce((a, b) => a + b, 0)], ['Completed projects', d.completedProjects], ['Confirmed volunteer hours', d.volunteerHours], ['People reached (impact snapshots)', d.beneficiaries], ['CSR allocated (INR)', d.csrAllocated], ['Volunteer donations (INR)', d.volunteerDonations], ['Combined simulated funding (INR)', d.totalFunding], ['Suspended users', d.suspendedUsers]].map(([label, value]) => <AdminStatCard key={label} label={label} value={value} />)}</div><p className="text-sm text-stone-600">Money is simulated INR. Withdrawn allocations are excluded. Hours count confirmed structured contributions once; beneficiaries come from completion snapshots.</p><div className="grid sm:grid-cols-2 gap-4">{[['Users by role', d.users], ['Problems by status', d.problems], ['Projects by status', d.projects], ['NGO verification', d.ngos], ['CSR verification', d.companies]].map(([title, values]) => <section key={title} className="bg-white rounded-xl border p-4"><h2 className="font-bold mb-2">{title}</h2>{Object.entries(values).map(([key, value]) => <p key={key}>{key.replaceAll('_', ' ')}: {value}</p>)}{!Object.keys(values).length && <p>No records yet.</p>}</section>)}</div><div className="flex flex-wrap gap-4"><Link className="underline text-brand-800" to="/admin/verifications">Pending verifications ({d.pendingVerifications})</Link><Link className="underline text-brand-800" to="/admin/reports">Pending reports ({d.pendingReports})</Link></div><section className="bg-white border rounded-xl p-5 space-y-4"><h2 className="text-xl font-bold">Platform growth</h2><label>Period<select value={interval} onChange={e => setInterval(e.target.value)} className={field}><option value="month">Monthly</option><option value="week">Weekly</option></select></label><SimpleGrowthChart items={d.growth.items} /></section></>}</AsyncState></div>;
}
export function AdminVerifications() {
  const [status, setStatus] = useState('pending'),
    [page, setPage] = useState(1),
    [message, setMessage] = useState('');
  const state = useLoad(() => api.get('/admin/verifications', {
    params: {
      status,
      page
    }
  }), [status, page]);
  const changed = async m => {
    setMessage(m);
    await state.refresh();
    window.dispatchEvent(new Event('trust-refresh'));
  };
  return <div className="space-y-5"><h1 className="text-3xl font-bold">Verification review</h1><label>Status<select value={status} onChange={e => {
        setStatus(e.target.value);
        setPage(1);
      }} className={field}>{['pending', 'verified', 'rejected'].map(s => <option key={s}>{s}</option>)}</select></label><p className="text-sm">History shows current decisions and the most recent review.</p>{message && <p role="status" className="text-brand-800">{message}</p>}<AsyncState {...state} onRetry={state.refresh} empty={state.data?.items.length === 0} emptyTitle="No verification requests in this view"><div className="grid xl:grid-cols-2 gap-4">{state.data?.items.map(p => <VerificationReviewCard key={p._id} profile={p} onChanged={changed} />)}</div></AsyncState><Pager data={state.data} page={page} setPage={setPage} /></div>;
}
export function AdminReports() {
  const [status, setStatus] = useState('pending'),
    [targetType, setTargetType] = useState(''),
    [page, setPage] = useState(1),
    [message, setMessage] = useState('');
  const state = useLoad(() => api.get('/admin/reports', {
    params: {
      status: status || undefined,
      targetType: targetType || undefined,
      page
    }
  }), [status, targetType, page]);
  return <div className="space-y-5"><h1 className="text-3xl font-bold">Reported content</h1><div className="flex flex-wrap gap-4"><label>Status<select className={field} value={status} onChange={e => {
          setStatus(e.target.value);
          setPage(1);
        }}><option value="">All</option>{['pending', 'reviewed', 'action_taken', 'dismissed'].map(v => <option key={v}>{v}</option>)}</select></label><label>Content type<select className={field} value={targetType} onChange={e => {
          setTargetType(e.target.value);
          setPage(1);
        }}><option value="">All</option>{['problem', 'project', 'user', 'ngo', 'csr_profile'].map(v => <option key={v}>{v}</option>)}</select></label></div>{message && <p role="status">{message}</p>}<AsyncState {...state} onRetry={state.refresh} empty={state.data?.items.length === 0} emptyTitle="No reports in this view">{state.data?.items.map(report => <ReportReviewCard key={report._id} report={report} onChanged={async m => {
        setMessage(m);
        await state.refresh();
      }} />)}</AsyncState><Pager data={state.data} page={page} setPage={setPage} /></div>;
}
export function AdminUsers() {
  const [search, setSearch] = useState(''),
    [query, setQuery] = useState(''),
    [role, setRole] = useState(''),
    [page, setPage] = useState(1),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);
  const state = useLoad(() => api.get('/admin/users', {
    params: {
      search: query,
      role: role || undefined,
      page
    }
  }), [query, role, page]);
  const toggle = async user => {
    if (!window.confirm((user.isSuspended ? 'Reactivate ' : 'Suspend ') + user.name + '?')) return;
    setBusy(true);
    setError('');
    try {
      await api.patch('/admin/users/' + user._id + (user.isSuspended ? '/reactivate' : '/suspend'));
      setMessage('Account ' + (user.isSuspended ? 'reactivated.' : 'suspended.'));
      await state.refresh();
    } catch (e) {
      setError(e.response?.data?.message || 'Account update failed.');
    } finally {
      setBusy(false);
    }
  };
  const add = async e => {
    e.preventDefault();
    const form = e.currentTarget,
      body = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError('');
    try {
      await api.post('/admin/create-admin', body);
      form.reset();
      setMessage('Administrator account created.');
      await state.refresh();
    } catch (e) {
      setError(e.response?.data?.message || 'Could not create administrator.');
    } finally {
      setBusy(false);
    }
  };
  return <div className="space-y-5"><h1 className="text-3xl font-bold">User management</h1><div className="grid sm:grid-cols-2 gap-3"><label>Search name or email<input value={search} onChange={e => setSearch(e.target.value)} className={field} /></label><label>Role<select value={role} onChange={e => {
          setRole(e.target.value);
          setPage(1);
        }} className={field}><option value="">All roles</option>{['community_user', 'ngo', 'csr_manager', 'admin'].map(v => <option key={v}>{v}</option>)}</select></label></div>{message && <p role="status" className="text-brand-800">{message}</p>}{error && <p role="alert" className="text-red-800">{error}</p>}<AsyncState {...state} onRetry={state.refresh} empty={state.data?.items.length === 0} emptyTitle="No users match your search"><div className="space-y-3">{state.data?.items.map(user => <UserTableRow key={user._id} user={user} onToggle={toggle} busy={busy} />)}</div></AsyncState><Pager data={state.data} page={page} setPage={setPage} /><details className="bg-white border rounded-xl p-5"><summary className="font-bold cursor-pointer">Create another administrator</summary><form onSubmit={add} className="space-y-3 mt-4">{[['name', 'Name', 'text'], ['email', 'Email', 'email'], ['password', 'Password', 'password']].map(([name, label, type]) => <label className="block" key={name}>{label}<input name={name} type={type} required minLength={name === 'password' ? 8 : name === 'name' ? 2 : undefined} maxLength={name === 'password' ? 72 : 100} autoComplete={name === 'password' ? 'new-password' : undefined} className={field} /></label>)}<p className="text-sm">Passwords require at least 8 characters and at most 72 UTF-8 bytes.</p><button disabled={busy} className="bg-brand-700 text-white rounded-lg p-3">Create administrator</button></form></details></div>;
}
export function AdminUserDetail() {
  const {
    id
  } = useParams();
  const state = useLoad(() => api.get('/admin/users/' + id), [id]);
  const [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const user = state.data?.user;
  const toggle = async account => {
    if (!window.confirm('Change account access for ' + account.name + '?')) return;
    setBusy(true);
    setError('');
    try {
      await api.patch('/admin/users/' + account._id + (account.isSuspended ? '/reactivate' : '/suspend'));
      setMessage('Account updated.');
      await state.refresh();
    } catch (e) {
      setError(e.response?.data?.message || 'Update failed.');
    } finally {
      setBusy(false);
    }
  };
  return <div className="space-y-5"><Link to="/admin/users" className="underline text-brand-800">All users</Link><h1 className="text-3xl font-bold">Account detail</h1>{message && <p role="status">{message}</p>}{error && <p role="alert" className="text-red-800">{error}</p>}<AsyncState {...state} onRetry={state.refresh}>{user && <><UserTableRow user={user} busy={busy} onToggle={toggle} /><section className="bg-white p-5 border rounded-xl"><h2 className="font-bold">Profile summary</h2><p>{user.profile?.ngoName || user.profile?.companyName || user.profile?.bio || 'No additional profile information.'}</p><p>{user.location?.city}</p><p>Joined {new Date(user.createdAt).toLocaleDateString()}</p><p>Email {user.isEmailVerified ? 'verified' : 'not verified'}</p></section></>}</AsyncState></div>;
}
export function AdminCategories() {
  const state = useLoad(() => api.get('/admin/categories'));
  return <div className="space-y-5"><h1 className="text-3xl font-bold">Category overview</h1><span tabIndex={0} title="Dynamic categories require migrating enum fields to a reference collection."><button disabled className="border rounded-lg p-2 text-stone-500">Add Category</button></span><p className="text-sm">Categories are validated by the existing schema. Dynamic categories require a future schema migration. Counts represent documents; adopted problems and their projects are counted separately.</p><AsyncState {...state} onRetry={state.refresh} empty={state.data?.items.length === 0}><div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{state.data?.items.map(c => <article className="border bg-white rounded-xl p-4" key={c.name}><h2 className="font-bold capitalize">{c.name.replaceAll('_', ' ')}</h2><p>{c.problems} problems / {c.projects} projects</p><p>{c.total} total uses</p></article>)}</div></AsyncState></div>;
}
export function AdminProjectVerification() {
  const [page, setPage] = useState(1),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const state = useLoad(() => api.get('/admin/projects/pending-verification', {
    params: {
      page
    }
  }), [page]);
  return <div className="space-y-5"><h1 className="text-3xl font-bold">Project evidence review</h1>{message && <p role="status">{message}</p>}{error && <p role="alert" className="text-red-800">{error}</p>}<AsyncState {...state} onRetry={state.refresh} empty={state.data?.items.length === 0} emptyTitle="No projects awaiting evidence review">{state.data?.items.map(p => <article key={p._id} className="bg-white border rounded-xl p-5 space-y-3"><h2 className="text-xl font-bold">{p.title}</h2><p>Managed by {p.ngoId?.name || 'Unknown NGO'} / Required INR {p.fundingRequired.toLocaleString('en-IN')}</p><StatusBadge status={p.status} /><p>{p.description}</p><div className="grid sm:grid-cols-2 gap-4">{['before', 'after'].map(stage => <section key={stage}><h3 className="font-bold capitalize">{stage}</h3>{p.photos[stage].map((url, i) => <img key={url + i} src={url} alt={p.title + ' ' + stage + ' evidence ' + (i + 1)} className="w-full max-h-64 object-contain rounded-lg" />)}{!p.photos[stage].length && <p>No {stage} evidence uploaded.</p>}</section>)}</div><button disabled={busy || !p.photos.before.length || !p.photos.after.length} className="bg-brand-700 text-white rounded-lg p-3 disabled:opacity-50" onClick={async () => {
          setBusy(true);
          setError('');
          try {
            await api.patch('/admin/projects/' + p._id + '/verify-evidence');
            setMessage('Project evidence verified.');
            await state.refresh();
          } catch (e) {
            setError(e.response?.data?.message || 'Review failed.');
          } finally {
            setBusy(false);
          }
        }}>Mark Evidence Verified</button></article>)}</AsyncState><Pager data={state.data} page={page} setPage={setPage} /></div>;
}
