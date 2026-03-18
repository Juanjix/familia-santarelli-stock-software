export interface Product {
  id: string
  sku: string
  barcode: string | null
  name: string
  description: string | null
  category: string
  material: string | null
  weight: number | null
  cost_price: number
  sell_price: number
  min_stock: number
  total_stock: number
  is_active: boolean
  created_at: string
  updated_at: string
  // Computed fields for UI compatibility
  stockStatus?: "in_stock" | "low_stock" | "out_of_stock"
  price?: number
}

export interface Warehouse {
  id: string
  name: string
  description: string | null
  is_active: boolean
  stock_count: number
  total_value: number
  created_at?: string
  updated_at?: string
  // Camel case aliases for UI compatibility
  isActive?: boolean
  stockCount?: number
  totalValue?: number
}

export interface ProductStock {
  id: string
  product_id: string
  warehouse_id: string
  quantity: number
  created_at: string
  updated_at: string
}

export interface StockByWarehouse {
  warehouseId: string
  warehouseName: string
  quantity: number
}

export interface Movement {
  id: string
  product_id: string
  warehouse_id: string | null
  to_warehouse_id: string | null
  type: "entry" | "exit" | "transfer" | "adjustment"
  quantity: number
  reason: string | null
  user_name: string
  created_at: string
  // Joined fields
  product?: Product
  warehouse?: Warehouse
  to_warehouse?: Warehouse
  // UI compatibility
  productId?: string
  productName?: string
  fromWarehouse?: string
  toWarehouse?: string
  date?: string
  user?: string
  notes?: string
}

export interface Coupon {
  id: string
  code: string
  original_product_id: string | null
  amount: number
  is_used: boolean
  used_at: string | null
  used_for_product_id: string | null
  expires_at: string | null
  notes: string | null
  created_at: string
  // Joined fields
  original_product?: Product
  used_for_product?: Product
  // UI compatibility
  productId?: string
  productName?: string
  value?: number
  status?: "active" | "used" | "expired"
  createdAt?: string
  usedAt?: string
  expiresAt?: string
}

export type Category = "Anillos" | "Collares" | "Pulseras" | "Aros" | "Cadenas" | "Relojes" | "Accesorios"

export type Material = "Oro" | "Plata" | "Acero" | "Mixto"

// Database response types
export interface Database {
  public: {
    Tables: {
      products: {
        Row: Product
        Insert: Omit<Product, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Product, 'id' | 'created_at'>>
      }
      warehouses: {
        Row: Warehouse
        Insert: Omit<Warehouse, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Warehouse, 'id' | 'created_at'>>
      }
      product_stock: {
        Row: ProductStock
        Insert: Omit<ProductStock, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ProductStock, 'id' | 'created_at'>>
      }
      movements: {
        Row: Movement
        Insert: Omit<Movement, 'id' | 'created_at'>
        Update: Partial<Omit<Movement, 'id' | 'created_at'>>
      }
      coupons: {
        Row: Coupon
        Insert: Omit<Coupon, 'id' | 'created_at'>
        Update: Partial<Omit<Coupon, 'id' | 'created_at'>>
      }
    }
  }
}
