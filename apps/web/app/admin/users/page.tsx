"use client";
import React from "react";
import useSWR from "swr";

const api = (path: string, init?: RequestInit) => fetch(`http://localhost:4000${path}`, { credentials: 'include', ...(init || {}) }).then(r => r.json());

export default function AdminUsers() {
  const { data: users, mutate } = useSWR('/admin/users', (p) => api(p));
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("LEARNER");
  if (!users) return <p className="chip">Loading…</p>;
  if (!Array.isArray(users)) {
    return (
      <div className="card">
        <p>You need to be logged in as admin.</p>
        <p>In the browser console run:</p>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{`fetch('http://localhost:4000/auth/dev-login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: 'thomas@fns.llc', role: 'SYSTEM_ADMIN' }), credentials:'include'}).then(r=>r.json())`}</pre>
        <p>Then refresh this page.</p>
      </div>
    );
  }
  return (
    <div>
      <h2>Users</h2>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="Add user by email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: 1, background: 'transparent', color: 'white', border: '1px solid #222', padding: 10, borderRadius: 8 }} />
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ background: 'transparent', color: '#fff', border: '1px solid #222', padding: 10, borderRadius: 8 }}>
            <option value="LEARNER">Learner</option>
            <option value="MANAGER">Manager</option>
            <option value="CONTENT_ADMIN">Content Admin</option>
            <option value="SYSTEM_ADMIN">System Admin</option>
          </select>
          <button onClick={async () => {
            if (!email) return;
            await api('/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, role }) });
            setEmail("");
            mutate();
          }}>Add</button>
        </div>
      </div>
      <div className="card">
        {users.map((u: any) => (
          <UserRow key={u.id} u={u} onRoleChanged={mutate} />
        ))}
      </div>
    </div>
  );
}

function renderStatus(e: any) {
  const statusText = e.status === 'NOT_STARTED' ? 'Not started' : e.status === 'IN_PROGRESS' ? 'In progress' : 'Completed';
  const attemptsText = `${e.attempts} attempt${e.attempts === 1 ? '' : 's'}`;
  const passText = e.passed ? 'Passed' : 'Not passed yet';
  const dueText = e.dueAt ? new Date(e.dueAt).toLocaleDateString('de-DE') : '—';
  return `${statusText} · ${attemptsText} · ${passText} · Due ${dueText}`;
}

function progressWidth(e: any) {
  if (e.passed) return 100;
  if (e.status === 'IN_PROGRESS') return 50;
  return 0;
}

function UserRow({ u, onRoleChanged }: { u: any; onRoleChanged: () => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ borderBottom: '1px solid #1a1a1a', padding: '8px 0' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{open ? '▾' : '▸'}</span>
          <strong>{u.name}</strong>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
          <span className="chip">{u.role}</span>
          <select value={u.role} onChange={async (e) => { await api(`/admin/users/${u.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: e.target.value }) }); onRoleChanged(); }} style={{ background: 'transparent', color: '#fff', border: '1px solid #222', padding: 6, borderRadius: 6 }}>
            <option value="LEARNER">Learner</option>
            <option value="MANAGER">Manager</option>
            <option value="CONTENT_ADMIN">Content Admin</option>
            <option value="SYSTEM_ADMIN">System Admin</option>
          </select>
        </div>
      </div>
      <div style={{ color: '#bcbcbc', fontSize: 12 }}>{u.email}</div>
      {open && (
        <div style={{ marginTop: 8 }}>
          {u.enrollments.map((e: any, i: number) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span><strong>{e.course}</strong></span>
              <span>{renderStatus(e)}</span>
              <div className="progress" style={{ gridColumn: '1 / -1' }}><span style={{ width: `${progressWidth(e)}%` }} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
