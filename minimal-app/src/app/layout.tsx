export const metadata = { title: 'Boundly', description: 'H-1B Wage Estimator' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: '#fff', color: '#0f172a', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif' }}>
        <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 20px 56px' }}>
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontWeight: 600 }}>Boundly</div>
            <nav>
              <a href="/" style={{ color: '#0f172a', textDecoration: 'none', marginRight: 16 }}>Home</a>
              <a href="/admin" style={{ color: '#0f172a', textDecoration: 'none' }}>Admin</a>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  )
}
