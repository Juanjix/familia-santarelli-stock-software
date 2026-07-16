"use client"

import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useMemo,
  type ReactNode,
} from "react"
import { createBrowserClient } from "@supabase/ssr"
import type {
  Product,
  Employee,
  Warehouse,
  CartItem,
  CartPayment,
  PaymentMethod,
  POSCustomer,
  Sale,
  ConfirmSaleResult,
} from "@/lib/types"

// ── Supabase client ───────────────────────────────────────────────────────────

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── Context shape ─────────────────────────────────────────────────────────────

interface POSContextValue {
  // Carrito
  items: CartItem[]
  payments: CartPayment[]
  discountAmount: number
  customerId: string | null
  notes: string

  // Computed
  subtotal: number
  total: number
  paymentTotal: number
  change: number           // vuelto en efectivo
  isCartEmpty: boolean
  isPaymentComplete: boolean

  // Operaciones de carrito
  addOrIncrementProduct: (product: Product, price?: number) => void
  removeItem: (productId: string) => void
  updateItemQty: (productId: string, qty: number) => void
  updateItemPrice: (productId: string, price: number) => void
  updateItemDiscount: (productId: string, pct: number) => void
  setDiscountAmount: (amount: number) => void
  setCustomerId: (id: string | null) => void
  setNotes: (notes: string) => void

  // Pagos
  setPayment: (method: PaymentMethod, amount: number, reference?: string) => void
  removePayment: (method: PaymentMethod) => void

  // Acciones
  confirmSale: (sellerId: string, warehouseId: string) => Promise<ConfirmSaleResult>
  clearCart: () => void

  // Datos de referencia
  fetchEmployees: () => Promise<Employee[]>
  fetchWarehouses: () => Promise<Warehouse[]>
  fetchSales: (filters?: SaleFilters) => Promise<Sale[]>
  voidSale: (saleId: string, voidedById: string, reason: string) => Promise<{ ok: boolean; error?: string }>
  findOrCreateCustomer: (firstName: string, lastName: string, phone?: string) => Promise<POSCustomer | null>
  searchCustomers: (query: string) => Promise<POSCustomer[]>
}

export interface SaleFilters {
  status?: string
  sellerId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
  page?: number
  pageSize?: number
}

const POSContext = createContext<POSContextValue | null>(null)

