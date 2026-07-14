import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider } from '@/lib/auth-context'
import { AuthNavigator } from '@/components/auth/auth-navigator'
import { AppShell } from '@/components/dashboard/app-shell'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: 'Santarelli — Sistema de Stock',
    template: '%s | Santarelli',
  },
  description: 'Sistema de gestión de inventario para Familia Santarelli.',
  applicationName: 'Santarelli Stock',
  authors: [{ name: 'Familia Santarelli' }],
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
      { url: '/icon.png',    sizes: '512x512', type: 'image/png' },
    ],
    apple: { url: '/apple-icon.png', sizes: '180x180' },
  },
  openGraph: {
    type: 'website',
    siteName: 'Santarelli',
    title: 'Santarelli — Sistema de Stock',
    description: 'Sistema de gestión de inventario para Familia Santarelli.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Santarelli — Sistema de Stock',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Santarelli — Sistema de Stock',
    description: 'Sistema de gestión de inventario para Familia Santarelli.',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider>
            <AuthNavigator>
              <AppShell>
                {children}
              </AppShell>
            </AuthNavigator>
          </AuthProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
