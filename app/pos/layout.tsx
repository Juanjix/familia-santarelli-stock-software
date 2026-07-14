import { POSProvider } from "@/lib/pos-context"

export const metadata = { title: "Punto de Venta" }

export default function POSLayout({ children }: { children: React.ReactNode }) {
  return <POSProvider>{children}</POSProvider>
}
