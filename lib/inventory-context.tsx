"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import { products as initialProducts, warehouses as initialWarehouses, recentMovements as initialMovements } from "./mock-data"
import type { Product, Warehouse, Movement, StockByWarehouse } from "./types"

export interface Coupon {
  id: string
  code: string
  productId: string
  productName: string
  value: number
  status: "active" | "used" | "expired"
  createdAt: string
  usedAt?: string
  expiresAt: string
}

interface InventoryContextType {
  products: Product[]
  warehouses: Warehouse[]
  movements: Movement[]
  coupons: Coupon[]
  addProduct: (product: Omit<Product, "id" | "createdAt" | "updatedAt">) => void
  updateProduct: (id: string, updates: Partial<Product>) => void
  deleteProduct: (id: string) => void
  toggleProductStatus: (id: string) => void
  adjustStock: (productId: string, warehouseId: string, quantity: number, type: "in" | "out" | "adjustment", notes?: string) => void
  transferStock: (productId: string, fromWarehouseId: string, toWarehouseId: string, quantity: number, notes?: string) => void
  getStockByWarehouse: (productId: string) => StockByWarehouse[]
  getProductById: (id: string) => Product | undefined
  addWarehouse: (warehouse: Omit<Warehouse, "id">) => void
  updateWarehouse: (id: string, updates: Partial<Warehouse>) => void
  addCoupon: (coupon: Omit<Coupon, "id" | "createdAt">) => void
  useCoupon: (id: string) => void
}

const InventoryContext = createContext<InventoryContextType | null>(null)

