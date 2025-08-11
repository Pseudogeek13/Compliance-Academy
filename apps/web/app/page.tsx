"use client";
import useSWR from "swr";

const api = (path: string) => fetch(`http://localhost:4000${path}`).then((r) => r.json());

export default function Home() {
  const { data: assignments } = useSWR("/me/assignments", api);
  const completed = (assignments || []).filter((a: any) => a.passed).length;
  const total = (assignments || []).length;

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>My Assignments</h2>
      {!assignments && <p className="chip">Loading…</p>}
      {assignments && (
        <>
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <strong>{completed} completed</strong> of {total}
            </div>
            <div className="progress" style={{ width: 300 }}>
              <span style={{ width: `${total ? Math.round((completed/total)*100) : 0}%` }} />
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {assignments.map((a: any) => (
            <a key={a.id} href={`/assignments/${a.id}`} className="card" style={{ display: 'block', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 12, left: 12, width: 10, height: 10, borderRadius: 999, background: a.passed ? '#28E7C5' : (a.status === 'In Progress' ? '#6843E1' : '#ff2d2d') }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16 }}>
                <strong>{a.title}</strong>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: '#bcbcbc', paddingLeft: 16 }}>
                {a.passed ? (
                  <>Next due: {a.nextDueAt ? new Date(a.nextDueAt).toLocaleDateString('de-DE') : '—'}</>
                ) : (
                  <>Due {new Date(a.dueAt).toLocaleDateString('de-DE')} • Attempts left: {a.remainingAttempts}</>
                )}
              </div>
              {typeof a.progress === 'number' && (
                <div className="progress" style={{ marginTop: 12 }}>
                  <span style={{ width: `${a.progress}%` }} />
                </div>
              )}
            </a>
          ))}
        </div>
        </>
      )}
    </div>
  );
}
