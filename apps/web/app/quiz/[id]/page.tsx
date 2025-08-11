"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Item = { id: string; question: { id: string; body: string; type: string; answers: string[]; }; answerOrder?: number[] };

export default function QuizPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [shortText, setShortText] = useState<string>("");
  const current = items[index];

  useEffect(() => {
    fetch("http://localhost:4000/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: params.id }),
    })
      .then((r) => r.json())
      .then((data) => {
        setAttemptId(data.id);
        setItems(data.items);
      });
  }, [params.id]);

  useEffect(() => {
    setSelected(null);
  }, [index]);

  const answers = useMemo(() => {
    if (!current) return [] as string[];
    const original = current.question.answers;
    const order = current.answerOrder || original.map((_, i) => i);
    return order.map((i) => original[i]);
  }, [current]);

  if (!current) return <p>Preparing attempt…</p>;

  const onNext = async () => {
    if (attemptId) {
      if (current.question.type === "SHORT_ANSWER") {
        await fetch(`http://localhost:4000/attempts/${attemptId}/answers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: current.id, selectedText: shortText }),
        });
      } else if (selected != null) {
        await fetch(`http://localhost:4000/attempts/${attemptId}/answers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: current.id, selectedIndex: selected }),
        });
      }
    }
    if (index < items.length - 1) setIndex((i) => i + 1);
  };

  const onSubmit = async () => {
    if (attemptId) {
      if (current.question.type === "SHORT_ANSWER") {
        await fetch(`http://localhost:4000/attempts/${attemptId}/answers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: current.id, selectedText: shortText }),
        });
      } else if (selected != null) {
        await fetch(`http://localhost:4000/attempts/${attemptId}/answers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: current.id, selectedIndex: selected }),
        });
      }
    }
    const r = await fetch(`http://localhost:4000/attempts/${attemptId}/submit`, { method: "POST" });
    const result = await r.json();
    alert(result.passed ? `Passed (${result.score}%)` : `Failed (${result.score}%)`);
    router.push("/");
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <strong>Question {index + 1} / {items.length}</strong>
        <div className="progress" style={{ width: 200 }}><span style={{ width: `${Math.round(((index)/items.length)*100)}%` }} /></div>
      </div>
      <p style={{ marginTop: 12 }}>{current.question.body}</p>
      {current.question.type === "SHORT_ANSWER" ? (
        <div className="card">
          <input
            placeholder="Type your answer"
            value={shortText}
            onChange={(e) => setShortText(e.target.value)}
            style={{ width: '100%', background: 'transparent', color: 'white', border: '1px solid #222', padding: 10, borderRadius: 8 }}
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {answers.map((a, i) => (
            <label key={i} className="card" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="radio" name="ans" onChange={() => setSelected(i)} checked={selected === i} /> {a}
            </label>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        {index < items.length - 1 ? (
          <button onClick={onNext} disabled={current.question.type !== 'SHORT_ANSWER' && selected == null}>Next</button>
        ) : (
          <button onClick={onSubmit} disabled={current.question.type !== 'SHORT_ANSWER' && selected == null}>Submit</button>
        )}
      </div>
    </div>
  );
}