// Generate initial stock distribution for products
function generateInitialStockDistribution(products: Product[], warehouses: Warehouse[]): Map<string, Map<string, number>> {
  const stockMap = new Map<string, Map<string, number>>()
  
  products.forEach(product => {
    const productStock = new Map<string, number>()
    let remaining = product.totalStock
    const activeWarehouses = warehouses.filter(w => w.isActive)
    
    activeWarehouses.forEach((warehouse, index) => {
      if (index === activeWarehouses.length - 1) {
        productStock.set(warehouse.id, remaining)
      } else {
        const qty = Math.floor(Math.random() * (remaining / 2))
        productStock.set(warehouse.id, qty)
        remaining -= qty
      }
    })
    
    stockMap.set(product.id, productStock)
  })
  
  return stockMap
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses)
  const [movements, setMovements] = useState<Movement[]>(initialMovements)
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [stockDistribution, setStockDistribution] = useState<Map<string, Map<string, number>>>(() => 
    generateInitialStockDistribution(initialProducts, initialWarehouses)
  )

  const getProductById = useCallback((id: string) => {
    return products.find(p => p.id === id)
  }, [products])

  const getStockByWarehouse = useCallback((productId: string): StockByWarehouse[] => {
    const productStock = stockDistribution.get(productId)
    if (!productStock) return []
    
    const result: StockByWarehouse[] = []
    productStock.forEach((quantity, warehouseId) => {
      const warehouse = warehouses.find(w => w.id === warehouseId)
      if (warehouse && quantity > 0) {
        result.push({
          warehouseId,
          warehouseName: warehouse.name,
          quantity,
        })
      }
    })
    return result
  }, [stockDistribution, warehouses])

  const addProduct = useCallback((product: Omit<Product, "id" | "createdAt" | "updatedAt">) => {
    const newProduct: Product = {
      ...product,
      id: String(Date.now()),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setProducts(prev => [newProduct, ...prev])
    
    // Initialize stock distribution for new product
    const newStockMap = new Map(stockDistribution)
    const productStock = new Map<string, number>()
    warehouses.filter(w => w.isActive).forEach(w => productStock.set(w.id, 0))
    newStockMap.set(newProduct.id, productStock)
    setStockDistribution(newStockMap)
  }, [stockDistribution, warehouses])

  const updateProduct = useCallback((id: string, updates: Partial<Product>) => {
    setProducts(prev => prev.map(p => 
      p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
    ))
  }, [])

  const deleteProduct = useCallback((id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id))
    const newStockMap = new Map(stockDistribution)
    newStockMap.delete(id)
    setStockDistribution(newStockMap)
  }, [stockDistribution])

  const toggleProductStatus = useCallback((id: string) => {
    setProducts(prev => prev.map(p => 
      p.id === id ? { ...p, isActive: !p.isActive, updatedAt: new Date().toISOString() } : p
    ))
  }, [])

  const addMovement = useCallback((movement: Omit<Movement, "id" | "date">) => {
    const newMovement: Movement = {
      ...movement,
      id: String(Date.now()),
      date: new Date().toISOString(),
    }
    setMovements(prev => [newMovement, ...prev])
  }, [])

  const adjustStock = useCallback((productId: string, warehouseId: string, quantity: number, type: "in" | "out" | "adjustment", notes?: string) => {
    const product = products.find(p => p.id === productId)
    const warehouse = warehouses.find(w => w.id === warehouseId)
    if (!product || !warehouse) return

    const newStockMap = new Map(stockDistribution)
    const productStock = new Map(newStockMap.get(productId) || new Map())
    const currentQty = productStock.get(warehouseId) || 0
    const newQty = type === "out" ? Math.max(0, currentQty - quantity) : currentQty + quantity
    productStock.set(warehouseId, newQty)
    newStockMap.set(productId, productStock)
    setStockDistribution(newStockMap)

    // Update total stock
    let totalStock = 0
    productStock.forEach(qty => totalStock += qty)
    updateProduct(productId, { 
      totalStock,
      stockStatus: totalStock === 0 ? "out_of_stock" : totalStock < 5 ? "low_stock" : "in_stock"
    })

    // Record movement
    addMovement({
      productId,
      productName: product.name,
      type: type === "in" ? "entry" : type === "out" ? "exit" : "adjustment",
      quantity: type === "out" ? -quantity : quantity,
      fromWarehouse: type === "out" || type === "adjustment" ? warehouse.name : undefined,
      toWarehouse: type === "in" ? warehouse.name : undefined,
      user: "Usuario",
      notes,
    })
  }, [products, warehouses, stockDistribution, updateProduct, addMovement])

  const transferStock = useCallback((productId: string, fromWarehouseId: string, toWarehouseId: string, quantity: number, notes?: string) => {
    const product = products.find(p => p.id === productId)
    const fromWarehouse = warehouses.find(w => w.id === fromWarehouseId)
    const toWarehouse = warehouses.find(w => w.id === toWarehouseId)
    if (!product || !fromWarehouse || !toWarehouse) return

    const newStockMap = new Map(stockDistribution)
    const productStock = new Map(newStockMap.get(productId) || new Map())
    
    const fromQty = productStock.get(fromWarehouseId) || 0
    const toQty = productStock.get(toWarehouseId) || 0
    
    if (fromQty < quantity) return // Not enough stock
    
    productStock.set(fromWarehouseId, fromQty - quantity)
    productStock.set(toWarehouseId, toQty + quantity)
    newStockMap.set(productId, productStock)
    setStockDistribution(newStockMap)

    // Record movement
    addMovement({
      productId,
      productName: product.name,
      type: "transfer",
      quantity,
      fromWarehouse: fromWarehouse.name,
      toWarehouse: toWarehouse.name,
      user: "Usuario",
      notes,
    })
  }, [products, warehouses, stockDistribution, addMovement])

  const addWarehouse = useCallback((warehouse: Omit<Warehouse, "id">) => {
    const newWarehouse: Warehouse = {
      ...warehouse,
      id: String(Date.now()),
    }
    setWarehouses(prev => [...prev, newWarehouse])
  }, [])

  const updateWarehouse = useCallback((id: string, updates: Partial<Warehouse>) => {
    setWarehouses(prev => prev.map(w => 
      w.id === id ? { ...w, ...updates } : w
    ))
  }, [])

  const addCoupon = useCallback((coupon: Omit<Coupon, "id" | "createdAt">) => {
    const newCoupon: Coupon = {
      ...coupon,
      id: String(Date.now()),
      createdAt: new Date().toISOString(),
    }
    setCoupons(prev => [newCoupon, ...prev])
  }, [])

  const useCoupon = useCallback((id: string) => {
    setCoupons(prev => prev.map(c => 
      c.id === id ? { ...c, status: "used" as const, usedAt: new Date().toISOString() } : c
    ))
  }, [])

  return (
    <InventoryContext.Provider value={{
      products,
      warehouses,
      movements,
      coupons,
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