export function usePOS() {
  const ctx = useContext(POSContext)
  if (!ctx) throw new Error("usePOS must be used inside POSProvider")
  return ctx
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcLineTotal(qty: number, unitPrice: number, discountPct: number): number {
  return Math.round(qty * unitPrice * (1 - discountPct / 100) * 100) / 100
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function POSProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [payments, setPayments] = useState<CartPayment[]>([])
  const [discountAmount, setDiscountAmountState] = useState(0)
  const [customerId, setCustomerIdState] = useState<string | null>(null)
  const [notes, setNotesState] = useState("")

  // ── Computed ───────────────────────────────────────────────────────────────

  const subtotal = useMemo(
    () => items.reduce((acc, it) => acc + calcLineTotal(it.quantity, it.unit_price, it.discount_pct), 0),
    [items]
  )

  const total = useMemo(
    () => Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100),
    [subtotal, discountAmount]
  )

  const paymentTotal = useMemo(
    () => payments.reduce((acc, p) => acc + p.amount, 0),
    [payments]
  )

  const cashPayment = payments.find(p => p.method === "cash")
  const change = cashPayment ? Math.max(0, Math.round((paymentTotal - total) * 100) / 100) : 0
  const isCartEmpty = items.length === 0
  const isPaymentComplete = !isCartEmpty && paymentTotal >= total

  // ── Carrito ────────────────────────────────────────────────────────────────

  const addOrIncrementProduct = useCallback((product: Product, price?: number) => {
    const unitPrice = price ?? product.sell_price ?? 0
    setItems(prev => {
      const existing = prev.find(i => i.product_id === product.id)
      if (existing) {
        return prev.map(i =>
          i.product_id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      }
      return [...prev, { product_id: product.id, product, quantity: 1, unit_price: unitPrice, discount_pct: 0 }]
    })
  }, [])

  const removeItem = useCallback((productId: string) => {
    setItems(prev => prev.filter(i => i.product_id !== productId))
  }, [])

  const updateItemQty = useCallback((productId: string, qty: number) => {
    if (qty < 1) return
    setItems(prev => prev.map(i => i.product_id === productId ? { ...i, quantity: qty } : i))
  }, [])

  const updateItemPrice = useCallback((productId: string, price: number) => {
    setItems(prev => prev.map(i => i.product_id === productId ? { ...i, unit_price: Math.max(0, price) } : i))
  }, [])

  const updateItemDiscount = useCallback((productId: string, pct: number) => {
    const clamped = Math.min(100, Math.max(0, pct))
    setItems(prev => prev.map(i => i.product_id === productId ? { ...i, discount_pct: clamped } : i))
  }, [])

  const setDiscountAmount = useCallback((amount: number) => {
    setDiscountAmountState(Math.max(0, amount))
  }, [])

  const setCustomerId = useCallback((id: string | null) => {
    setCustomerIdState(id)
  }, [])

  const setNotes = useCallback((n: string) => {
    setNotesState(n)
  }, [])

  // ── Pagos ──────────────────────────────────────────────────────────────────

  const setPayment = useCallback((method: PaymentMethod, amount: number, reference = "") => {
    setPayments(prev => {
      const existing = prev.find(p => p.method === method)
      if (amount <= 0) return prev.filter(p => p.method !== method)
      if (existing) return prev.map(p => p.method === method ? { method, amount, reference } : p)
      return [...prev, { method, amount, reference }]
    })
  }, [])

  const removePayment = useCallback((method: PaymentMethod) => {
    setPayments(prev => prev.filter(p => p.method !== method))
  }, [])

  // ── Confirmación de venta ──────────────────────────────────────────────────

  // Ref-based lock: prevents concurrent confirmSale calls even if state batching
  // delays the re-render that would disable the button.
  const confirmingRef = useRef(false)

  const confirmSale = useCallback(async (
    sellerId: string,
    warehouseId: string,
  ): Promise<ConfirmSaleResult> => {
    if (confirmingRef.current) {
      return { ok: false, error_code: "ALREADY_CONFIRMING", error_detail: "Ya hay una confirmación en curso." }
    }
    confirmingRef.current = true

    try {
    const supabase = getSupabase()

    // Client-side $0 guard — avoids creating a draft that the RPC will reject anyway.
    const zeroPriceItem = items.find(it => it.unit_price === 0)
    if (zeroPriceItem) {
      return {
        ok: false,
        error_code: "ZERO_PRICE",
        error_detail: `"${zeroPriceItem.product.name}" tiene precio $0. Corregilo antes de confirmar.`,
      }
    }

    // 1. Crear la cabecera de la venta en estado draft
    const { data: sale, error: saleErr } = await supabase
      .from("sales")
      .insert({
        status: "draft",
        warehouse_id: warehouseId,
        seller_id: sellerId,
        customer_id: customerId,
        subtotal_amount: subtotal,
        discount_amount: discountAmount,
        total_amount: total,
        notes: notes || null,
      })
      .select("id, sale_number")
      .single()

    if (saleErr || !sale) {
      return { ok: false, error_code: "INSERT_FAILED", error_detail: saleErr?.message ?? "No se pudo crear la venta." }
    }

    // 2. Insertar ítems con snapshot del producto
    const saleItems = items.map(it => ({
      sale_id: sale.id,
      product_id: it.product_id,
      quantity: it.quantity,
      unit_price: it.unit_price,
      discount_pct: it.discount_pct,
      line_total: calcLineTotal(it.quantity, it.unit_price, it.discount_pct),
      product_snapshot: {
        name: it.product.name,
        sku: it.product.sku,
        barcode: it.product.barcode ?? null,
      },
    }))

    const { error: itemsErr } = await supabase.from("sale_items").insert(saleItems)
    if (itemsErr) {
      await supabase.from("sales").delete().eq("id", sale.id)
      return { ok: false, error_code: "ITEMS_FAILED", error_detail: itemsErr.message }
    }

    // 3. Insertar pagos
    const salePayments = payments.map(p => ({
      sale_id: sale.id,
      method: p.method,
      amount: p.amount,
      reference: p.reference || null,
    }))

    const { error: paymentsErr } = await supabase.from("sale_payments").insert(salePayments)
    if (paymentsErr) {
      await supabase.from("sales").delete().eq("id", sale.id)
      return { ok: false, error_code: "PAYMENTS_FAILED", error_detail: paymentsErr.message }
    }

    // 4. Llamar función PG que confirma atómicamente (verifica stock, crea movimientos, ticket, comisión)
    const { data: result, error: rpcErr } = await supabase
      .rpc("confirm_sale", { p_sale_id: sale.id })

    if (rpcErr) {
      await supabase.from("sales").delete().eq("id", sale.id)
      return { ok: false, error_code: "RPC_ERROR", error_detail: rpcErr.message }
    }

    if (!result.ok) {
      await supabase.from("sales").delete().eq("id", sale.id)
      return result as ConfirmSaleResult
    }

    return {
      ok: true,
      sale_number: sale.sale_number,
      ticket_number: result.ticket_number,
    }
    } finally {
      confirmingRef.current = false
    }
  }, [items, payments, subtotal, discountAmount, total, notes, customerId])

  const clearCart = useCallback(() => {
    setItems([])
    setPayments([])
    setDiscountAmountState(0)
    setCustomerIdState(null)
    setNotesState("")
  }, [])

  // ── Datos de referencia ────────────────────────────────────────────────────

  const fetchEmployees = useCallback(async (): Promise<Employee[]> => {
    const supabase = getSupabase()
    const { data } = await supabase
      .from("employees")
      .select("*")
      .eq("is_active", true)
      .order("name")
    return (data ?? []) as Employee[]
  }, [])

  const fetchWarehouses = useCallback(async (): Promise<Warehouse[]> => {
    const supabase = getSupabase()
    const { data } = await supabase
      .from("warehouses")
      .select("*")
      .order("name")
    return (data ?? []) as Warehouse[]
  }, [])

  const fetchSales = useCallback(async (filters: SaleFilters = {}): Promise<Sale[]> => {
    const supabase = getSupabase()
    const { page = 1, pageSize = 50, status, sellerId, dateFrom, dateTo } = filters

    let query = supabase
      .from("sales")
      .select(`
        *,
        seller:employees!sales_seller_id_fkey(id, name),
        customer:customers(id, first_name, last_name, phone),
        items:sale_items(*),
        payments:sale_payments(*),
        exchange_ticket:exchange_tickets(*)
      `)
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)

    if (status) query = query.eq("status", status)
    if (sellerId) query = query.eq("seller_id", sellerId)
    if (dateFrom) query = query.gte("confirmed_at", dateFrom)
    if (dateTo) query = query.lte("confirmed_at", dateTo)

    const { data } = await query
    return (data ?? []) as Sale[]
  }, [])

  const voidSale = useCallback(async (
    saleId: string,
    voidedById: string,
    reason: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    const supabase = getSupabase()
    const { data, error } = await supabase.rpc("void_sale", {
      p_sale_id: saleId,
      p_voided_by: voidedById,
      p_reason: reason,
    })
    if (error) return { ok: false, error: error.message }
    if (!data?.ok) return { ok: false, error: data?.error_detail ?? "Error desconocido." }
    return { ok: true }
  }, [])

  const findOrCreateCustomer = useCallback(async (
    firstName: string,
    lastName: string,
    phone?: string,
  ): Promise<POSCustomer | null> => {
    const supabase = getSupabase()

    // Buscar por teléfono primero
    if (phone?.trim()) {
      const { data: existing } = await supabase
        .from("customers")
        .select("*")
        .eq("phone", phone.trim())
        .maybeSingle()
      if (existing) return existing as POSCustomer
    }

    const { data, error } = await supabase
      .from("customers")
      .insert({ first_name: firstName.trim(), last_name: lastName.trim(), phone: phone?.trim() || null })
      .select("*")
      .single()

    if (error) { console.error("findOrCreateCustomer:", error); return null }
    return data as POSCustomer
  }, [])

  const searchCustomers = useCallback(async (query: string): Promise<POSCustomer[]> => {
    if (!query.trim()) return []
    const supabase = getSupabase()
    const { data } = await supabase
      .from("customers")
      .select("*")
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,phone.ilike.%${query}%`)
      .limit(10)
    return (data ?? []) as POSCustomer[]
  }, [])

  // ── Value ──────────────────────────────────────────────────────────────────

  const value: POSContextValue = {
    items,
    payments,
    discountAmount,
    customerId,
    notes,
    subtotal,
    total,
    paymentTotal,
    change,
    isCartEmpty,
    isPaymentComplete,
    addOrIncrementProduct,
    removeItem,
    updateItemQty,
    updateItemPrice,
    updateItemDiscount,
    setDiscountAmount,
    setCustomerId,
    setNotes,
    setPayment,
    removePayment,
    confirmSale,
    clearCart,
    fetchEmployees,
    fetchWarehouses,
    fetchSales,
    voidSale,
    findOrCreateCustomer,
    searchCustomers,
  }

  return <POSContext.Provider value={value}>{children}</POSContext.Provider>
}
