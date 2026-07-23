import type { TTP244ProProfile } from "./printers/ttp244pro"

export interface LabelItem {
  barcode: string
  price?:  string
  group?:  string
  quantity: number
}

/**
 * Genera el bloque de comandos TSPL para un lote de etiquetas.
 * Puro: no tiene efectos secundarios ni dependencias de browser.
 */
export function buildLabelBatch(
  profile: TTP244ProProfile,
  items: LabelItem[]
): string {
  const cmds: string[] = [
    `SIZE ${profile.labelW} mm, ${profile.labelH} mm`,
    `GAP ${profile.gap} mm, 0 mm`,
    `DIRECTION 0`,
    `REFERENCE 0, 0`,
    `OFFSET 0 mm`,
    // CALIBRATE: feeds the roll until the printer auto-detects the gap sensor,
    // establishing an accurate reference position. Fixes label drift on 2nd+ labels.
    `CALIBRATE`,
  ]

  for (const { barcode, price, group, quantity } of items) {
    cmds.push("CLS")
    if (price)   cmds.push(`TEXT ${profile.priceX}, ${profile.priceY}, "${profile.font}", 0, 1, 1, "${price}"`)
    if (group)   cmds.push(`TEXT ${profile.priceX}, ${profile.groupY}, "${profile.font}", 0, 1, 1, "${group}"`)
    if (barcode) cmds.push(`BARCODE ${profile.barcodeX}, ${profile.barcodeY}, "128", ${profile.barcodeH}, 1, 0, ${profile.barcodeN}, ${profile.barcodeN}, "${barcode}"`)
    cmds.push(`PRINT ${quantity}, 1`)
  }

  return cmds.join("\r\n") + "\r\n"
}
