/**
 * Singleton que gestiona la carga del cliente QZ Tray y la conexión WebSocket.
 *
 * - En HTTP  usa ws://localhost:8182  (desarrollo local)
 * - En HTTPS usa wss://localhost:8183 (producción en Vercel)
 *
 * Para wss:// el usuario debe instalar el certificado raíz de QZ Tray una sola vez:
 *   C:\Program Files\QZ Tray\root-ca.crt → Entidades de certificación raíz de confianza
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QZModule = any

let _qz: QZModule | null = null
let _loadPromise: Promise<QZModule> | null = null

async function loadQZModule(): Promise<QZModule> {
  if (_qz) return _qz
  if (_loadPromise) return _loadPromise

  _loadPromise = (async () => {
    try {
      // Intenta cargar vía npm (disponible si se instaló qz-tray)
      const mod = await import("qz-tray")
      _qz = mod.default ?? mod
      return _qz
    } catch {
      // Fallback: script estático en public/qz-tray.js
      return new Promise<QZModule>((resolve, reject) => {
        if ((window as Window & { qz?: QZModule }).qz) {
          _qz = (window as Window & { qz?: QZModule }).qz
          resolve(_qz)
          return
        }
        const existing = document.querySelector('script[data-qz-tray]')
        if (existing) {
          existing.addEventListener("load", () => {
            _qz = (window as Window & { qz?: QZModule }).qz
            resolve(_qz)
          })
          return
        }
        const script = document.createElement("script")
        script.setAttribute("data-qz-tray", "1")
        script.src = "/qz-tray.js"
        script.onload = () => {
          _qz = (window as Window & { qz?: QZModule }).qz
          resolve(_qz)
        }
        script.onerror = () => reject(new Error(
          "No se pudo cargar QZ Tray. Instalalo desde qz.io y ejecutalo en esta PC."
        ))
        document.head.appendChild(script)
      })
    }
  })()

  return _loadPromise
}

/**
 * Devuelve el módulo QZ Tray ya conectado al WebSocket local.
 * Reutiliza la conexión si ya está activa.
 */
export async function getQZConnection(): Promise<QZModule> {
  if (typeof window === "undefined") {
    throw new Error("QZ Tray solo está disponible en el browser")
  }

  const qz = await loadQZModule()

  if (!qz.websocket.isActive()) {
    // Sin firma de certificado (modo unsigned — suficiente para uso interno)
    qz.security.setCertificatePromise((resolve: (v: string) => void) => resolve(""))
    qz.security.setSignaturePromise(
      () => (resolve: (v: string) => void) => resolve("")
    )

    const secure = window.location.protocol === "https:"
    await qz.websocket.connect({
      host: ["localhost"],
      port: { secure: [8183], insecure: [8182] },
      usingSecure: secure,
    })
  }

  return qz
}

export async function disconnectQZ(): Promise<void> {
  if (_qz?.websocket?.isActive()) {
    await _qz.websocket.disconnect()
  }
}

/** Estado de la conexión, útil para indicadores visuales. */
export function isQZConnected(): boolean {
  return !!_qz?.websocket?.isActive?.()
}
