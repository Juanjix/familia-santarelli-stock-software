/**
 * movement-types.ts — Fuente única de verdad para todos los tipos de movimiento.
 *
 * CONTRATO DEL SISTEMA
 * ────────────────────
 * Todo movimiento de stock debe estar definido aquí antes de poder ser generado
 * por cualquier módulo. Esta definición controla:
 *   - Qué se muestra en Movimientos, Dashboard, Historial de Producto y futuros reportes.
 *   - Qué valores son válidos en `movements.type` (ver CHECK constraint en 029_pos_module.sql).
 *
 * Para agregar un nuevo tipo:
 *   1. Agregarlo a MovementType.
 *   2. Completar su entrada en MOVEMENT_CONFIG.
 *   3. Actualizar el CHECK constraint en la base con una nueva migración.
 *   4. Implementar la lógica SQL/RPC que lo genera.
 */

// ── Tipos base ────────────────────────────────────────────────────────────────

export type MovementType =
  | "entry"         // Entrada de stock
  | "exit"          // Salida de stock
  | "transfer"      // Transferencia entre depósitos
  | "adjustment"    // Ajuste manual de inventario
  | "sale"          // Descuento por venta confirmada en POS
  | "sale_reversal" // Reposición por anulación de venta en POS

// ── Configuración por tipo ────────────────────────────────────────────────────

export interface MovementConfig {
  /** Etiqueta visible al usuario */
  label: string
  /** Signo del efecto sobre el stock */
  sign: "+" | "-" | "±"
  /** Variante del Badge de shadcn/ui */
  badgeVariant: "default" | "destructive" | "secondary" | "outline"
  /** Nombre del ícono de Lucide React */
  iconName:
    | "ArrowDownCircle"
    | "ArrowUpCircle"
    | "ArrowLeftRight"
    | "Settings2"
    | "ShoppingCart"
    | "RotateCcw"
  /** Clase de color Tailwind para el ícono */
  colorClass: string
  /**
   * Quién genera este tipo de movimiento.
   * Referencia para desarrolladores — no se muestra en la UI.
   */
  generatedBy: string
  /**
   * Descripción del escenario de uso.
   * Referencia para desarrolladores — no se muestra en la UI.
   */
  description: string
}

export const MOVEMENT_CONFIG: Record<MovementType, MovementConfig> = {
  entry: {
    label: "Entrada",
    sign: "+",
    badgeVariant: "default",
    iconName: "ArrowDownCircle",
    colorClass: "text-green-500",
    generatedBy: "Inventario (ajuste de stock / ingreso de mercadería)",
    description:
      "Incrementa el stock de un producto en un depósito. Usado al recibir mercadería o corregir stock al alza.",
  },
  exit: {
    label: "Salida",
    sign: "-",
    badgeVariant: "destructive",
    iconName: "ArrowUpCircle",
    colorClass: "text-red-500",
    generatedBy: "Inventario (ajuste de stock / retiro manual)",
    description:
      "Reduce el stock de un producto en un depósito sin generar una venta. Usado para retiros, pérdidas o mermas.",
  },
  transfer: {
    label: "Transferencia",
    sign: "±",
    badgeVariant: "secondary",
    iconName: "ArrowLeftRight",
    colorClass: "text-blue-500",
    generatedBy: "Inventario (transferencia entre depósitos)",
    description:
      "Mueve stock de un depósito a otro. El stock total no cambia, solo su ubicación.",
  },
  adjustment: {
    label: "Ajuste",
    sign: "±",
    badgeVariant: "outline",
    iconName: "Settings2",
    colorClass: "text-yellow-500",
    generatedBy: "Inventario (ajuste manual de inventario)",
    description:
      "Corrección directa del stock que puede ser positiva o negativa. Usado para diferencias de inventario.",
  },
  sale: {
    label: "Venta",
    sign: "-",
    badgeVariant: "destructive",
    iconName: "ShoppingCart",
    colorClass: "text-red-500",
    generatedBy: "POS (confirm_sale)",
    description:
      "Descuenta stock cuando se confirma una venta en el Punto de Venta. Generado por la función SQL confirm_sale().",
  },
  sale_reversal: {
    label: "Venta anulada",
    sign: "+",
    badgeVariant: "secondary",
    iconName: "RotateCcw",
    colorClass: "text-emerald-500",
    generatedBy: "POS (void_sale)",
    description:
      "Repone el stock cuando se anula una venta en el Punto de Venta. Generado por la función SQL void_sale().",
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Devuelve la config de un tipo, o null si el valor no es un tipo conocido. */
export function getMovementConfig(type: string): MovementConfig | null {
  return MOVEMENT_CONFIG[type as MovementType] ?? null
}

/** Lista ordenada de todos los tipos para filtros y selects. */
export const MOVEMENT_TYPE_OPTIONS: { value: MovementType; label: string }[] = [
  { value: "entry",         label: "Entrada" },
  { value: "exit",          label: "Salida" },
  { value: "transfer",      label: "Transferencia" },
  { value: "adjustment",    label: "Ajuste" },
  { value: "sale",          label: "Venta" },
  { value: "sale_reversal", label: "Venta anulada" },
]
