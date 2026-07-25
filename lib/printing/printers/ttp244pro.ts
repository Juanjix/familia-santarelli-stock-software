/** Perfil de la impresora TSC TTP-244 Pro (203 DPI = 8 dots/mm). */
export const TTP244PRO = {
  /** Nombre parcial para buscar en Windows Print Spooler */
  nameQuery: "TTP-244",

  // Dimensiones verificadas contra SELFTEST de la impresora (FEED al encender)
  // GAP:   0.15 inch = 3.81 mm  (valor real medido por la impresora)
  // SIZE:  0.37 inch = 9.40 mm  (label height real, no 10mm)
  // labelW: confirmado por spec del rollo EO0800101CR (080mm)
  labelW: 80,
  labelH: 9.4,
  gap:    5,

  // Coordenadas de impresión — en dots (203 DPI)
  // Zona izquierda: precio y grupo de precio
  priceX:    10,   // ~1.25 mm desde borde izq.
  priceY:     8,   // ~1 mm desde borde sup.
  groupY:    36,   // ~4.5 mm desde borde sup.
  font:      "2",  // Fuente TSC interna 12×20 dots

  // Zona derecha: código de barras CODE128
  barcodeX: 200,   // ~25 mm desde borde izq.
  barcodeY:   3,   // ~0.4 mm desde borde sup.
  barcodeH:  45,   // ~5.6 mm de altura de barras
  barcodeN:   2,   // módulo mínimo (narrow bar width)
} as const

export type TTP244ProProfile = typeof TTP244PRO
