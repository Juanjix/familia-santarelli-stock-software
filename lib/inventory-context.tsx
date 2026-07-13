"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import type { Product, Warehouse, Movement, StockByWarehouse, Coupon, Supplier, Category, Brand, CategoryAttribute, Customer, Jeweler, WorkerType, Employee, EnvelopeSubtype, Envelope, EnvelopeStatus, EnvelopeStatusLog, EnvelopeEvent, QuoteStatus, StockTransfer, StockTransferItem, StockTransferEvent } from "./types"
import { validateConditionNotes } from "@/lib/schemas/envelope"
import { generateBarcode } from "@/lib/barcode"

// Helper to normalize product for UI
function normalizeProduct(p: Product & { suppliers?: Supplier | null }): Product {
  return {
    ...p,
    stockStatus: p.total_stock === 0 ? "out_of_stock" : p.total_stock < (p.min_stock || 5) ? "low_stock" : "in_stock",
    price: p.sell_price,
    supplier: p.suppliers || undefined,
    supplierName: p.suppliers?.name || undefined,
  }
}

// Helper to normalize warehouse for UI
function normalizeWarehouse(w: Warehouse): Warehouse {
  return {
    ...w,
    isActive: w.is_active,
    stockCount: w.stock_count,
    totalValue: w.total_value,
  }
}

// Helper to normalize movement for UI
function normalizeMovement(m: Movement & { products?: Product; warehouses?: Warehouse; to_warehouses?: Warehouse }): Movement {
  return {
    ...m,
    productId: m.product_id,
    productName: m.products?.name || "",
    fromWarehouse: m.warehouses?.name,
    toWarehouse: m.to_warehouses?.name,
    date: m.created_at,
    user: m.user_name,
    notes: m.reason || undefined,
  }
}

// Helper to normalize coupon for UI
function normalizeCoupon(c: Coupon & { original_products?: Product }): Coupon {
  const now = new Date()
  const expiresAt = c.expires_at ? new Date(c.expires_at) : null
  let status: "active" | "used" | "expired" = "active"
  if (c.is_used) status = "used"
  else if (expiresAt && expiresAt < now) status = "expired"
  
  return {
    ...c,
    productId: c.original_product_id || undefined,
    productName: c.original_products?.name || "",
    value: c.amount,
    status,
    createdAt: c.created_at,
    usedAt: c.used_at || undefined,
    expiresAt: c.expires_at || undefined,
  }
}

interface InventoryContextType {
  products: Product[]
  warehouses: Warehouse[]
  movements: Movement[]
  coupons: Coupon[]
  suppliers: Supplier[]
  categories: Category[]
  brands: Brand[]
  categoryAttributes: CategoryAttribute[]
  productStock: Map<string, StockByWarehouse[]>
  loading: boolean
  error: string | null
  refreshData: () => Promise<void>
  addProduct: (product: Partial<Product>) => Promise<Product | null>
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
  toggleProductStatus: (id: string) => Promise<void>
  adjustStock: (productId: string, warehouseId: string, quantity: number, type: "in" | "out" | "adjustment", notes?: string) => Promise<void>
  transferStock: (productId: string, fromWarehouseId: string, toWarehouseId: string, quantity: number, notes?: string) => Promise<boolean>
  getStockByWarehouse: (productId: string) => StockByWarehouse[]
  getProductById: (id: string) => Product | undefined
  addWarehouse: (warehouse: Partial<Warehouse>) => Promise<void>
  updateWarehouse: (id: string, updates: Partial<Warehouse>) => Promise<void>
  deleteWarehouse: (id: string) => Promise<void>
  addSupplier: (supplier: Partial<Supplier>) => Promise<Supplier | null>
  updateSupplier: (id: string, updates: Partial<Supplier>) => Promise<void>
  deleteSupplier: (id: string) => Promise<void>
  addCategory: (category: Partial<Category>) => Promise<Category | null>
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  addBrand: (brand: Partial<Brand>) => Promise<Brand | null>
  updateBrand: (id: string, updates: Partial<Brand>) => Promise<void>
  deleteBrand: (id: string) => Promise<void>
  addCategoryAttribute: (attr: Partial<CategoryAttribute>) => Promise<CategoryAttribute | null>
  updateCategoryAttribute: (id: string, updates: Partial<CategoryAttribute>) => Promise<void>
  deleteCategoryAttribute: (id: string) => Promise<void>
  addCoupon: (input: {
    productId: string
    warehouseId: string
    amount: number
    customerName: string
    customerPhone: string
    expiresAt?: string | null
    notes?: string | null
  }) => Promise<{ success: boolean; error?: string; coupon?: Coupon }>
  useCoupon: (id: string) => Promise<void>
  // ── Sobres ────────────────────────────────────────────────
  customers: Customer[]
  jewelers: Jeweler[]
  employees: Employee[]
  envelopeSubtypes: EnvelopeSubtype[]
  addCustomer: (data: { first_name: string; last_name: string; dni: string; phone?: string | null; address?: string | null }) => Promise<Customer | null>
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>
  addJeweler: (name: string, workerType?: WorkerType) => Promise<Jeweler | null>
  updateJeweler: (id: string, updates: Partial<Jeweler>) => Promise<void>
  deleteJeweler: (id: string) => Promise<void>
  addEmployee: (name: string) => Promise<Employee | null>
  updateEmployee: (id: string, updates: Partial<Employee>) => Promise<void>
  deleteEmployee: (id: string) => Promise<{ success: boolean; error?: string }>
  fetchEnvelopes: (filters?: { status?: EnvelopeStatus; search?: string }) => Promise<Envelope[]>
  createEnvelope: (data: Omit<Envelope, 'id' | 'number' | 'status' | 'created_at' | 'updated_at' | 'customer' | 'received_warehouse' | 'jeweler' | 'product_subtype' | 'quote_approved_at' | 'current_warehouse_id' | 'pending_transfer_to_warehouse_id' | 'pending_transfer_sent_by' | 'pending_transfer_sent_at'>) => Promise<Envelope | null>
  updateEnvelope: (id: string, updates: Partial<Omit<Envelope, 'id' | 'number' | 'created_at'>>, statusNote?: string) => Promise<void>
  getEnvelopeStatusLog: (envelopeId: string) => Promise<EnvelopeStatusLog[]>
  fetchEnvelopeEvents: (envelopeId: string) => Promise<EnvelopeEvent[]>
  sendTransfer: (envelopeId: string, fromWarehouseId: string | null, toWarehouseId: string) => Promise<{ success: boolean; error?: string }>
  confirmTransferReceipt: (envelopeId: string) => Promise<{ success: boolean; error?: string }>
  // ── Stock Transfers ───────────────────────────────────────
  createAndDispatchTransfer: (
    fromWarehouseId: string,
    toWarehouseId: string,
    items: { productId: string; quantity: number }[]
  ) => Promise<{ success: boolean; transfer?: StockTransfer; error?: string }>
  confirmStockTransfer: (
    transferId: string,
    receivedItems: { itemId: string; quantityReceived: number }[],
    incidentNotes?: string
  ) => Promise<{ success: boolean; error?: string }>
  cancelStockTransfer: (transferId: string) => Promise<{ success: boolean; error?: string }>
  fetchStockTransfers: (filters?: { status?: StockTransfer['status'] }) => Promise<StockTransfer[]>
  fetchStockTransferEvents: (transferId: string) => Promise<StockTransferEvent[]>
}

