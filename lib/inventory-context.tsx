"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Product, Warehouse, Movement, StockByWarehouse, Coupon, Supplier, Category, Brand } from "./types"

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
  productStock: Map<string, StockByWarehouse[]>
  loading: boolean
  error: string | null
  refreshData: () => Promise<void>
  addProduct: (product: Partial<Product>) => Promise<Product | null>
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
  toggleProductStatus: (id: string) => Promise<void>
  adjustStock: (productId: string, warehouseId: string, quantity: number, type: "in" | "out" | "adjustment", notes?: string) => Promise<void>
  transferStock: (productId: string, fromWarehouseId: string, toWarehouseId: string, quantity: number, notes?: string) => Promise<void>
  getStockByWarehouse: (productId: string) => StockByWarehouse[]
  getProductById: (id: string) => Product | undefined
  addWarehouse: (warehouse: Partial<Warehouse>) => Promise<void>
  updateWarehouse: (id: string, updates: Partial<Warehouse>) => Promise<void>
  addSupplier: (supplier: Partial<Supplier>) => Promise<Supplier | null>
  addCategory: (category: Partial<Category>) => Promise<Category | null>
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  addBrand: (brand: Partial<Brand>) => Promise<Brand | null>
  updateBrand: (id: string, updates: Partial<Brand>) => Promise<void>
  deleteBrand: (id: string) => Promise<void>
  addCoupon: (coupon: Partial<Coupon>) => Promise<void>
  useCoupon: (id: string) => Promise<void>
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
  const [productStock, setProductStock] = useState<Map<string, StockByWarehouse[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const supabase = createClient()

  const refreshData = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Fetch all data in parallel
      const [productsRes, warehousesRes, movementsRes, couponsRes, stockRes, suppliersRes, categoriesRes, brandsRes] = await Promise.all([
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
      ])

      if (productsRes.error) throw productsRes.error
      if (warehousesRes.error) throw warehousesRes.error
      if (movementsRes.error) throw movementsRes.error
      if (couponsRes.error) throw couponsRes.error
      if (stockRes.error) throw stockRes.error
      if (suppliersRes.error) throw suppliersRes.error
      if (categoriesRes.error) throw categoriesRes.error
      if (brandsRes.error) throw brandsRes.error

      setProducts((productsRes.data || []).map(normalizeProduct))
      setWarehouses((warehousesRes.data || []).map(normalizeWarehouse))
      setMovements((movementsRes.data || []).map(normalizeMovement))
      setCoupons((couponsRes.data || []).map(normalizeCoupon))
      setSuppliers(suppliersRes.data || [])
      setCategories(categoriesRes.data || [])
      setBrands(brandsRes.data || [])
      
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

  // Load data on component mount
  useEffect(() => {
    refreshData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on component mount, not on refreshData changes

  const getProductById = useCallback((id: string) => {
    return products.find(p => p.id === id)
  }, [products])

  const getStockByWarehouse = useCallback((productId: string): StockByWarehouse[] => {
    return productStock.get(productId) || []
  }, [productStock])

  const addProduct = useCallback(async (product: Partial<Product>): Promise<Product | null> => {
    const insertData = {
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
    }
    
    const { data, error } = await supabase
      .from("products")
      .insert(insertData)
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
  ) => {
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
      return
    }
    
    await refreshData()
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

  return (
    <InventoryContext.Provider value={{
      products,
      warehouses,
      movements,
      coupons,
      suppliers,
      categories,
      brands,
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
      addSupplier,
      addCategory,
      updateCategory,
      deleteCategory,
      addBrand,
      updateBrand,
      deleteBrand,
      addCoupon,
      useCoupon,
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
