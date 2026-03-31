import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const products = [
  {
    sku: "SKU-001",
    barcode: "4891234567890",
    name: "Anillo Solitario Oro 18K",
    description: "Hermoso anillo solitario con diamante natural de 0.50 quilates",
    category: "Anillos",
    material: "Oro",
    weight: 5.2,
    cost_price: 1500.0,
    sell_price: 3200.0,
    min_stock: 3,
    total_stock: 0,
    is_active: true,
  },
  {
    sku: "SKU-002",
    barcode: "4891234567891",
    name: "Collar Perla Australiana",
    description: "Elegante collar con perla australiana de 12mm y cadena de plata",
    category: "Collares",
    material: "Plata",
    weight: 8.5,
    cost_price: 800.0,
    sell_price: 1800.0,
    min_stock: 2,
    total_stock: 0,
    is_active: true,
  },
  {
    sku: "SKU-003",
    barcode: "4891234567892",
    name: "Pulsera de Zafiros",
    description: "Pulsera con zafiros azules naturales engastados en oro blanco",
    category: "Pulseras",
    material: "Oro",
    weight: 12.3,
    cost_price: 2000.0,
    sell_price: 4500.0,
    min_stock: 2,
    total_stock: 0,
    is_active: true,
  },
  {
    sku: "SKU-004",
    barcode: "4891234567893",
    name: "Aros Brillantes Diamante",
    description: "Aros clásicos con diamantes de 0.30 quilates cada uno",
    category: "Aros",
    material: "Oro",
    weight: 3.8,
    cost_price: 1200.0,
    sell_price: 2600.0,
    min_stock: 4,
    total_stock: 0,
    is_active: true,
  },
  {
    sku: "SKU-005",
    barcode: "4891234567894",
    name: "Cadena Eslabón Fuerte Plata",
    description: "Cadena de eslabones fuertes en plata 925 de 60cm de largo",
    category: "Cadenas",
    material: "Plata",
    weight: 25.0,
    cost_price: 400.0,
    sell_price: 950.0,
    min_stock: 5,
    total_stock: 0,
    is_active: true,
  },
  {
    sku: "SKU-006",
    barcode: "4891234567895",
    name: "Reloj de Lujo Oro Rosa",
    description: "Reloj suizo con maquinaria automática, caja de oro rosa 18K",
    category: "Relojes",
    material: "Oro",
    weight: 95.0,
    cost_price: 5000.0,
    sell_price: 12000.0,
    min_stock: 1,
    total_stock: 0,
    is_active: true,
  },
  {
    sku: "SKU-007",
    barcode: "4891234567896",
    name: "Broche de Esmeralda Colombiana",
    description: "Broche vintage con esmeralda colombiana genuina de 2 quilates",
    category: "Accesorios",
    material: "Oro",
    weight: 7.5,
    cost_price: 2500.0,
    sell_price: 6500.0,
    min_stock: 1,
    total_stock: 0,
    is_active: true,
  },
  {
    sku: "SKU-008",
    barcode: "4891234567897",
    name: "Anillo Compromiso con Halo",
    description: "Anillo de compromiso con diamante central 1 quilate y halo de diamantes",
    category: "Anillos",
    material: "Oro",
    weight: 8.2,
    cost_price: 4500.0,
    sell_price: 9800.0,
    min_stock: 1,
    total_stock: 0,
    is_active: true,
  },
  {
    sku: "SKU-009",
    barcode: "4891234567898",
    name: "Pulsera de Rubíes y Perlas",
    description: "Pulsera alternada con rubíes naturales de Birmania y perlas de agua dulce",
    category: "Pulseras",
    material: "Oro",
    weight: 15.0,
    cost_price: 2200.0,
    sell_price: 5200.0,
    min_stock: 2,
    total_stock: 0,
    is_active: true,
  },
  {
    sku: "SKU-010",
    barcode: "4891234567899",
    name: "Collar Topacio Azul Príncipe",
    description: "Collar con topacio azul príncipe de 15 quilates en cadena de oro",
    category: "Collares",
    material: "Oro",
    weight: 18.5,
    cost_price: 1800.0,
    sell_price: 4200.0,
    min_stock: 2,
    total_stock: 0,
    is_active: true,
  },
];

async function addProducts() {
  try {
    console.log("Starting to add 10 jewelry products...");

    const { data, error } = await supabase.from("products").insert(products).select();

    if (error) {
      console.error("Error inserting products:", error);
      process.exit(1);
    }

    console.log(`Successfully inserted ${data.length} products:`);
    data.forEach((p) => {
      console.log(`  - ${p.name} (SKU: ${p.sku})`);
    });

    process.exit(0);
  } catch (err) {
    console.error("Unexpected error:", err);
    process.exit(1);
  }
}

addProducts();
