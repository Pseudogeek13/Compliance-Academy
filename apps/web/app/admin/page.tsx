"use client";
import useSWR from "swr";
import { useState } from "react";

const api = (path: string, init?: RequestInit) => fetch(`http://localhost:4000${path}`, init).then(r => r.json());

export default function AdminHome() {
  const { data: courses, mutate } = useSWR("/admin/courses", (p) => api(p));
  const [title, setTitle] = useState("");

  return (
    <div>
      <h2>Admin · Courses</h2>
      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <input placeholder="New course title" value={title} onChange={(e) => setTitle(e.target.value)} style={{ flex: 1, background: 'transparent', color: 'white', border: '1px solid #222', padding: 10, borderRadius: 8 }} />
        <button onClick={async () => {
          if (!title.trim()) return;
          await api('/admin/courses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
          setTitle("");
          mutate();
        }}>Create</button>
      </div>

      {!courses && <p className="chip">Loading…</p>}
      {courses && (
        <div style={{ display: 'grid', gap: 12 }}>
          {courses.map((c: any) => (
            <a key={c.id} href={`/admin/${c.id}`} className="card" style={{ display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <strong>{c.title}</strong>
                <span className="chip">{c.status}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
