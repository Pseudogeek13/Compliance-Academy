import "./globals.css";

export const metadata = {
  title: "Compliance Academy",
  description: "In-house Compliance Academy",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, Arial, sans-serif', margin: 0 }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 10, background: '#000', borderBottom: '1px solid #1a1a1a' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: 999, background: 'linear-gradient(135deg, #28E7C5, #6843E1)' }} />
              <strong>Compliance Academy</strong>
            </div>
            <nav style={{ display: 'flex', gap: 16 }}>
              <a href="/">Home</a>
            </nav>
          </div>
        </header>
        <main style={{ padding: 16 }}>
          <div style={{ maxWidth: 1000, margin: '0 auto' }}>{children}</div>
        </main>
      </body>
    </html>
  );
}
