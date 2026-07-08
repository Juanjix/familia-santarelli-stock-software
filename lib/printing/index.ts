import { getQZConnection } from "./qz-client"
import { buildLabelBatch, type LabelItem } from "./tspl"
import { TTP244PRO } from "./printers/ttp244pro"

export type { LabelItem }
export { isQZConnected } from "./qz-client"

export class PrintError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PrintError"
  }
}

/**
 * Imprime un lote de etiquetas en la TSC TTP-244 Pro vía QZ Tray.
 * Llama a esta función desde cualquier módulo — no necesitás saber nada de TSPL ni QZ.
 */
export async function printLabels(items: LabelItem[]): Promise<void> {
  if (items.length === 0) return

  const qz = await getQZConnection()

  const found = await qz.printers.find(TTP244PRO.nameQuery)
  const printerName: string = Array.isArray(found) ? found[0] : found
  if (!printerName) {
    throw new PrintError(
      `No se encontró la impresora "${TTP244PRO.nameQuery}" en Windows. ` +
      "Verificá que esté encendida y conectada."
    )
  }

  const config = qz.configs.create(printerName)
  const tspl   = buildLabelBatch(TTP244PRO, items)

  await qz.print(config, [{ type: "raw", format: "plain", data: tspl }])
}
