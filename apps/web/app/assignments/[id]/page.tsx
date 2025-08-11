"use client";
import useSWR from "swr";
import { useState } from "react";
import { useParams } from "next/navigation";

const api = (path: string) => fetch(`http://localhost:4000${path}`).then((r) => r.json());

export default function AssignmentPage() {
  const params = useParams<{ id: string }>();
  const { data } = useSWR(`/assignments/${params.id}`, api);
  const [idx, setIdx] = useState(0);

  if (!data) return <p>Loading…</p>;

  const lesson = data.lessons[idx];
  const percent = Math.round(((idx) / data.lessons.length) * 100);

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>{data.title}</h2>
        </div>
        <div className="progress" style={{ marginTop: 12 }}>
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="card" style={{ minHeight: 200 }}>
        <h3 style={{ marginTop: 0 }}>{lesson?.content?.title ?? `Lesson ${idx + 1}`}</h3>
        <p style={{ lineHeight: 1.6 }}>{lesson?.content?.body}</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
        <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>Back</button>
        {idx < data.lessons.length - 1 ? (
          <button onClick={async () => {
            await fetch(`http://localhost:4000/assignments/${params.id}/progress`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ currentLessonIndex: idx + 1 }),
            });
            setIdx((i) => Math.min(data.lessons.length - 1, i + 1));
          }}>Next</button>
        ) : (
          <form action={`/quiz/${data.quiz.id}`}>
            <button type="submit">Start Quiz</button>
          </form>
        )}
      </div>
    </div>
  );
}
