"use client";
import useSWR from "swr";
import { useParams } from "next/navigation";
import { useState } from "react";

const api = (path: string, init?: RequestInit) => fetch(`http://localhost:4000${path}`, init).then(r => r.json());

export default function AdminCourseDetail() {
  const params = useParams<{ id: string }>();
  const { data: course, mutate } = useSWR(`/admin/courses/${params.id}`, (p) => api(p));
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonBody, setLessonBody] = useState("");
  const [qBody, setQBody] = useState("");

  if (!course) return <p>Loading…</p>;

  return (
    <div>
      <h2>{course.title}</h2>
      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="chip">{course.status}</span>
        <button onClick={async () => { await api(`/admin/courses/${course.id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: course.status === 'DRAFT' ? 'REVIEW' : 'PUBLISHED' }) }); mutate(); }}>Advance Workflow</button>
      </div>

      <h3>Lessons</h3>
      <div className="card" style={{ marginBottom: 12, display: 'grid', gap: 8 }}>
        <input placeholder="Lesson title" value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} style={{ background: 'transparent', color: 'white', border: '1px solid #222', padding: 8, borderRadius: 8 }} />
        <textarea placeholder="Lesson body" value={lessonBody} onChange={(e) => setLessonBody(e.target.value)} rows={4} style={{ background: 'transparent', color: 'white', border: '1px solid #222', padding: 8, borderRadius: 8 }} />
        <button onClick={async () => { if (!lessonTitle) return; await api(`/admin/courses/${course.id}/lessons`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: lessonTitle, body: lessonBody }) }); setLessonTitle(""); setLessonBody(""); mutate(); }}>Add Lesson</button>
      </div>
      <ol>
        {course.lessons.map((l: any) => (
          <LessonEditor key={l.id} lesson={l} onSaved={mutate} />
        ))}
      </ol>

      <h3>Questions</h3>
      <div className="card" style={{ marginBottom: 12, display: 'grid', gap: 8 }}>
        <input placeholder="Question body" value={qBody} onChange={(e) => setQBody(e.target.value)} style={{ background: 'transparent', color: 'white', border: '1px solid #222', padding: 8, borderRadius: 8 }} />
        <button onClick={async () => { if (!qBody) return; await api(`/admin/courses/${course.id}/questions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: qBody, type: 'MCQ_SINGLE', answers: ['Option A','Option B','Option C','Option D'], correctKey: 0 }) }); setQBody(""); mutate(); }}>Add MCQ</button>
      </div>
      <ul style={{ display: 'grid', gap: 8 }}>
        {course.questions.map((q: any) => (
          <QuestionEditor key={q.id} question={q} onSaved={mutate} />
        ))}
      </ul>
    </div>
  );
}

function LessonEditor({ lesson, onSaved }: { lesson: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(lesson.content?.title ?? "");
  const [body, setBody] = useState(lesson.content?.body ?? "");
  const [media, setMedia] = useState<FileList | null>(null);

  const uploadMedia = async () => {
    if (!media) return [] as any[];
    // dev stub: convert files to object URLs; replace with S3 upload in prod
    const refs: any[] = [];
    for (const f of Array.from(media)) {
      const url = URL.createObjectURL(f);
      refs.push({ type: f.type.startsWith('video') ? 'video' : 'image', url, name: f.name });
    }
    return refs;
  };

  return (
    <li className="card" style={{ marginBottom: 8 }}>
      <div onClick={() => setOpen((o) => !o)} style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
        <strong>{title || lesson.content?.title || `Lesson`}</strong>
        <span>{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" style={{ background: 'transparent', color: 'white', border: '1px solid #222', padding: 8, borderRadius: 8 }} />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="Body" style={{ background: 'transparent', color: 'white', border: '1px solid #222', padding: 8, borderRadius: 8 }} />
          <input type="file" multiple accept="image/*,video/*" onChange={(e) => setMedia(e.target.files)} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(lesson.mediaRefs || []).map((m: any, i: number) => (
              <span key={i} className="chip">{m.name || m.url}</span>
            ))}
          </div>
          <button onClick={async () => {
            const mediaRefs = await uploadMedia();
            await fetch(`http://localhost:4000/admin/lessons/${lesson.id}`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title, body, mediaRefs, replaceMedia: false })
            });
            onSaved();
          }}>Save</button>
        </div>
      )}
    </li>
  );
}

function QuestionEditor({ question, onSaved }: { question: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(question.body ?? "");
  const [answers, setAnswers] = useState<string[]>(Array.isArray(question.answers) ? question.answers.slice(0,4) : ["","","",""]);
  const [correctKey, setCorrectKey] = useState<number>(typeof question.correctKey === 'number' ? question.correctKey : 0);

  return (
    <li className="card">
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
        <strong>{body || question.body}</strong>
        <span>{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Question body" style={{ background: 'transparent', color: 'white', border: '1px solid #222', padding: 8, borderRadius: 8 }} />
          <div style={{ display: 'grid', gap: 6 }}>
            {answers.map((a, i) => (
              <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="radio" name={`correct-${question.id}`} checked={correctKey === i} onChange={() => setCorrectKey(i)} />
                <input value={a} onChange={(e) => setAnswers(prev => { const next = prev.slice(); next[i] = e.target.value; return next; })} placeholder={`Option ${i+1}`} style={{ flex: 1, background: 'transparent', color: 'white', border: '1px solid #222', padding: 8, borderRadius: 8 }} />
              </div>
            ))}
          </div>
          <button onClick={async () => {
            await fetch(`http://localhost:4000/admin/questions/${question.id}`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ body, answers, correctKey, type: 'MCQ_SINGLE' })
            });
            onSaved();
          }}>Save</button>
        </div>
      )}
    </li>
  );
}
