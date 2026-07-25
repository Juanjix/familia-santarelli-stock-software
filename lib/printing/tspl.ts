import type { TTP244ProProfile } from "./printers/ttp244pro"

export interface LabelItem {
  barcode: string
  price?:  string
  group?:  string
  quantity: number
}

/**
 * Genera el bloque de comandos TSPL para un lote de etiquetas.
 *
 * Diseño deliberado:
 * - SIZE y GAP se envían para que coincidan con la NVRAM de la impresora
 *   (valores verificados con SELFTEST: 9.4mm + 3.81mm).
 * - NO se envía CALIBRATE: el sensor de gap de la TTP-244 Pro está activo
 *   en cada avance y posiciona automáticamente. CALIBRATE en cada job
 *   sobrecompensa cuando la impresora ya está bien posicionada (Job 2+).
 * - Cada etiqueta usa PRINT 1, 1 para que el sensor re-valide la posición
 *   antes de cada impresión individual.
 *
 * Calibración inicial: presionar FEED al encender la impresora una vez.
 * Ese valor queda guardado en NVRAM y no requiere recalibración por software.
 */
export function buildLabelBatch(
  profile: TTP244ProProfile,
  items: LabelItem[]
): string {
  const cmds: string[] = [
    `SIZE ${profile.labelW} mm, ${profile.labelH} mm`,
    `GAP ${profile.gap} mm, 0 mm`,
    `DIRECTION 0`,
    `OFFSET 0 mm`,
    `SET TEAR OFF`,
  ]

  for (const { barcode, price, group, quantity } of items) {
    for (let i = 0; i < quantity; i++) {
      cmds.push("CLS")
      if (price)   cmds.push(`TEXT ${profile.priceX}, ${profile.priceY}, "${profile.font}", 0, 1, 1, "${price}"`)
      if (group)   cmds.push(`TEXT ${profile.priceX}, ${profile.groupY}, "${profile.font}", 0, 1, 1, "${group}"`)
      if (barcode) cmds.push(`BARCODE ${profile.barcodeX}, ${profile.barcodeY}, "128", ${profile.barcodeH}, 1, 0, ${profile.barcodeN}, ${profile.barcodeN}, "${barcode}"`)
      cmds.push(`PRINT 1, 1`)
      cmds.push(`BACKFEED 20`)
    }
  }

  return cmds.join("\r\n") + "\r\n"
}
