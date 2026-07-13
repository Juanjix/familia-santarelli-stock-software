export type ProductCondition = "very_good" | "good" | "regular"

export const CONDITION_NOTES_REQUIRED_MSG =
  "Debés describir el estado del producto cuando se encuentra en condición Regular."

/**
 * Returns an error message string if validation fails, null if valid.
 * Centralised so UI, context gateway, and any future server action share the same rule.
 */
export function validateConditionNotes(
  condition: ProductCondition,
  notes: string | null | undefined,
): string | null {
  if (condition === "regular" && !notes?.trim()) {
    return CONDITION_NOTES_REQUIRED_MSG
  }
  return null
}
