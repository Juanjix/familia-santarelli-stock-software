"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Product, Warehouse, Movement, StockByWarehouse, Coupon, Supplier, Category, Brand, CategoryAttribute, Customer, Jeweler, EnvelopeSubtype, Envelope, EnvelopeStatus, EnvelopeStatusLog, EnvelopeEvent, QuoteStatus } from "./types"

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
  addCoupon: (coupon: Partial<Coupon>) => Promise<void>
  useCoupon: (id: string) => Promise<void>
  // ── Sobres ────────────────────────────────────────────────
  customers: Customer[]
  jewelers: Jeweler[]
  envelopeSubtypes: EnvelopeSubtype[]
  addCustomer: (data: { first_name: string; last_name: string; dni: string; phone?: string | null; address?: string | null }) => Promise<Customer | null>
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>
  addJeweler: (name: string) => Promise<Jeweler | null>
  updateJeweler: (id: string, updates: Partial<Jeweler>) => Promise<void>
  deleteJeweler: (id: string) => Promise<void>
  fetchEnvelopes: (filters?: { status?: EnvelopeStatus; search?: string }) => Promise<Envelope[]>
  createEnvelope: (data: Omit<Envelope, 'id' | 'number' | 'status' | 'created_at' | 'updated_at' | 'customer' | 'received_warehouse' | 'jeweler' | 'product_subtype' | 'quote_approved_at' | 'current_warehouse_id'>) => Promise<Envelope | null>
  updateEnvelope: (id: string, updates: Partial<Omit<Envelope, 'id' | 'number' | 'created_at'>>, statusNote?: string) => Promise<void>
  getEnvelopeStatusLog: (envelopeId: string) => Promise<EnvelopeStatusLog[]>
  fetchEnvelopeEvents: (envelopeId: string) => Promise<EnvelopeEvent[]>
}

const InventoryContext = createContext<InventoryContextType | null>(null)

