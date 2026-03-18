"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Product, Warehouse, Movement, StockByWarehouse, Coupon } from "./types"

// Helper to normalize product for UI
function normalizeProduct(p: Product): Product {
  return {
    ...p,
    stockStatus: p.total_stock === 0 ? "out_of_stock" : p.total_stock < (p.min_stock || 5) ? "low_stock" : "in_stock",
    price: p.sell_price,
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
  addCoupon: (coupon: Partial<Coupon>) => Promise<void>
  useCoupon: (id: string) => Promise<void>
}

const InventoryContext = createContext<InventoryContextType | null>(null)

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [productStock, setProductStock] = useState<Map<string, StockByWarehouse[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const supabase = createClient()

  const refreshData = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Fetch all data in parallel
      const [productsRes, warehousesRes, movementsRes, couponsRes, stockRes] = await Promise.all([
        supabase.from("products").select("*").order("created_at", { ascending: false }),
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
      ])

      if (productsRes.error) throw productsRes.error
      if (warehousesRes.error) throw warehousesRes.error
      if (movementsRes.error) throw movementsRes.error
      if (couponsRes.error) throw couponsRes.error
      if (stockRes.error) throw stockRes.error

      setProducts((productsRes.data || []).map(normalizeProduct))
      setWarehouses((warehousesRes.data || []).map(normalizeWarehouse))
      setMovements((movementsRes.data || []).map(normalizeMovement))
      setCoupons((couponsRes.data || []).map(normalizeCoupon))
      
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
      })
      .select()
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

  return (
    <InventoryContext.Provider value={{
      products,
      warehouses,
      movements,
      coupons,
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
