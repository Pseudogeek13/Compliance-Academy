"use client";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="card" style={{ maxWidth: 420, margin: '40px auto' }}>
      <h2 style={{ marginTop: 0 }}>Bumba Compliance Academy</h2>
      <p style={{ color: '#bcbcbc' }}>Sign in with your work email</p>
      <input
        placeholder="your.name@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: '100%', background: 'transparent', color: 'white', border: '1px solid #222', padding: 10, borderRadius: 8 }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <button disabled={!email || busy} onClick={async () => {
          setBusy(true);
          await fetch('http://localhost:4000/auth/dev-login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            credentials: 'include', body: JSON.stringify({ email })
          });
          window.location.href = '/';
        }}>Sign In</button>
      </div>
    </div>
  );
}
