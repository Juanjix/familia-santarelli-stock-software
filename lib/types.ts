// ── Auth / Usuarios ────────────────────────────────────────

export interface Role {
  id: string
  name: string
  slug: "admin" | "manager" | "employee" | "readonly"
}

export interface ModulePermission {
  can_view:   boolean
  can_create: boolean
  can_edit:   boolean
  can_delete: boolean
}

export type PermissionMap = Record<string, ModulePermission>

export interface AppUser {
  id:           string
  auth_id:      string
  display_name: string
  email:        string
  is_active:    boolean
  last_seen_at: string | null
  warehouse_id: string | null
  employee_id:  string | null
  role:         Role
  permissions:  PermissionMap
}

export interface SessionLog {
  id:         string
  user_id:    string
  action:     "login" | "logout" | "token_refresh"
  user_agent: string | null
  ip_address: string | null
  created_at: string
}

// ── Módulo Sobres ──────────────────────────────────────────
export type EnvelopeStatus =
  | 'received'
  | 'quote_pending'
  | 'quote_approved'
  | 'in_workshop'
  | 'ready'
  | 'delivered'
  | 'cancelled'

export type QuoteStatus = 'not_required' | 'pending' | 'informed' | 'approved' | 'rejected'

export interface Customer {
  id: string
  first_name: string
  last_name: string
  dni: string
  phone: string | null
  address: string | null
  created_at: string
  updated_at: string
}

export type WorkerType = 'jeweler' | 'watchmaker'

export interface Jeweler {
  id: string
  name: string
  worker_type: WorkerType
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Employee {
  id: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface EnvelopeSubtype {
  id: string
  name: string
  product_type: 'jewelry' | 'watch'
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface Envelope {
  id: string
  number: string
  status: EnvelopeStatus
  customer_id: string
  received_at: string
  received_warehouse_id: string
  product_type: 'jewelry' | 'watch'
  product_subtype_id: string | null
  product_material: string | null
  product_material_detail: string | null
  product_weight: number | null
  current_warehouse_id: string | null
  product_condition: 'very_good' | 'good' | 'regular'
  product_condition_notes: string | null
  purchased_at_store: boolean
  purchase_date: string | null
  work_description: string
  quote_status: QuoteStatus
  quote_amount: number | null
  quote_notes: string | null
  quote_informed_at: string | null
  quote_approved_at: string | null
  jeweler_id: string | null
  received_by_employee_id: string | null
  estimated_ready_date: string | null
  delivered_at: string | null
  delivered_by: string | null
  delivery_notes: string | null
  internal_notes: string | null
  pending_transfer_to_warehouse_id: string | null
  pending_transfer_sent_by: string | null
  pending_transfer_sent_at: string | null
  created_at: string
  updated_at: string
  // Joined
  customer?: Customer
  received_warehouse?: { id: string; name: string }
  current_warehouse?: { id: string; name: string }
  pending_transfer_warehouse?: { id: string; name: string }
  jeweler?: Jeweler
  received_by_employee?: Employee
  product_subtype?: EnvelopeSubtype
}

export interface EnvelopeTransfer {
  id: string
  envelope_id: string
  from_warehouse_id: string | null
  to_warehouse_id: string
  sent_by: string
  sent_at: string
  received_by: string | null
  received_at: string | null
  status: 'in_transit' | 'received'
}

export interface EnvelopeStatusLog {
  id: string
  envelope_id: string
  from_status: EnvelopeStatus | null
  to_status: EnvelopeStatus
  changed_by: string
  notes: string | null
  created_at: string
}

export interface EnvelopeEvent {
  id: string
  envelope_id: string
  event_type: string
  title: string
  detail: string | null
  created_by: string
  created_at: string
}

export interface Supplier {
  id: string
  name: string
  contact: string | null
  price_group: string
  coefficient: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Brand {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// Define qué atributos adicionales requiere cada categoría (ej. Talle, Hilo, Largo)
export interface CategoryAttribute {
  id: string
  category_id: string
  key: string
  label: string
  input_type: 'text' | 'number'
  placeholder: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface Product {
  id: string
  sku: string
  barcode: string | null
  name: string
  description: string | null
  category: string
  category_id?: string | null
  material: string | null
  weight: number | null
  cost_price: number
  sell_price: number
  min_stock: number
  total_stock: number
  is_active: boolean
  supplier_id: string | null
  factory_code?: string | null
  internal_code?: string | null
  brand_id?: string | null
  attributes?: Record<string, string> | null
  created_at: string
  updated_at: string
  // Joined fields
  supplier?: Supplier
  category_obj?: Category
  brand?: Brand
  // Computed fields for UI compatibility
  stockStatus?: "in_stock" | "low_stock" | "out_of_stock"
  price?: number
  supplierName?: string
  categoryName?: string
  brandName?: string
  // Legacy camelCase aliases (mock data + legacy pages)
  isActive?: boolean
  totalStock?: number
  pricingType?: string
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
  customer_name: string | null
  customer_phone: string | null
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

export type Material = "Oro" | "Plata" | "Acero" | "Mixto"

// ── Módulo Transferencias de Stock ─────────────────────────────────────────
export type StockTransferStatus = 'in_transit' | 'completed' | 'with_differences' | 'cancelled'

export interface StockTransfer {
  id: string
  number: string
  from_warehouse_id: string
  to_warehouse_id: string
  status: StockTransferStatus
  created_by: string
  dispatched_at: string
  received_by: string | null
  received_at: string | null
  incident_notes: string | null
  created_at: string
  updated_at: string
  // Joined
  from_warehouse?: { id: string; name: string }
  to_warehouse?: { id: string; name: string }
  items?: StockTransferItem[]
}

export interface StockTransferItem {
  id: string
  transfer_id: string
  product_id: string
  quantity_sent: number
  quantity_received: number | null
  created_at: string
  // Joined
  product?: Product
}

export interface StockTransferEvent {
  id: string
  transfer_id: string
  event_type: string
  title: string
  detail: string | null
  created_by: string
  created_at: string
}

// Database response types
export interface Database {
  public: {
    Tables: {
      categories: {
        Row: Category
        Insert: Omit<Category, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Category, 'id' | 'created_at'>>
      }
      brands: {
        Row: Brand
        Insert: Omit<Brand, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Brand, 'id' | 'created_at'>>
      }
      suppliers: {
        Row: Supplier
        Insert: Omit<Supplier, 'id' | 'created_at'>
        Update: Partial<Omit<Supplier, 'id' | 'created_at'>>
      }
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
