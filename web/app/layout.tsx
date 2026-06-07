import './globals.css'

export const metadata = {
  title: 'Mini Cloud',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css" />
      </head>
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }} suppressHydrationWarning>{children}</body>
    </html>
  )
}