export function InventoryProvider({ children }: { children: ReactNode }) {
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
  const [envelopeSubtypes, setEnvelopeSubtypes] = useState<EnvelopeSubtype[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const supabase = createClient()

  const refreshData = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Fetch all data in parallel
      const [productsRes, warehousesRes, movementsRes, couponsRes, stockRes, suppliersRes, categoriesRes, brandsRes, categoryAttributesRes, customersRes, jewelersRes, envelopeSubtypesRes] = await Promise.all([
        supabase.from("products").select(`
          *,
          suppliers(id, name, contact, created_at)
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
      setEnvelopeSubtypes(envelopeSubtypesRes.data || [])
      
      // Build product stock map
      const stockMap = new Map<string, StockByWarehouse[]>()
      for (const s of stockRes.data || []) {
        const productId = s.product_id
        const stockItem: StockByWarehouse = {
          warehouseId: s.warehouse_id,
          warehouseName: (s.warehouses as { name: string } | null)?.name || "",
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
    const { data, error } = await supabase
      .from("products")
      .insert({
        sku: product.sku || `SKU-${Date.now()}`,
        barcode: product.barcode || null,
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
      .select(`*, suppliers(id, name, contact, created_at)`)
      .single()
    
    if (error) {
      console.error("Error adding product:", error)
      return null
    }
    
    const newProduct = normalizeProduct(data)
    setProducts(prev => [newProduct, ...prev])
    return newProduct
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
      p_user_name: "Usuario",
      p_to_warehouse_id: null,
    })
    
    if (error) {
      console.error("Error adjusting stock:", error)
      return
    }
    
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
      p_user_name: "Usuario",
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
    
    if (error) {
      console.error("Error adding warehouse:", error)
      return
    }
    
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
    
    if (error) {
      console.error("Error updating warehouse:", error)
      return
    }
    
    setWarehouses(prev => prev.map(w => 
      w.id === id ? normalizeWarehouse({ ...w, ...updates }) : w
    ))
  }, [supabase])

  const deleteWarehouse = useCallback(async (id: string) => {
    const { error } = await supabase.from("warehouses").delete().eq("id", id)
    
    if (error) {
      console.error("Error deleting warehouse:", error)
      return
    }
    
    setWarehouses(prev => prev.filter(w => w.id !== id))
  }, [supabase])

  const addSupplier = useCallback(async (supplier: Partial<Supplier>): Promise<Supplier | null> => {
    const { data, error } = await supabase
      .from("suppliers")
      .insert({
        name: supplier.name || "",
        contact: supplier.contact || null,
      })
      .select()
      .single()
    
    if (error) {
      console.error("Error adding supplier:", error)
      return null
    }
    
    setSuppliers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    return data
  }, [supabase])

  const updateSupplier = useCallback(async (id: string, updates: Partial<Supplier>) => {
    const { error } = await supabase
      .from("suppliers")
      .update({
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.contact !== undefined && { contact: updates.contact }),
        ...(updates.is_active !== undefined && { is_active: updates.is_active }),
      })
      .eq("id", id)
    if (error) { console.error("Error updating supplier:", error); return }
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
  }, [supabase])

  const deleteSupplier = useCallback(async (id: string) => {
    const { error } = await supabase.from("suppliers").delete().eq("id", id)
    if (error) { console.error("Error deleting supplier:", error); return }
    setSuppliers(prev => prev.filter(s => s.id !== id))
  }, [supabase])

  const addCoupon = useCallback(async (coupon: Partial<Coupon>) => {
    const { data, error } = await supabase
      .from("coupons")
      .insert({
        code: coupon.code || `CPN-${Date.now()}`,
        original_product_id: coupon.original_product_id || coupon.productId || null,
        amount: coupon.amount || coupon.value || 0,
        is_used: false,
        expires_at: coupon.expires_at || coupon.expiresAt || null,
        notes: coupon.notes || null,
      })
      .select(`*, original_products:original_product_id(name)`)
      .single()
    
    if (error) {
      console.error("Error adding coupon:", error)
      return
    }
    
    setCoupons(prev => [normalizeCoupon(data), ...prev])
  }, [supabase])

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
    
    if (error) {
      console.error("Error adding category:", error)
      return null
    }
    
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
    
    if (error) {
      console.error("Error updating category:", error)
      return
    }
    
    setCategories(prev => prev.map(c => 
      c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c
    ))
  }, [supabase])

  const deleteCategory = useCallback(async (id: string) => {
    const { error } = await supabase.from("categories").delete().eq("id", id)
    
    if (error) {
      console.error("Error deleting category:", error)
      return
    }
    
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

    if (error) {
      console.error("Error adding category attribute:", error)
      return null
    }

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

    if (error) {
      console.error("Error updating category attribute:", error)
      return
    }

    setCategoryAttributes(prev =>
      prev.map(a => a.id === id ? { ...a, ...updates } : a)
        .sort((a, b) => a.sort_order - b.sort_order)
    )
  }, [supabase])

  const deleteCategoryAttribute = useCallback(async (id: string) => {
    const { error } = await supabase.from("category_attributes").delete().eq("id", id)

    if (error) {
      console.error("Error deleting category attribute:", error)
      return
    }

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
    
    if (error) {
      console.error("Error adding brand:", error)
      return null
    }
    
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
    
    if (error) {
      console.error("Error updating brand:", error)
      return
    }
    
    setBrands(prev => prev.map(b => 
      b.id === id ? { ...b, ...updates, updated_at: new Date().toISOString() } : b
    ))
  }, [supabase])

  const deleteBrand = useCallback(async (id: string) => {
    const { error } = await supabase.from("brands").delete().eq("id", id)
    
    if (error) {
      console.error("Error deleting brand:", error)
      return
    }
    
    setBrands(prev => prev.filter(b => b.id !== id))
  }, [supabase])

  // ── Customers ────────────────────────────────────────────
  const addCustomer = useCallback(async (data: { first_name: string; last_name: string; dni: string; phone?: string | null; address?: string | null }): Promise<Customer | null> => {
    const { data: created, error } = await supabase.from("customers").insert(data).select().single()
    if (error) { console.error("Error adding customer:", error); return null }
    setCustomers(prev => [...prev, created].sort((a, b) => a.last_name.localeCompare(b.last_name)))
    return created
  }, [supabase])

  const updateCustomer = useCallback(async (id: string, updates: Partial<Customer>): Promise<void> => {
    const { error } = await supabase.from("customers").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id)
    if (error) { console.error("Error updating customer:", error); return }
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c))
  }, [supabase])

  // ── Jewelers ────────────────────────────────────────────
  const addJeweler = useCallback(async (name: string): Promise<Jeweler | null> => {
    const { data: created, error } = await supabase.from("jewelers").insert({ name }).select().single()
    if (error) { console.error("Error adding jeweler:", error); return null }
    setJewelers(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
    return created
  }, [supabase])

  const updateJeweler = useCallback(async (id: string, updates: Partial<Jeweler>): Promise<void> => {
    const { error } = await supabase.from("jewelers").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id)
    if (error) { console.error("Error updating jeweler:", error); return }
    setJewelers(prev => prev.map(j => j.id === id ? { ...j, ...updates, updated_at: new Date().toISOString() } : j))
  }, [supabase])

  const deleteJeweler = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from("jewelers").delete().eq("id", id)
    if (error) { console.error("Error deleting jeweler:", error); return }
    setJewelers(prev => prev.filter(j => j.id !== id))
  }, [supabase])

  // ── Envelopes (fetched on demand, not in global state) ─
  const fetchEnvelopes = useCallback(async (filters?: { status?: EnvelopeStatus; search?: string }): Promise<Envelope[]> => {
    let query = supabase.from("envelopes").select(`
      *,
      customer:customers(id, first_name, last_name, dni, phone, address, created_at, updated_at),
      received_warehouse:warehouses!received_warehouse_id(id, name),
      jeweler:jewelers(id, name, is_active, created_at, updated_at),
      product_subtype:envelope_subtypes(id, name, product_type, is_active, sort_order, created_at)
    `).order("created_at", { ascending: false })
    if (filters?.status) query = query.eq("status", filters.status)
    const { data, error } = await query
    if (error) { console.error("Error fetching envelopes:", error); return [] }
    return (data || []) as Envelope[]
  }, [supabase])

  const createEnvelope = useCallback(async (data: Omit<Envelope, 'id' | 'number' | 'status' | 'created_at' | 'updated_at' | 'customer' | 'received_warehouse' | 'jeweler' | 'product_subtype' | 'quote_approved_at' | 'current_warehouse_id'>): Promise<Envelope | null> => {
    const insertData = { ...data, number: '', current_warehouse_id: data.received_warehouse_id }
    const { data: created, error } = await supabase.from("envelopes").insert(insertData).select(`
      *,
      customer:customers(id, first_name, last_name, dni, phone, address, created_at, updated_at),
      received_warehouse:warehouses!received_warehouse_id(id, name),
      jeweler:jewelers(id, name, is_active, created_at, updated_at),
      product_subtype:envelope_subtypes(id, name, product_type, is_active, sort_order, created_at)
    `).single()
    if (error) { console.error("Error creating envelope:", error); return null }
    const warehouseName = (created as Envelope).received_warehouse?.name || ''
    await Promise.all([
      supabase.from("envelope_status_log").insert({ envelope_id: created.id, from_status: null, to_status: 'received', changed_by: 'Sistema' }),
      supabase.from("envelope_events").insert({ envelope_id: created.id, event_type: 'envelope_created', title: `Sobre recibido${warehouseName ? ` en ${warehouseName}` : ''}`, detail: null }),
    ])
    return created as Envelope
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
    const { data: current } = await supabase
      .from("envelopes")
      .select("status, jeweler_id, quote_status, quote_amount, current_warehouse_id")
      .eq("id", id)
      .single()

    const { error } = await supabase.from("envelopes").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id)
    if (error) { console.error("Error updating envelope:", error); return }

    const events: { event_type: string; title: string; detail: string | null }[] = []

    // Status change
    if (updates.status && current && updates.status !== current.status) {
      events.push({ event_type: 'status_changed', title: STATUS_EVENT_TITLES[updates.status], detail: statusNote || null })
      await supabase.from("envelope_status_log").insert({
        envelope_id: id, from_status: current.status, to_status: updates.status,
        changed_by: 'Sistema', notes: statusNote || null,
      })
    }

    // Jeweler change
    if ('jeweler_id' in updates && updates.jeweler_id !== current?.jeweler_id) {
      if (updates.jeweler_id) {
        const { data: j } = await supabase.from("jewelers").select("name").eq("id", updates.jeweler_id).single()
        const isNew = !current?.jeweler_id
        events.push({
          event_type: isNew ? 'jeweler_assigned' : 'jeweler_changed',
          title: isNew ? `Asignado a ${j?.name || 'joyero'}` : `Cambio de joyero: ${j?.name || 'joyero'}`,
          detail: null,
        })
      } else if (current?.jeweler_id) {
        events.push({ event_type: 'jeweler_removed', title: 'Joyero removido', detail: null })
      }
    }

    // Quote status change (when changed directly, not via status flow)
    if ('quote_status' in updates && updates.quote_status !== current?.quote_status) {
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
      await supabase.from("envelope_events").insert(events.map(e => ({ ...e, envelope_id: id })))
    }
  }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

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
      envelopeSubtypes,
      addCustomer,
      updateCustomer,
      addJeweler,
      updateJeweler,
      deleteJeweler,
      fetchEnvelopes,
      createEnvelope,
      updateEnvelope,
      getEnvelopeStatusLog,
      fetchEnvelopeEvents,
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
