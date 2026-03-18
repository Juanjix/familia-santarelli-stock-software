import type { Product, Warehouse, Movement, StockByWarehouse } from "./types"

export const warehouses: Warehouse[] = [
  { id: "1", name: "Shopping", description: "Local principal en el centro comercial", isActive: true, stockCount: 4250, totalValue: 1250000 },
  { id: "2", name: "Galería", description: "Sucursal en galería comercial", isActive: true, stockCount: 3180, totalValue: 890000 },
  { id: "3", name: "Depósito físico", description: "Almacén principal de reserva", isActive: true, stockCount: 5420, totalValue: 2100000 },
  { id: "4", name: "Caja fuerte", description: "Almacenamiento de alta seguridad", isActive: true, stockCount: 1850, totalValue: 3500000 },
  { id: "5", name: "Taller", description: "Taller de reparaciones y ajustes", isActive: true, stockCount: 320, totalValue: 45000 },
]

const categories = ["Anillos", "Collares", "Pulseras", "Aros", "Cadenas", "Relojes", "Accesorios"]
const materials = ["Oro", "Plata", "Acero", "Mixto"]
const pricingTypes = ["Fijo", "Base oro", "Base plata", "Base USD", "Por peso", "Personalizado"]
const stockStatuses = ["in_stock", "low_stock", "out_of_stock"] as const

const productNames: Record<string, string[]> = {
  Anillos: ["Alianza Clásica", "Solitario Brillante", "Anillo Infinito", "Banda Ondulada", "Trilogy Romance", "Signet Imperial", "Cintillo Eterno"],
  Collares: ["Cadena Veneciana", "Collar Princesa", "Gargantilla Delicada", "Colgante Corazón", "Collar Perlas", "Cadena Eslabones"],
  Pulseras: ["Pulsera Tennis", "Brazalete Rígido", "Esclava Clásica", "Pulsera Dijes", "Cuff Moderno", "Pulsera Eslabones"],
  Aros: ["Aros Criollos", "Aros Gota", "Abridores Diamante", "Argollas Huggie", "Aros Colgantes", "Aros Araña"],
  Cadenas: ["Cadena Rolo", "Eslabón Cubano", "Cadena Fígaro", "Cadena Serpiente", "Cadena Box", "Cadena Soga"],
  Relojes: ["Reloj Clásico", "Cronógrafo Deportivo", "Reloj Vestir", "Diver Profesional", "Skeleton Automático"],
  Accesorios: ["Gemelos Ejecutivos", "Alfiler Corbata", "Broche Vintage", "Porta Anillos", "Caja Joyería"],
}

function generateSKU(category: string, index: number): string {
  const prefix = category.substring(0, 3).toUpperCase()
  return `${prefix}-${String(index).padStart(5, "0")}`
}

function generateBarcode(): string {
  return `78${Math.random().toString().slice(2, 14)}`
}

function generateProducts(count: number): Product[] {
  const products: Product[] = []
  
  for (let i = 1; i <= count; i++) {
    const category = categories[Math.floor(Math.random() * categories.length)]
    const material = materials[Math.floor(Math.random() * materials.length)]
    const names = productNames[category]
    const baseName = names[Math.floor(Math.random() * names.length)]
    const variant = Math.floor(Math.random() * 100)
    
    const stockStatus = stockStatuses[Math.floor(Math.random() * 10) < 7 ? 0 : Math.floor(Math.random() * 10) < 9 ? 1 : 2]
    const totalStock = stockStatus === "out_of_stock" ? 0 : stockStatus === "low_stock" ? Math.floor(Math.random() * 5) + 1 : Math.floor(Math.random() * 50) + 5
    
    products.push({
      id: String(i),
      name: `${baseName} ${material} #${variant}`,
      sku: generateSKU(category, i),
      category,
      material,
      weight: parseFloat((Math.random() * 50 + 1).toFixed(2)),
      barcode: generateBarcode(),
      pricingType: pricingTypes[Math.floor(Math.random() * pricingTypes.length)],
      stockStatus,
      isActive: Math.random() > 0.1,
      totalStock,
      price: Math.floor(Math.random() * 50000) + 500,
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
  }
  
  return products
}

export const products: Product[] = generateProducts(100)

export function getProductById(id: string): Product | undefined {
  return products.find(p => p.id === id)
}

export function getStockByWarehouse(productId: string): StockByWarehouse[] {
  const product = getProductById(productId)
  if (!product) return []
  
  const totalStock = product.totalStock
  const activeWarehouses = warehouses.filter(w => w.isActive)
  const distribution: StockByWarehouse[] = []
  let remaining = totalStock
  
  activeWarehouses.forEach((warehouse, index) => {
    if (index === activeWarehouses.length - 1) {
      distribution.push({
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        quantity: remaining,
      })
    } else {
      const qty = Math.floor(Math.random() * (remaining / 2))
      distribution.push({
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        quantity: qty,
      })
      remaining -= qty
    }
  })
  
  return distribution.filter(d => d.quantity > 0)
}

export const recentMovements: Movement[] = [
  { id: "1", productId: "1", productName: "Alianza Clásica Oro #42", type: "entry", quantity: 10, toWarehouse: "Shopping", date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), user: "María García" },
  { id: "2", productId: "15", productName: "Collar Princesa Plata #18", type: "exit", quantity: 1, fromWarehouse: "Galería", date: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), user: "Carlos Ruiz", notes: "Venta directa" },
  { id: "3", productId: "8", productName: "Pulsera Tennis Oro #55", type: "transfer", quantity: 5, fromWarehouse: "Depósito físico", toWarehouse: "Shopping", date: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), user: "Ana López" },
  { id: "4", productId: "22", productName: "Aros Criollos Oro #12", type: "adjustment", quantity: -2, fromWarehouse: "Caja fuerte", date: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), user: "Pedro Martínez", notes: "Ajuste de inventario" },
  { id: "5", productId: "31", productName: "Cadena Rolo Plata #88", type: "entry", quantity: 25, toWarehouse: "Depósito físico", date: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), user: "María García" },
  { id: "6", productId: "45", productName: "Reloj Clásico Acero #33", type: "exit", quantity: 1, fromWarehouse: "Shopping", date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), user: "Carlos Ruiz", notes: "Venta online" },
  { id: "7", productId: "52", productName: "Gemelos Ejecutivos Acero #7", type: "transfer", quantity: 3, fromWarehouse: "Galería", toWarehouse: "Taller", date: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(), user: "Ana López", notes: "Para grabado" },
]

export const dashboardStats = {
  totalProducts: 15243,
  totalUnits: 15020,
  estimatedValue: 7785000,
  lowStockAlerts: 127,
  stockByCategory: [
    { category: "Anillos", count: 3842, percentage: 25.2 },
    { category: "Collares", count: 2891, percentage: 19.0 },
    { category: "Pulseras", count: 2134, percentage: 14.0 },
    { category: "Aros", count: 2745, percentage: 18.0 },
    { category: "Cadenas", count: 1823, percentage: 12.0 },
    { category: "Relojes", count: 1024, percentage: 6.7 },
    { category: "Accesorios", count: 784, percentage: 5.1 },
  ],
  stockByWarehouse: warehouses.map(w => ({
    warehouse: w.name,
    count: w.stockCount,
    value: w.totalValue,
    percentage: ((w.stockCount / 15020) * 100).toFixed(1),
  })),
}
