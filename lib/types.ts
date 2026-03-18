export interface Product {
  id: string
  name: string
  sku: string
  category: string
  material: string
  weight: number
  barcode: string
  pricingType: string
  stockStatus: "in_stock" | "low_stock" | "out_of_stock"
  isActive: boolean
  totalStock: number
  price: number
  createdAt: string
  updatedAt: string
}

export interface Warehouse {
  id: string
  name: string
  description: string
  isActive: boolean
  stockCount: number
  totalValue: number
}

export interface StockByWarehouse {
  warehouseId: string
  warehouseName: string
  quantity: number
}

export interface Movement {
  id: string
  productId: string
  productName: string
  type: "entry" | "exit" | "transfer" | "adjustment"
  quantity: number
  fromWarehouse?: string
  toWarehouse?: string
  date: string
  user: string
  notes?: string
}

export type Category = "Rings" | "Necklaces" | "Bracelets" | "Earrings" | "Chains" | "Watches" | "Accessories"

export type Material = "Gold" | "Silver" | "Steel" | "Mixed"

export type PricingType = "Fixed" | "Gold-based" | "Silver-based" | "USD-based" | "Weight-based" | "Custom"
