import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { InventoryProvider } from '@/lib/inventory-context'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Familia Santarelli - Sistema de Stock',
  description: 'Sistema de gestión de inventario para joyería',
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
          <InventoryProvider>
            <DashboardLayout>
              {children}
            </DashboardLayout>
          </InventoryProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