const InventoryContext = createContext<InventoryContextType | null>(null)

export function InventoryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const currentUserName = user?.display_name ?? "Sistema"

  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [categoryAttributes, setCategoryAttributes] = useState<CategoryAttribute[]>([])
  const [productStock, setProductStock] = useState<Map<string, StockByWarehouse[]>>(new Map())
  const [customers, setCustomers] = useState<Customer[]>([])
  const [jewelers, setJewelers] = useState<Jeweler[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [envelopeSubtypes, setEnvelopeSubtypes] = useState<EnvelopeSubtype[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const supabase = createClient()

  const refreshData = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Fetch all data in parallel
      const [productsRes, warehousesRes, movementsRes, couponsRes, stockRes, suppliersRes, categoriesRes, brandsRes, categoryAttributesRes, customersRes, jewelersRes, employeesRes, envelopeSubtypesRes] = await Promise.all([
        supabase.from("products").select(`
          *,
          suppliers(id, name, contact, price_group, coefficient, created_at)
        `).order("created_at", { ascending: false }),
        supabase.from("warehouses").select("*").order("name"),
        supabase.from("movements").select(`
          *,
          products(name),
          warehouses:warehouse_id(name),
          to_warehouses:to_warehouse_id(name)
        `).order("created_at", { ascending: false }).limit(100),
        supabase.from("coupons").select(`
          *,
          original_products:original_product_id(name)
        `).order("created_at", { ascending: false }),
        supabase.from("product_stock").select(`
          product_id,
          quantity,
          warehouse_id,
          warehouses(name)
        `).gt("quantity", 0),
        supabase.from("suppliers").select("*").order("name"),
        supabase.from("categories").select("*").order("name"),
        supabase.from("brands").select("*").order("name"),
        supabase.from("category_attributes").select("*").order("sort_order"),
        supabase.from("customers").select("*").order("last_name"),
        supabase.from("jewelers").select("*").order("name"),
        supabase.from("employees").select("*").order("name"),
        supabase.from("envelope_subtypes").select("*").order("product_type").order("sort_order"),
      ])

      if (productsRes.error) throw productsRes.error
      if (warehousesRes.error) throw warehousesRes.error
      if (movementsRes.error) throw movementsRes.error
      if (couponsRes.error) throw couponsRes.error
      if (stockRes.error) throw stockRes.error
      if (suppliersRes.error) throw suppliersRes.error
      if (categoriesRes.error) throw categoriesRes.error
      if (brandsRes.error) throw brandsRes.error
      if (categoryAttributesRes.error) throw categoryAttributesRes.error
      if (customersRes.error) throw customersRes.error
      if (jewelersRes.error) throw jewelersRes.error
      if (employeesRes.error) throw employeesRes.error
      if (envelopeSubtypesRes.error) throw envelopeSubtypesRes.error

      setProducts((productsRes.data || []).map(normalizeProduct))
      setWarehouses((warehousesRes.data || []).map(normalizeWarehouse))
      setMovements((movementsRes.data || []).map(normalizeMovement))
      setCoupons((couponsRes.data || []).map(normalizeCoupon))
      setSuppliers(suppliersRes.data || [])
      setCategories(categoriesRes.data || [])
      setBrands(brandsRes.data || [])
      setCategoryAttributes(categoryAttributesRes.data || [])
      setCustomers(customersRes.data || [])
      setJewelers(jewelersRes.data || [])
      setEmployees(employeesRes.data || [])
      setEnvelopeSubtypes(envelopeSubtypesRes.data || [])
      
      // Build product stock map
      const stockMap = new Map<string, StockByWarehouse[]>()
      for (const s of stockRes.data || []) {
        const productId = s.product_id
        const stockItem: StockByWarehouse = {
          warehouseId: s.warehouse_id,
          warehouseName: (s.warehouses as unknown as { name: string } | null)?.name || "",
          quantity: s.quantity,
        }
        if (!stockMap.has(productId)) {
          stockMap.set(productId, [])
        }
        stockMap.get(productId)!.push(stockItem)
      }
      setProductStock(stockMap)
    } catch (err) {
      console.error("Error fetching data:", err)
      setError(err instanceof Error ? err.message : "Error al cargar datos")
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    refreshData()
  }, [refreshData])

  const getProductById = useCallback((id: string) => {
    return products.find(p => p.id === id)
  }, [products])

  const getStockByWarehouse = useCallback((productId: string): StockByWarehouse[] => {
    return productStock.get(productId) || []
  }, [productStock])

  const addProduct = useCallback(async (product: Partial<Product>): Promise<Product | null> => {
    // Ensure every product has a barcode. If the caller didn't provide one, auto-generate.
    // The loop retries on the (astronomically unlikely) event that the generated code
    // collides with an existing one — either caught by a pre-check or by the DB UNIQUE
    // constraint itself (handles the race condition between two concurrent inserts).
    const userProvidedBarcode = !!(product.barcode?.trim())
    let barcode = product.barcode?.trim() || null

    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (!barcode) barcode = generateBarcode()

      const { data, error } = await supabase
        .from("products")
        .insert({
          sku: product.sku || `SKU-${Date.now()}`,
          barcode,
        name: product.name || "",
        description: product.description || null,
        category: product.category || "Accesorios",
        material: product.material || null,
        weight: product.weight || null,
        cost_price: product.cost_price || 0,
        sell_price: product.sell_price || product.price || 0,
        min_stock: product.min_stock || 5,
        total_stock: 0,
        is_active: product.is_active !== false,
        supplier_id: product.supplier_id || null,
        category_id: product.category_id || null,
        brand_id: product.brand_id || null,
        factory_code: product.factory_code || null,
        internal_code: product.internal_code || null,
        attributes: product.attributes || {},
      })
        .select(`*, suppliers(id, name, contact, price_group, coefficient, created_at)`)
        .single()

      if (!error) {
        const newProduct = normalizeProduct(data)
        setProducts(prev => [newProduct, ...prev])
        return newProduct
      }

      // Postgres UNIQUE violation on the barcode column — only retry when the code
      // was auto-generated. If the user supplied the barcode, surface the error.
      if (!userProvidedBarcode && error.code === "23505" && error.message.includes("barcode")) {
        barcode = null // will regenerate at the top of the loop
        continue
      }

      console.error("Error adding product:", error)
      return null
    }
  }, [supabase])

  const updateProduct = useCallback(async (id: string, updates: Partial<Product>) => {
    const { error } = await supabase
      .from("products")
      .update({
        ...(updates.name && { name: updates.name }),
        ...(updates.sku && { sku: updates.sku }),
        ...(updates.barcode !== undefined && { barcode: updates.barcode }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.category && { category: updates.category }),
        ...(updates.material !== undefined && { material: updates.material }),
        ...(updates.weight !== undefined && { weight: updates.weight }),
        ...(updates.cost_price !== undefined && { cost_price: updates.cost_price }),
        ...(updates.sell_price !== undefined && { sell_price: updates.sell_price }),
        ...(updates.price !== undefined && { sell_price: updates.price }),
        ...(updates.min_stock !== undefined && { min_stock: updates.min_stock }),
        ...(updates.is_active !== undefined && { is_active: updates.is_active }),
        ...(updates.supplier_id !== undefined && { supplier_id: updates.supplier_id }),
        ...(updates.category_id !== undefined && { category_id: updates.category_id }),
        ...(updates.brand_id !== undefined && { brand_id: updates.brand_id }),
        ...(updates.factory_code !== undefined && { factory_code: updates.factory_code }),
        ...(updates.internal_code !== undefined && { internal_code: updates.internal_code }),
        ...(updates.attributes !== undefined && { attributes: updates.attributes || {} }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
    
    if (error) {
      console.error("Error updating product:", error)
      return
    }
    
    setProducts(prev => prev.map(p => 
      p.id === id ? normalizeProduct({ ...p, ...updates, updated_at: new Date().toISOString() }) : p
    ))
  }, [supabase])

  const deleteProduct = useCallback(async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id)
    
    if (error) {
      console.error("Error deleting product:", error)
      return
    }
    
    setProducts(prev => prev.filter(p => p.id !== id))
  }, [supabase])

  const toggleProductStatus = useCallback(async (id: string) => {
    const product = products.find(p => p.id === id)
    if (!product) return
    
    await updateProduct(id, { is_active: !product.is_active })
  }, [products, updateProduct])

  const adjustStock = useCallback(async (
    productId: string, 
    warehouseId: string, 
    quantity: number, 
    type: "in" | "out" | "adjustment", 
    notes?: string
  ) => {
    const dbType = type === "in" ? "entry" : type === "out" ? "exit" : "adjustment"
    
    const { error } = await supabase.rpc("update_stock", {
      p_product_id: productId,
      p_warehouse_id: warehouseId,
      p_quantity: quantity,
      p_type: dbType,
      p_reason: notes || null,
      p_user_name: currentUserName,
      p_to_warehouse_id: null,
    })
    
    if (error) throw new Error(error.message)
    
    await refreshData()
  }, [supabase, refreshData])

  const transferStock = useCallback(async (
    productId: string,
    fromWarehouseId: string,
    toWarehouseId: string,
    quantity: number,
    notes?: string
  ): Promise<boolean> => {
    const { error } = await supabase.rpc("update_stock", {
      p_product_id: productId,
      p_warehouse_id: fromWarehouseId,
      p_quantity: quantity,
      p_type: "transfer",
      p_reason: notes || null,
      p_user_name: currentUserName,
      p_to_warehouse_id: toWarehouseId,
    })

    if (error) {
      console.error("Error transferring stock:", error)
      return false
    }

    await refreshData()
    return true
  }, [supabase, refreshData])

  const addWarehouse = useCallback(async (warehouse: Partial<Warehouse>) => {
    const { data, error } = await supabase
      .from("warehouses")
      .insert({
        name: warehouse.name || "",
        description: warehouse.description || null,
        is_active: warehouse.is_active !== false,
        stock_count: 0,
        total_value: 0,
      })
      .select()
      .single()
    
    if (error) throw new Error(error.message)

    setWarehouses(prev => [...prev, normalizeWarehouse(data)])
  }, [supabase])

  const updateWarehouse = useCallback(async (id: string, updates: Partial<Warehouse>) => {
    const { error } = await supabase
      .from("warehouses")
      .update({
        ...(updates.name && { name: updates.name }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.is_active !== undefined && { is_active: updates.is_active }),
        ...(updates.isActive !== undefined && { is_active: updates.isActive }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
    
    if (error) throw new Error(error.message)

    setWarehouses(prev => prev.map(w =>
      w.id === id ? normalizeWarehouse({ ...w, ...updates }) : w
    ))
  }, [supabase])

  const deleteWarehouse = useCallback(async (id: string) => {
    const { error } = await supabase.from("warehouses").delete().eq("id", id)
    
    if (error) throw new Error(error.message)

    setWarehouses(prev => prev.filter(w => w.id !== id))
  }, [supabase])

  const addSupplier = useCallback(async (supplier: Partial<Supplier>): Promise<Supplier | null> => {
    const { data, error } = await supabase
      .from("suppliers")
      .insert({
        name: supplier.name || "",
        contact: supplier.contact || null,
        price_group: (supplier.price_group || "A").toUpperCase().slice(0, 1),
        coefficient: supplier.coefficient ?? 1,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)

    setSuppliers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    return data
  }, [supabase])

  const updateSupplier = useCallback(async (id: string, updates: Partial<Supplier>) => {
    const { error } = await supabase
      .from("suppliers")
      .update({
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.contact !== undefined && { contact: updates.contact }),
        ...(updates.price_group !== undefined && { price_group: updates.price_group.toUpperCase().slice(0, 1) }),
        ...(updates.coefficient !== undefined && { coefficient: updates.coefficient }),
        ...(updates.is_active !== undefined && { is_active: updates.is_active }),
      })
      .eq("id", id)
    if (error) throw new Error(error.message)
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
  }, [supabase])

  const deleteSupplier = useCallback(async (id: string) => {
    const { error } = await supabase.from("suppliers").delete().eq("id", id)
    if (error) throw new Error(error.message)
    setSuppliers(prev => prev.filter(s => s.id !== id))
  }, [supabase])

  const addCoupon = useCallback(async (input: {
    productId: string
    warehouseId: string
    amount: number
    customerName: string
    customerPhone: string
    expiresAt?: string | null
    notes?: string | null
  }): Promise<{ success: boolean; error?: string; coupon?: Coupon }> => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let code = "CUP-"
    for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length))

    const { data, error } = await supabase.rpc("issue_exchange_ticket", {
      p_code: code,
      p_product_id: input.productId,
      p_warehouse_id: input.warehouseId,
      p_amount: input.amount,
      p_customer_name: input.customerName,
      p_customer_phone: input.customerPhone,
      p_expires_at: input.expiresAt || null,
      p_notes: input.notes || null,
      p_user_name: currentUserName,
    })

    if (error) {
      console.error("Error issuing exchange ticket:", error)
      return { success: false, error: error.message }
    }

    const { data: full } = await supabase
      .from("coupons")
      .select(`*, original_products:original_product_id(name)`)
      .eq("id", (data as Coupon).id)
      .single()

    const newCoupon = normalizeCoupon(full || data)
    setCoupons(prev => [newCoupon, ...prev])
    await refreshData()
    return { success: true, coupon: newCoupon }
  }, [supabase, refreshData])

  const useCoupon = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("coupons")
      .update({
        is_used: true,
        used_at: new Date().toISOString(),
      })
      .eq("id", id)
    
    if (error) {
      console.error("Error using coupon:", error)
      return
    }
    
    setCoupons(prev => prev.map(c => 
      c.id === id ? { ...c, is_used: true, used_at: new Date().toISOString(), status: "used" as const } : c
    ))
  }, [supabase])

  const addCategory = useCallback(async (category: Partial<Category>): Promise<Category | null> => {
    const { data, error } = await supabase
      .from("categories")
      .insert({
        name: category.name || "",
        description: category.description || null,
        is_active: category.is_active !== false,
      })
      .select()
      .single()
    
    if (error) throw new Error(error.message)

    setCategories(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    return data
  }, [supabase])

  const updateCategory = useCallback(async (id: string, updates: Partial<Category>) => {
    const { error } = await supabase
      .from("categories")
      .update({
        ...(updates.name && { name: updates.name }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.is_active !== undefined && { is_active: updates.is_active }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
    
    if (error) throw new Error(error.message)

    setCategories(prev => prev.map(c =>
      c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c
    ))
  }, [supabase])

  const deleteCategory = useCallback(async (id: string) => {
    const { error } = await supabase.from("categories").delete().eq("id", id)
    
    if (error) throw new Error(error.message)

    setCategories(prev => prev.filter(c => c.id !== id))
    // Cascade en DB elimina los category_attributes de esa categoría automáticamente
    setCategoryAttributes(prev => prev.filter(a => a.category_id !== id))
  }, [supabase])

  const addCategoryAttribute = useCallback(async (attr: Partial<CategoryAttribute>): Promise<CategoryAttribute | null> => {
    const { data, error } = await supabase
      .from("category_attributes")
      .insert({
        category_id: attr.category_id,
        key: attr.key || "",
        label: attr.label || "",
        input_type: attr.input_type || "text",
        placeholder: attr.placeholder || null,
        sort_order: attr.sort_order ?? 0,
        is_active: attr.is_active !== false,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)

    setCategoryAttributes(prev => [...prev, data].sort((a, b) => a.sort_order - b.sort_order))
    return data
  }, [supabase])

  const updateCategoryAttribute = useCallback(async (id: string, updates: Partial<CategoryAttribute>) => {
    const { error } = await supabase
      .from("category_attributes")
      .update({
        ...(updates.label !== undefined && { label: updates.label }),
        ...(updates.key !== undefined && { key: updates.key }),
        ...(updates.input_type !== undefined && { input_type: updates.input_type }),
        ...(updates.placeholder !== undefined && { placeholder: updates.placeholder }),
        ...(updates.sort_order !== undefined && { sort_order: updates.sort_order }),
        ...(updates.is_active !== undefined && { is_active: updates.is_active }),
      })
      .eq("id", id)

    if (error) throw new Error(error.message)

    setCategoryAttributes(prev =>
      prev.map(a => a.id === id ? { ...a, ...updates } : a)
        .sort((a, b) => a.sort_order - b.sort_order)
    )
  }, [supabase])

  const deleteCategoryAttribute = useCallback(async (id: string) => {
    const { error } = await supabase.from("category_attributes").delete().eq("id", id)

    if (error) throw new Error(error.message)

    setCategoryAttributes(prev => prev.filter(a => a.id !== id))
  }, [supabase])

  const addBrand = useCallback(async (brand: Partial<Brand>): Promise<Brand | null> => {
    const { data, error } = await supabase
      .from("brands")
      .insert({
        name: brand.name || "",
        description: brand.description || null,
        is_active: brand.is_active !== false,
      })
      .select()
      .single()
    
    if (error) throw new Error(error.message)

    setBrands(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    return data
  }, [supabase])

  const updateBrand = useCallback(async (id: string, updates: Partial<Brand>) => {
    const { error } = await supabase
      .from("brands")
      .update({
        ...(updates.name && { name: updates.name }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.is_active !== undefined && { is_active: updates.is_active }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
    
    if (error) throw new Error(error.message)

    setBrands(prev => prev.map(b =>
      b.id === id ? { ...b, ...updates, updated_at: new Date().toISOString() } : b
    ))
  }, [supabase])

  const deleteBrand = useCallback(async (id: string) => {
    const { error } = await supabase.from("brands").delete().eq("id", id)
    
    if (error) throw new Error(error.message)

    setBrands(prev => prev.filter(b => b.id !== id))
  }, [supabase])

  // ── Customers ────────────────────────────────────────────
  const addCustomer = useCallback(async (data: { first_name: string; last_name: string; dni: string; phone?: string | null; address?: string | null }): Promise<Customer | null> => {
    const { data: created, error } = await supabase.from("customers").insert(data).select().single()
    if (error) throw new Error(error.message)
    setCustomers(prev => [...prev, created].sort((a, b) => a.last_name.localeCompare(b.last_name)))
    return created
  }, [supabase])

  const updateCustomer = useCallback(async (id: string, updates: Partial<Customer>): Promise<void> => {
    const { error } = await supabase.from("customers").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id)
    if (error) throw new Error(error.message)
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c))
  }, [supabase])

  // ── Jewelers / especialistas (joyeros y relojeros) ───────
  const addJeweler = useCallback(async (name: string, workerType: WorkerType = 'jeweler'): Promise<Jeweler | null> => {
    const { data: created, error } = await supabase.from("jewelers").insert({ name, worker_type: workerType }).select().single()
    if (error) throw new Error(error.message)
    setJewelers(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
    return created
  }, [supabase])

  const updateJeweler = useCallback(async (id: string, updates: Partial<Jeweler>): Promise<void> => {
    const { error } = await supabase.from("jewelers").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id)
    if (error) throw new Error(error.message)
    setJewelers(prev => prev.map(j => j.id === id ? { ...j, ...updates, updated_at: new Date().toISOString() } : j))
  }, [supabase])

  const deleteJeweler = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from("jewelers").delete().eq("id", id)
    if (error) throw new Error(error.message)
    setJewelers(prev => prev.filter(j => j.id !== id))
  }, [supabase])

  // ── Employees ────────────────────────────────────────────
  const addEmployee = useCallback(async (name: string): Promise<Employee | null> => {
    const { data: created, error } = await supabase.from("employees").insert({ name }).select().single()
    if (error) throw new Error(error.message)
    setEmployees(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
    return created
  }, [supabase])

  const updateEmployee = useCallback(async (id: string, updates: Partial<Employee>): Promise<void> => {
    const { error } = await supabase.from("employees").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id)
    if (error) throw new Error(error.message)
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...updates, updated_at: new Date().toISOString() } : e))
  }, [supabase])

  const deleteEmployee = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    const { error } = await supabase.from("employees").delete().eq("id", id)
    if (error) {
      console.error("Error deleting employee:", error)
      const friendly = error.code === "23503"
        ? "No se puede eliminar: hay sobres registrados con este empleado."
        : error.message
      return { success: false, error: friendly }
    }
    setEmployees(prev => prev.filter(e => e.id !== id))
    return { success: true }
  }, [supabase])

  // ── Envelopes (fetched on demand, not in global state) ─
  const ENVELOPE_SELECT = `
    *,
    customer:customers(id, first_name, last_name, dni, phone, address, created_at, updated_at),
    received_warehouse:warehouses!received_warehouse_id(id, name),
    current_warehouse:warehouses!current_warehouse_id(id, name),
    pending_transfer_warehouse:warehouses!pending_transfer_to_warehouse_id(id, name),
    jeweler:jewelers(id, name, worker_type, is_active, created_at, updated_at),
    received_by_employee:employees(id, name, is_active, created_at, updated_at),
    product_subtype:envelope_subtypes(id, name, product_type, is_active, sort_order, created_at)
  `

  const fetchEnvelopes = useCallback(async (filters?: { status?: EnvelopeStatus; search?: string }): Promise<Envelope[]> => {
    let query = supabase.from("envelopes").select(ENVELOPE_SELECT).order("created_at", { ascending: false })
    if (filters?.status) query = query.eq("status", filters.status)
    const { data, error } = await query
    if (error) { console.error("Error fetching envelopes:", error); return [] }
    return (data || []) as Envelope[]
  }, [supabase])

  const createEnvelope = useCallback(async (data: Omit<Envelope, 'id' | 'number' | 'status' | 'created_at' | 'updated_at' | 'customer' | 'received_warehouse' | 'jeweler' | 'received_by_employee' | 'product_subtype' | 'quote_approved_at' | 'current_warehouse_id' | 'pending_transfer_to_warehouse_id' | 'pending_transfer_sent_by' | 'pending_transfer_sent_at'>): Promise<Envelope | null> => {
    const conditionError = validateConditionNotes(data.product_condition, data.product_condition_notes)
    if (conditionError) { console.error("createEnvelope validation:", conditionError); return null }
    const insertData = { ...data, number: '', current_warehouse_id: data.received_warehouse_id }
    const { data: created, error } = await supabase.from("envelopes").insert(insertData).select(ENVELOPE_SELECT).single()
    if (error) { console.error("Error creating envelope:", error); return null }
    const env = created as Envelope
    const warehouseName = env.received_warehouse?.name || ''
    const employeeName = env.received_by_employee?.name || ''
    const detail = [
      warehouseName ? `Local: ${warehouseName}` : null,
      employeeName ? `Operador: ${employeeName}` : null,
    ].filter(Boolean).join(' · ') || null
    const [statusLogResult, eventResult] = await Promise.all([
      supabase.from("envelope_status_log").insert({ envelope_id: created.id, from_status: null, to_status: 'received', changed_by: employeeName || 'Sistema' }),
      supabase.from("envelope_events").insert({ envelope_id: created.id, event_type: 'envelope_created', title: `Sobre recibido${warehouseName ? ` en ${warehouseName}` : ''}`, detail, created_by: employeeName || 'Sistema' }),
    ])
    if (statusLogResult.error) console.error("Error creating envelope_status_log entry:", statusLogResult.error)
    if (eventResult.error) console.error("Error creating envelope_events entry:", eventResult.error)
    return env
  }, [supabase])

  const STATUS_EVENT_TITLES: Record<EnvelopeStatus, string> = {
    received: 'Sobre recibido',
    quote_pending: 'Presupuesto solicitado',
    quote_approved: 'Presupuesto aprobado',
    in_workshop: 'Ingreso a taller',
    ready: 'Listo para retirar',
    delivered: 'Entregado al cliente',
    cancelled: 'Cancelado',
  }

  const QUOTE_EVENT_TITLES: Partial<Record<QuoteStatus, string>> = {
    pending: 'Presupuesto solicitado',
    informed: 'Presupuesto informado',
    approved: 'Presupuesto aprobado por el cliente',
    rejected: 'Presupuesto rechazado por el cliente',
  }

  const updateEnvelope = useCallback(async (id: string, updates: Partial<Omit<Envelope, 'id' | 'number' | 'created_at'>>, statusNote?: string): Promise<void> => {
    const createdBy = currentUserName
    const { data: current } = await supabase
      .from("envelopes")
      .select("status, jeweler_id, quote_status, quote_amount, current_warehouse_id")
      .eq("id", id)
      .single()

    const { error } = await supabase.from("envelopes").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id)
    if (error) throw new Error(error.message)

    const events: { event_type: string; title: string; detail: string | null }[] = []
    const statusChanged = !!(updates.status && current && updates.status !== current.status)

    // Status change — uses statusNote as detail; for reject_quote (pending→received) the
    // business event is "quote rejected", not the generic "Sobre recibido" title.
    if (statusChanged) {
      const isRejectBack = updates.status === 'received' && current?.status === 'quote_pending'
      const title = isRejectBack
        ? 'Presupuesto rechazado'
        : STATUS_EVENT_TITLES[updates.status!]
      events.push({ event_type: 'status_changed', title, detail: statusNote || null })
      const { error: statusLogError } = await supabase.from("envelope_status_log").insert({
        envelope_id: id, from_status: current!.status, to_status: updates.status!,
        changed_by: currentUserName, notes: statusNote || null,
      })
      if (statusLogError) console.error("Error creating envelope_status_log entry:", statusLogError)
    }

    // Jeweler change
    if ('jeweler_id' in updates && updates.jeweler_id !== current?.jeweler_id) {
      if (updates.jeweler_id) {
        const { data: j } = await supabase.from("jewelers").select("name").eq("id", updates.jeweler_id).single()
        const isNew = !current?.jeweler_id
        events.push({
          event_type: isNew ? 'jeweler_assigned' : 'jeweler_changed',
          title: isNew ? `Asignado a ${j?.name || 'especialista'}` : `Cambio de especialista: ${j?.name || 'especialista'}`,
          detail: null,
        })
      } else if (current?.jeweler_id) {
        events.push({ event_type: 'jeweler_removed', title: 'Especialista removido', detail: null })
      }
    }

    // Quote status change — only when NOT accompanied by a status change that already
    // describes the same business event. If status changed too, that event is authoritative.
    if (!statusChanged && 'quote_status' in updates && updates.quote_status !== current?.quote_status) {
      const title = QUOTE_EVENT_TITLES[updates.quote_status as QuoteStatus]
      if (title) {
        const amount = updates.quote_amount ?? current?.quote_amount
        const detail = updates.quote_status === 'informed' && amount
          ? `$${amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
          : null
        events.push({ event_type: 'quote_updated', title, detail })
      }
    }

    // Location transfer (current_warehouse_id changed)
    if ('current_warehouse_id' in updates && updates.current_warehouse_id && updates.current_warehouse_id !== current?.current_warehouse_id) {
      const { data: w } = await supabase.from("warehouses").select("name").eq("id", updates.current_warehouse_id).single()
      events.push({ event_type: 'location_transfer', title: `Transferido a ${w?.name || 'local'}`, detail: null })
    }

    if (events.length > 0) {
      const { error: eventsError } = await supabase.from("envelope_events").insert(events.map(e => ({ ...e, envelope_id: id, created_by: createdBy || 'Sistema' })))
      if (eventsError) console.error("Error creating envelope_events entries:", eventsError)
    }
  }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Envío de un traslado entre locales: el sobre queda "en tránsito" —
  // current_warehouse_id NO cambia todavía. Recién se actualiza cuando
  // alguien en destino confirma la recepción (confirmTransferReceipt).
  const sendTransfer = useCallback(async (
    envelopeId: string,
    fromWarehouseId: string | null,
    toWarehouseId: string
  ): Promise<{ success: boolean; error?: string }> => {
    const by = currentUserName

    const { data: transferRow, error: transferError } = await supabase
      .from("envelope_transfers")
      .insert({ envelope_id: envelopeId, from_warehouse_id: fromWarehouseId, to_warehouse_id: toWarehouseId, sent_by: by })
      .select()
      .single()
    if (transferError) { console.error("Error creating envelope_transfer:", transferError); return { success: false, error: transferError.message } }

    const { error: envError } = await supabase.from("envelopes").update({
      pending_transfer_to_warehouse_id: toWarehouseId,
      pending_transfer_sent_by: by,
      pending_transfer_sent_at: transferRow.sent_at,
      updated_at: new Date().toISOString(),
    }).eq("id", envelopeId)
    if (envError) { console.error("Error updating envelope with pending transfer:", envError); return { success: false, error: envError.message } }

    const { data: w } = await supabase.from("warehouses").select("name").eq("id", toWarehouseId).single()
    const { error: eventError } = await supabase.from("envelope_events").insert({
      envelope_id: envelopeId,
      event_type: 'transfer_sent',
      title: `Enviado a ${w?.name || 'local'}`,
      detail: null,
      created_by: by,
    })
    if (eventError) console.error("Error creating transfer_sent event:", eventError)

    return { success: true }
  }, [supabase])

  // Confirmación de recepción física en destino: recién acá se actualiza
  // current_warehouse_id y se cierra el registro de envelope_transfers.
  const confirmTransferReceipt = useCallback(async (
    envelopeId: string
  ): Promise<{ success: boolean; error?: string }> => {
    const by = currentUserName

    const { data: openTransfer, error: findError } = await supabase
      .from("envelope_transfers")
      .select("*")
      .eq("envelope_id", envelopeId)
      .eq("status", "in_transit")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (findError) { console.error("Error finding open transfer:", findError); return { success: false, error: findError.message } }
    if (!openTransfer) return { success: false, error: "No hay una transferencia pendiente para este sobre." }

    const receivedAt = new Date().toISOString()
    const { error: transferError } = await supabase.from("envelope_transfers")
      .update({ status: 'received', received_by: by, received_at: receivedAt })
      .eq("id", openTransfer.id)
    if (transferError) { console.error("Error confirming envelope_transfer:", transferError); return { success: false, error: transferError.message } }

    const { error: envError } = await supabase.from("envelopes").update({
      current_warehouse_id: openTransfer.to_warehouse_id,
      pending_transfer_to_warehouse_id: null,
      pending_transfer_sent_by: null,
      pending_transfer_sent_at: null,
      updated_at: receivedAt,
    }).eq("id", envelopeId)
    if (envError) { console.error("Error updating envelope after transfer receipt:", envError); return { success: false, error: envError.message } }

    const { data: w } = await supabase.from("warehouses").select("name").eq("id", openTransfer.to_warehouse_id).single()
    const { error: eventError } = await supabase.from("envelope_events").insert({
      envelope_id: envelopeId,
      event_type: 'transfer_received',
      title: `Recepción confirmada en ${w?.name || 'local'}`,
      detail: null,
      created_by: by,
    })
    if (eventError) console.error("Error creating transfer_received event:", eventError)

    return { success: true }
  }, [supabase])

  const getEnvelopeStatusLog = useCallback(async (envelopeId: string): Promise<EnvelopeStatusLog[]> => {
    const { data, error } = await supabase.from("envelope_status_log").select("*").eq("envelope_id", envelopeId).order("created_at")
    if (error) { console.error("Error fetching status log:", error); return [] }
    return (data || []) as EnvelopeStatusLog[]
  }, [supabase])

  const fetchEnvelopeEvents = useCallback(async (envelopeId: string): Promise<EnvelopeEvent[]> => {
    const { data, error } = await supabase.from("envelope_events").select("*").eq("envelope_id", envelopeId).order("created_at")
    if (error) { console.error("Error fetching envelope events:", error); return [] }
    return (data || []) as EnvelopeEvent[]
  }, [supabase])

  // ── Stock Transfers ──────────────────────────────────────────────────────────

  const STOCK_TRANSFER_SELECT = `
    *,
    from_warehouse:warehouses!from_warehouse_id(id, name),
    to_warehouse:warehouses!to_warehouse_id(id, name),
    items:stock_transfer_items(
      id, transfer_id, product_id, quantity_sent, quantity_received, created_at,
      product:products(id, sku, name, category)
    )
  `

  const fetchStockTransfers = useCallback(async (
    filters?: { status?: StockTransfer['status'] }
  ): Promise<StockTransfer[]> => {
    let query = supabase
      .from("stock_transfers")
      .select(STOCK_TRANSFER_SELECT)
      .order("dispatched_at", { ascending: false })
    if (filters?.status) query = query.eq("status", filters.status)
    const { data, error } = await query
    if (error) { console.error("Error fetching stock transfers:", error); return [] }
    return (data || []) as StockTransfer[]
  }, [supabase])

  const fetchStockTransferEvents = useCallback(async (transferId: string): Promise<StockTransferEvent[]> => {
    const { data, error } = await supabase
      .from("stock_transfer_events")
      .select("*")
      .eq("transfer_id", transferId)
      .order("created_at")
    if (error) { console.error("Error fetching stock transfer events:", error); return [] }
    return (data || []) as StockTransferEvent[]
  }, [supabase])

  // Crea la cabecera, llama update_stock(exit) por cada item, registra los eventos.
  // El stock sale del origen en este momento; el destino lo recibe al confirmar.
  const createAndDispatchTransfer = useCallback(async (
    fromWarehouseId: string,
    toWarehouseId: string,
    items: { productId: string; quantity: number }[]
  ): Promise<{ success: boolean; transfer?: StockTransfer; error?: string }> => {
    const createdBy = currentUserName
    if (!items.length) return { success: false, error: "Debe incluir al menos un producto." }

    // Generate transfer number via DB function
    const { data: numRow, error: numError } = await supabase.rpc("next_stock_transfer_number")
    if (numError) { console.error("Error getting transfer number:", numError); return { success: false, error: numError.message } }
    const number = numRow as string

    // Create transfer header
    const { data: transfer, error: transferError } = await supabase
      .from("stock_transfers")
      .insert({ number, from_warehouse_id: fromWarehouseId, to_warehouse_id: toWarehouseId, created_by: createdBy, status: 'in_transit' })
      .select()
      .single()
    if (transferError) { console.error("Error creating stock_transfer:", transferError); return { success: false, error: transferError.message } }

    // Insert items
    const { error: itemsError } = await supabase.from("stock_transfer_items").insert(
      items.map(i => ({ transfer_id: transfer.id, product_id: i.productId, quantity_sent: i.quantity }))
    )
    if (itemsError) {
      // Rollback: delete the header
      await supabase.from("stock_transfers").delete().eq("id", transfer.id)
      console.error("Error inserting transfer items:", itemsError)
      return { success: false, error: itemsError.message }
    }

    // Deduct stock from origin (exit per item) using existing RPC
    for (const item of items) {
      const { error: stockError } = await supabase.rpc("update_stock", {
        p_product_id: item.productId,
        p_warehouse_id: fromWarehouseId,
        p_quantity: item.quantity,
        p_type: "exit",
        p_reason: `Transferencia ${number} — salida`,
        p_user_name: createdBy,
        p_to_warehouse_id: null,
      })
      if (stockError) {
        console.error(`Error deducting stock for product ${item.productId}:`, stockError)
        // Mark transfer as cancelled — stock for previously processed items was already deducted;
        // operator must reconcile manually. Surface the error clearly.
        await supabase.from("stock_transfers").update({ status: 'cancelled' }).eq("id", transfer.id)
        return { success: false, error: `Stock insuficiente o error al descontar producto. ${stockError.message}` }
      }
    }

    // Log initial event
    const { data: fromW } = await supabase.from("warehouses").select("name").eq("id", fromWarehouseId).single()
    const { data: toW } = await supabase.from("warehouses").select("name").eq("id", toWarehouseId).single()
    await supabase.from("stock_transfer_events").insert({
      transfer_id: transfer.id,
      event_type: 'transfer_dispatched',
      title: `Transferencia despachada`,
      detail: `${items.length} producto${items.length !== 1 ? 's' : ''} enviados de ${fromW?.name || 'origen'} a ${toW?.name || 'destino'}`,
      created_by: createdBy,
    })

    await refreshData()
    // Re-fetch the specific transfer to return it with joins
    const { data: fullTransfer } = await supabase.from("stock_transfers").select(STOCK_TRANSFER_SELECT).eq("id", transfer.id).single()
    return { success: true, transfer: fullTransfer as StockTransfer }
  }, [supabase, refreshData]) // eslint-disable-line react-hooks/exhaustive-deps

  // Confirma la recepción producto a producto. Si qty_received < qty_sent en algún item → with_differences.
  // El stock entra al destino con la cantidad REAL recibida.
  const confirmStockTransfer = useCallback(async (
    transferId: string,
    receivedItems: { itemId: string; quantityReceived: number }[],
    incidentNotes?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const receivedBy = currentUserName
    const { data: transfer, error: findError } = await supabase
      .from("stock_transfers")
      .select(`*, items:stock_transfer_items(*)`)
      .eq("id", transferId)
      .single()
    if (findError || !transfer) return { success: false, error: "No se encontró la transferencia." }
    if (transfer.status !== 'in_transit') return { success: false, error: "Solo se pueden confirmar transferencias en tránsito." }

    const receivedAt = new Date().toISOString()
    const hasDifferences = receivedItems.some(ri => {
      const sent = (transfer.items as StockTransferItem[]).find(i => i.id === ri.itemId)?.quantity_sent ?? 0
      return ri.quantityReceived < sent
    })
    const newStatus = hasDifferences ? 'with_differences' : 'completed'

    // Update each item with quantity_received
    for (const ri of receivedItems) {
      const { error } = await supabase
        .from("stock_transfer_items")
        .update({ quantity_received: ri.quantityReceived })
        .eq("id", ri.itemId)
      if (error) { console.error("Error updating transfer item:", error); return { success: false, error: error.message } }
    }

    // Update transfer header
    const { error: headerError } = await supabase
      .from("stock_transfers")
      .update({ status: newStatus, received_by: receivedBy, received_at: receivedAt, incident_notes: incidentNotes || null, updated_at: receivedAt })
      .eq("id", transferId)
    if (headerError) { console.error("Error updating stock_transfer status:", headerError); return { success: false, error: headerError.message } }

    // Add stock to destination for each item (quantity RECEIVED, not sent)
    for (const ri of receivedItems) {
      if (ri.quantityReceived <= 0) continue
      const item = (transfer.items as StockTransferItem[]).find(i => i.id === ri.itemId)
      if (!item) continue
      const { error: stockError } = await supabase.rpc("update_stock", {
        p_product_id: item.product_id,
        p_warehouse_id: transfer.to_warehouse_id,
        p_quantity: ri.quantityReceived,
        p_type: "entry",
        p_reason: `Transferencia ${transfer.number} — recepción`,
        p_user_name: receivedBy,
        p_to_warehouse_id: null,
      })
      if (stockError) console.error(`Error crediting stock for item ${ri.itemId}:`, stockError)
    }

    // Log event
    const eventTitle = newStatus === 'completed' ? 'Recepción confirmada — sin diferencias' : 'Recepción confirmada — con diferencias'
    await supabase.from("stock_transfer_events").insert({
      transfer_id: transferId,
      event_type: newStatus === 'completed' ? 'transfer_completed' : 'transfer_differences',
      title: eventTitle,
      detail: incidentNotes || null,
      created_by: receivedBy,
    })

    await refreshData()
    return { success: true }
  }, [supabase, refreshData])

  // Cancela una transferencia en tránsito: devuelve el stock al origen.
  const cancelStockTransfer = useCallback(async (
    transferId: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cancelledBy = currentUserName
    const { data: transfer, error: findError } = await supabase
      .from("stock_transfers")
      .select(`*, items:stock_transfer_items(*)`)
      .eq("id", transferId)
      .single()
    if (findError || !transfer) return { success: false, error: "No se encontró la transferencia." }
    if (transfer.status !== 'in_transit') return { success: false, error: "Solo se pueden cancelar transferencias en tránsito." }

    // Return stock to origin
    for (const item of (transfer.items as StockTransferItem[])) {
      const { error: stockError } = await supabase.rpc("update_stock", {
        p_product_id: item.product_id,
        p_warehouse_id: transfer.from_warehouse_id,
        p_quantity: item.quantity_sent,
        p_type: "entry",
        p_reason: `Transferencia ${transfer.number} cancelada — devolución`,
        p_user_name: cancelledBy,
        p_to_warehouse_id: null,
      })
      if (stockError) console.error(`Error returning stock for item ${item.id}:`, stockError)
    }

    const { error: updateError } = await supabase
      .from("stock_transfers")
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq("id", transferId)
    if (updateError) return { success: false, error: updateError.message }

    await supabase.from("stock_transfer_events").insert({
      transfer_id: transferId,
      event_type: 'transfer_cancelled',
      title: 'Transferencia cancelada',
      detail: 'Stock devuelto al depósito de origen',
      created_by: cancelledBy,
    })

    await refreshData()
    return { success: true }
  }, [supabase, refreshData])

  return (
    <InventoryContext.Provider value={{
      products,
      warehouses,
      movements,
      coupons,
      suppliers,
      categories,
      brands,
      categoryAttributes,
      productStock,
      loading,
      error,
      refreshData,
      addProduct,
      updateProduct,
      deleteProduct,
      toggleProductStatus,
      adjustStock,
      transferStock,
      getStockByWarehouse,
      getProductById,
      addWarehouse,
      updateWarehouse,
      deleteWarehouse,
      addSupplier,
      updateSupplier,
      deleteSupplier,
      addCategory,
      updateCategory,
      deleteCategory,
      addCategoryAttribute,
      updateCategoryAttribute,
      deleteCategoryAttribute,
      addBrand,
      updateBrand,
      deleteBrand,
      addCoupon,
      useCoupon,
      customers,
      jewelers,
      employees,
      envelopeSubtypes,
      addCustomer,
      updateCustomer,
      addJeweler,
      updateJeweler,
      deleteJeweler,
      addEmployee,
      updateEmployee,
      deleteEmployee,
      fetchEnvelopes,
      createEnvelope,
      updateEnvelope,
      getEnvelopeStatusLog,
      fetchEnvelopeEvents,
      sendTransfer,
      confirmTransferReceipt,
      createAndDispatchTransfer,
      confirmStockTransfer,
      cancelStockTransfer,
      fetchStockTransfers,
      fetchStockTransferEvents,
    }}>
      {children}
    </InventoryContext.Provider>
  )
}

export function useInventory() {
  const context = useContext(InventoryContext)
  if (!context) {
    throw new Error("useInventory must be used within an InventoryProvider")
  }
  return context
}
