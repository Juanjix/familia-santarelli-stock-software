"use client"

import { useState, useEffect, useCallback } from "react"
import { useInventory } from "@/lib/inventory-context"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Mail,
  Plus,
  Search,
  ChevronRight,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  Wrench,
  PackageCheck,
  HelpCircle,
  Printer,
  Pencil,
  MapPin,
} from "lucide-react"
import type { Envelope, EnvelopeStatus, EnvelopeEvent, QuoteStatus, Employee } from "@/lib/types"

// ── Status helpers ──────────────────────────────────────────────────────────

const STATUS_LABELS: Record<EnvelopeStatus, string> = {
  received: "Recibido",
  quote_pending: "Presupuesto pendiente",
  quote_approved: "Presupuesto aprobado",
  in_workshop: "En taller",
  ready: "Listo para entrega",
  delivered: "Entregado",
  cancelled: "Cancelado",
}

const STATUS_COLORS: Record<EnvelopeStatus, string> = {
  received: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  quote_pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  quote_approved: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  in_workshop: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  ready: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  delivered: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
}

const STATUS_ICON: Record<EnvelopeStatus, React.ReactNode> = {
  received: <Mail className="h-3.5 w-3.5" />,
  quote_pending: <HelpCircle className="h-3.5 w-3.5" />,
  quote_approved: <CheckCircle2 className="h-3.5 w-3.5" />,
  in_workshop: <Wrench className="h-3.5 w-3.5" />,
  ready: <PackageCheck className="h-3.5 w-3.5" />,
  delivered: <CheckCircle2 className="h-3.5 w-3.5" />,
  cancelled: <XCircle className="h-3.5 w-3.5" />,
}

const NEXT_STATUSES: Partial<Record<EnvelopeStatus, EnvelopeStatus[]>> = {
  received: ["quote_pending", "in_workshop", "cancelled"],
  quote_pending: ["quote_approved", "cancelled"],
  quote_approved: ["in_workshop", "cancelled"],
  in_workshop: ["ready", "cancelled"],
  ready: ["delivered"],
}

type ActiveAction =
  | null
  | "send_to_jeweler"
  | "receive_from_jeweler"
  | "transfer"
  | "request_quote"
  | "inform_quote"
  | "approve_quote"
  | "reject_quote"
  | "deliver"
  | "cancel_envelope"

const ACTION_CONFIG: Record<
  Exclude<ActiveAction, null>,
  { label: string; icon: string; variant: "default" | "outline" | "destructive" }
> = {
  send_to_jeweler:      { label: "Enviar a Joyero",       icon: "🔧", variant: "default" },
  receive_from_jeweler: { label: "Recibir de Joyero",     icon: "📬", variant: "default" },
  transfer:             { label: "Transferir",             icon: "🏪", variant: "outline" },
  request_quote:        { label: "Solicitar presupuesto",  icon: "💬", variant: "outline" },
  inform_quote:         { label: "Informar presupuesto",   icon: "💰", variant: "default" },
  approve_quote:        { label: "Aprobar presupuesto",    icon: "✅", variant: "default" },
  reject_quote:         { label: "Rechazar presupuesto",   icon: "🚫", variant: "outline" },
  deliver:              { label: "Entregar al cliente",    icon: "🤝", variant: "default" },
  cancel_envelope:      { label: "Cancelar sobre",         icon: "❌", variant: "destructive" },
}

// Acciones que pertenecen a la gestión de presupuesto (renderizadas en su propia tarjeta)
const QUOTE_ACTIONS: Exclude<ActiveAction, null>[] = ["request_quote", "inform_quote", "approve_quote", "reject_quote"]

function getAvailableActions(envelope: Envelope): Exclude<ActiveAction, null>[] {
  const a: Exclude<ActiveAction, null>[] = []
  switch (envelope.status) {
    case "received":
      a.push("request_quote", "send_to_jeweler", "transfer", "cancel_envelope")
      break
    case "quote_pending":
      if (envelope.quote_status === "pending") a.push("inform_quote")
      if (envelope.quote_status === "informed") a.push("approve_quote", "reject_quote")
      a.push("transfer", "cancel_envelope")
      break
    case "quote_approved":
      a.push("send_to_jeweler", "transfer", "cancel_envelope")
      break
    case "in_workshop":
      a.push("receive_from_jeweler", "transfer", "cancel_envelope")
      break
    case "ready":
      a.push("deliver", "transfer")
      break
  }
  return a
}

const STATUS_EMOJI: Record<EnvelopeStatus, string> = {
  received:      "📬",
  quote_pending: "💬",
  quote_approved:"✅",
  in_workshop:   "🔧",
  ready:         "📦",
  delivered:     "🤝",
  cancelled:     "❌",
}

const STATUS_CARD_COLORS: Record<EnvelopeStatus, string> = {
  received:      "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30",
  quote_pending: "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30",
  quote_approved:"border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30",
  in_workshop:   "border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/30",
  ready:         "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30",
  delivered:     "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/30",
  cancelled:     "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30",
}

const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  not_required: "No requerido",
  pending: "Pendiente",
  informed: "Informado",
  approved: "Aprobado",
  rejected: "Rechazado",
}

const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  not_required: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  informed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
}

const CONDITION_LABELS: Record<string, string> = {
  very_good: "Muy bueno",
  good: "Bueno",
  regular: "Regular",
}

const MATERIAL_OPTIONS = ["ORO", "PLATA", "COBRE", "OTROS"] as const
type MaterialOption = typeof MATERIAL_OPTIONS[number]
const MATERIAL_LABELS: Record<MaterialOption, string> = {
  ORO: "Oro", PLATA: "Plata", COBRE: "Cobre", OTROS: "Otros",
}

// Devuelve etiqueta legible para el material, con retrocompat para texto libre legado
function getMaterialDisplay(material: string | null, detail: string | null): string {
  if (!material) return "—"
  const known = MATERIAL_LABELS[material as MaterialOption]
  if (known) return material === "OTROS" && detail ? `Otros (${detail})` : known
  // Valor legado (texto libre pre-migración): mostrar como "Otros (valor)"
  return `Otros (${material})`
}

// Para pre-llenar el selector en modo edición a partir de un valor legado
function parseMaterialForEdit(material: string | null, detail: string | null): { option: string; customDetail: string } {
  if (!material) return { option: "", customDetail: "" }
  if (MATERIAL_LABELS[material as MaterialOption]) {
    return { option: material, customDetail: detail || "" }
  }
  // Legado: mapear texto libre → OTROS con el valor como detalle
  return { option: "OTROS", customDetail: material }
}

function StatusBadge({ status }: { status: EnvelopeStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}>
      {STATUS_ICON[status]}
      {STATUS_LABELS[status]}
    </span>
  )
}

function QuoteBadge({ status }: { status: QuoteStatus }) {
  if (status === "not_required") return null
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${QUOTE_STATUS_COLORS[status]}`}>
      Presupuesto: {QUOTE_STATUS_LABELS[status]}
    </span>
  )
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
}

function daysElapsed(dateStr: string | null | undefined): number {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
}

function elapsedLabel(days: number): string {
  if (days === 0) return "Hoy"
  if (days === 1) return "Hace 1 día"
  return `Hace ${days} días`
}

function elapsedBadgeColor(status: EnvelopeStatus, days: number): string {
  if (status === "in_workshop" || status === "ready") {
    if (days <= 7) return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
    if (days <= 14) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400"
    return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
  }
  return "bg-muted text-muted-foreground"
}

// Devuelve la ubicación actual legible del sobre
function getEnvelopeLocation(envelope: Envelope): string {
  if (envelope.status === "delivered") return "Entregado"
  if (envelope.status === "cancelled") return "Cancelado"
  if (envelope.status === "in_workshop") {
    return envelope.jeweler?.name ? `Taller — ${envelope.jeweler.name}` : "En taller"
  }
  // Usar current_warehouse si está seteado, sino caer a received_warehouse
  return envelope.current_warehouse?.name || envelope.received_warehouse?.name || "—"
}

// Emoji / icono por tipo de evento
const EVENT_ICONS: Record<string, string> = {
  envelope_created: "📦",
  status_changed: "🔄",
  jeweler_assigned: "👨‍🔧",
  jeweler_changed: "🔁",
  jeweler_removed: "❌",
  quote_updated: "💰",
  location_transfer: "🏪",
}

// ── Print ───────────────────────────────────────────────────────────────────

function printEnvelope(envelope: Envelope) {
  const c = envelope.customer
  const fullName = c ? `${c.last_name}, ${c.first_name}` : "—"
  const subtype = envelope.product_subtype?.name || ""
  const type = envelope.product_type === "jewelry" ? "Joyería" : "Relojería"
  const condition = CONDITION_LABELS[envelope.product_condition] || envelope.product_condition
  const quoteLabel = QUOTE_STATUS_LABELS[envelope.quote_status]
  const warehouse = envelope.received_warehouse?.name || "—"
  const articleLine = `${type}${subtype ? ` — ${subtype}` : ""}`
  const materialLine = envelope.product_material
    ? `${getMaterialDisplay(envelope.product_material, envelope.product_material_detail)}${envelope.product_material === "ORO" && envelope.product_weight != null ? ` · ${envelope.product_weight}g` : ""}`
    : null

  // Bloque de datos compartido entre ambas copias (cliente e interna)
  const baseFields = `
    <div class="section">
      <div class="section-title">Cliente</div>
      <div class="row"><span class="label">Nombre</span><span class="value">${fullName}</span></div>
      <div class="row"><span class="label">DNI</span><span class="value">${c?.dni || "—"}</span></div>
      ${c?.address ? `<div class="row"><span class="label">Domicilio</span><span class="value">${c.address}</span></div>` : ""}
      ${c?.phone ? `<div class="row"><span class="label">Teléfono</span><span class="value">${c.phone}</span></div>` : ""}
    </div>
    <div class="divider"></div>
    <div class="section">
      <div class="section-title">Artículo</div>
      <div class="row"><span class="label">Tipo</span><span class="value">${articleLine}</span></div>
      ${materialLine ? `<div class="row"><span class="label">Material</span><span class="value">${materialLine}</span></div>` : ""}
      <div class="row"><span class="label">Estado</span><span class="value">${condition}</span></div>
      ${envelope.product_condition_notes ? `<div class="row"><span class="label">Obs.</span><span class="value">${envelope.product_condition_notes}</span></div>` : ""}
    </div>
    <div class="divider"></div>
    <div class="section work-section">
      <div class="section-title">Trabajo solicitado</div>
      <div class="work-text">${envelope.work_description}</div>
    </div>
    <div class="divider"></div>
    <div class="section">
      <div class="section-title">Presupuesto</div>
      <div class="row"><span class="label">Estado</span><span class="value">${quoteLabel}</span></div>
      ${envelope.quote_amount != null ? `<div class="row"><span class="label">Monto</span><span class="value">$${envelope.quote_amount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span></div>` : ""}
    </div>
    <div class="divider"></div>
    <div class="section">
      <div class="section-title">Recepción</div>
      <div class="row"><span class="label">Local</span><span class="value">${warehouse}</span></div>
      <div class="row"><span class="label">Recibido por</span><span class="value">${envelope.received_by_employee?.name || "—"}</span></div>
      <div class="row"><span class="label">Fecha</span><span class="value">${formatDate(envelope.received_at)}</span></div>
      ${envelope.estimated_ready_date ? `<div class="row"><span class="label">Fecha estimada</span><span class="value">${formatDate(envelope.estimated_ready_date)}</span></div>` : ""}
    </div>
  `

  const customerCopy = `
    <div class="copy">
      <div class="copy-header">
        <div class="brand">FAMILIA SANTARELLI</div>
        <div class="copy-sub">Comprobante de Recepción</div>
      </div>
      <div class="copy-number">${envelope.number}</div>
      ${baseFields}
      <div class="signature">
        <div class="signature-line"></div>
        <div class="signature-label">Firma del cliente</div>
      </div>
    </div>
  `

  const internalCopy = `
    <div class="copy">
      <div class="copy-header">
        <div class="brand">FAMILIA SANTARELLI</div>
        <div class="copy-sub">Copia interna</div>
      </div>
      <div class="copy-number">${envelope.number}</div>
      ${baseFields}
      ${envelope.quote_notes ? `<div class="divider"></div><div class="section"><div class="section-title">Detalle presupuesto</div><div class="row-text">${envelope.quote_notes}</div></div>` : ""}
      ${envelope.jeweler || envelope.internal_notes ? `<div class="divider"></div><div class="section">
        <div class="section-title">Operativo</div>
        ${envelope.jeweler ? `<div class="row"><span class="label">Joyero</span><span class="value">${envelope.jeweler.name}</span></div>` : ""}
        ${envelope.internal_notes ? `<div class="row-text">${envelope.internal_notes}</div>` : ""}
      </div>` : ""}
    </div>
  `

  const html = `<!DOCTYPE html><html><head>
    <meta charset="UTF-8"><title>Sobre ${envelope.number}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      @page { size: 105mm 148mm; margin: 0; }
      body { font-family: Arial, sans-serif; font-size: 8pt; color: #111; }
      .copy {
        width: 105mm;
        min-height: 148mm;
        padding: 5mm;
        page-break-after: always;
        display: flex;
        flex-direction: column;
        gap: 1.6mm;
      }
      .copy:last-child { page-break-after: avoid; }
      .copy-header { text-align: center; }
      .brand { font-size: 12pt; font-weight: bold; letter-spacing: 0.5px; }
      .copy-sub { font-size: 7.5pt; color: #555; margin-top: 0.5mm; }
      .copy-number {
        font-family: monospace;
        font-size: 24pt;
        font-weight: bold;
        text-align: center;
        letter-spacing: 1px;
        margin: 1.5mm 0 2mm;
        padding: 1.5mm 0;
        border: 1.2px solid #000;
        border-radius: 1.5mm;
      }
      .divider { border-top: 0.5px solid #bbb; margin: 0.3mm 0; }
      .section-title { font-size: 6.8pt; text-transform: uppercase; letter-spacing: 0.4px; color: #777; font-weight: bold; margin-bottom: 0.6mm; }
      .row { display: flex; gap: 2mm; align-items: baseline; }
      .label { font-size: 6.8pt; text-transform: uppercase; letter-spacing: 0.2px; color: #666; min-width: 19mm; flex-shrink: 0; }
      .value { font-size: 8.3pt; font-weight: 600; word-break: break-word; }
      .row-text { font-size: 8pt; white-space: pre-wrap; }
      .work-section { flex: 1 0 auto; }
      .work-text {
        font-size: 8.3pt;
        border: 0.5px solid #bbb;
        border-radius: 1mm;
        padding: 1.5mm 2mm;
        min-height: 16mm;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .signature { margin-top: auto; padding-top: 3mm; text-align: center; }
      .signature-line { border-top: 0.7px solid #000; margin: 0 4mm; }
      .signature-label { font-size: 7pt; color: #555; margin-top: 1mm; }
    </style>
    </head><body>
    ${customerCopy}
    ${internalCopy}
    <script>window.print();</script>
    </body></html>`

  const win = window.open("", "_blank")
  if (!win) return
  win.document.write(html)
  win.document.close()
}

// ── Wizard ──────────────────────────────────────────────────────────────────

type WizardStep = "customer" | "product" | "work" | "confirm"

interface WizardState {
  customerMode: "existing" | "new"
  customerId: string
  newFirstName: string
  newLastName: string
  newDni: string
  newPhone: string
  newAddress: string
  employeeId: string
  productType: "jewelry" | "watch"
  productSubtypeId: string
  productMaterial: string
  productMaterialDetail: string
  productWeight: string
  productCondition: "very_good" | "good" | "regular"
  productConditionNotes: string
  purchasedAtStore: boolean
  purchaseDate: string
  workDescription: string
  quoteStatus: QuoteStatus
  jewelerId: string
  estimatedReadyDate: string
  internalNotes: string
  warehouseId: string
}

const defaultWizard: WizardState = {
  customerMode: "existing",
  customerId: "",
  newFirstName: "", newLastName: "", newDni: "", newPhone: "", newAddress: "",
  employeeId: "",
  productType: "jewelry",
  productSubtypeId: "",
  productMaterial: "",
  productMaterialDetail: "",
  productWeight: "",
  productCondition: "good",
  productConditionNotes: "",
  purchasedAtStore: false,
  purchaseDate: "",
  workDescription: "",
  quoteStatus: "not_required",
  jewelerId: "",
  estimatedReadyDate: "",
  internalNotes: "",
  warehouseId: "",
}

function WizardStepIndicator({ current, steps }: { current: WizardStep; steps: WizardStep[] }) {
  const currentIdx = steps.indexOf(current)
  const labels: Record<WizardStep, string> = { customer: "Cliente", product: "Artículo", work: "Trabajo", confirm: "Confirmar" }
  return (
    <div className="flex items-center gap-1 mb-4">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-1">
          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold
            ${i <= currentIdx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {i + 1}
          </div>
          <span className={`text-xs ${i === currentIdx ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
            {labels[step]}
          </span>
          {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        </div>
      ))}
    </div>
  )
}

interface NewEnvelopeDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (envelope: Envelope) => void
}

function NewEnvelopeDialog({ open, onClose, onCreated }: NewEnvelopeDialogProps) {
  const { customers, jewelers, employees, envelopeSubtypes, warehouses, addCustomer, createEnvelope } = useInventory()
  const [step, setStep] = useState<WizardStep>("customer")
  const [form, setForm] = useState<WizardState>(defaultWizard)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const STEPS: WizardStep[] = ["customer", "product", "work", "confirm"]
  const set = (key: keyof WizardState, value: unknown) => setForm(prev => ({ ...prev, [key]: value }))

  useEffect(() => {
    if (open) {
      setStep("customer")
      setForm({ ...defaultWizard, warehouseId: warehouses.find(w => w.is_active)?.id || "" })
      setError(null)
    }
  }, [open, warehouses])

  const canAdvanceCustomer = () => {
    const customerOk = form.customerMode === "existing"
      ? !!form.customerId
      : !!form.newFirstName.trim() && !!form.newLastName.trim() && !!form.newDni.trim()
    return customerOk && !!form.employeeId && !!form.warehouseId
  }

  const canAdvanceWork = () => !!form.workDescription.trim()

  const selectedCustomer = customers.find(c => c.id === form.customerId)
  const activeSubtypes = envelopeSubtypes.filter(s => s.is_active && s.product_type === form.productType)
  const dniMatch = form.newDni.length >= 3 ? customers.find(c => c.dni === form.newDni.trim()) : undefined

  const handleSubmit = async () => {
    setSaving(true)
    setError(null)
    try {
      let customerId = form.customerId
      if (form.customerMode === "new") {
        const created = await addCustomer({
          first_name: form.newFirstName.trim(),
          last_name: form.newLastName.trim(),
          dni: form.newDni.trim(),
          phone: form.newPhone.trim() || null,
          address: form.newAddress.trim() || null,
        })
        if (!created) { setError("No se pudo crear el cliente."); return }
        customerId = created.id
      }

      const envelope = await createEnvelope({
        customer_id: customerId,
        received_at: new Date().toISOString(),
        received_warehouse_id: form.warehouseId,
        received_by_employee_id: form.employeeId || null,
        product_type: form.productType,
        product_subtype_id: form.productSubtypeId || null,
        product_material: form.productMaterial || null,
        product_material_detail: form.productMaterial === "OTROS" ? form.productMaterialDetail.trim() || null : null,
        product_weight: form.productMaterial === "ORO" && form.productWeight ? parseFloat(form.productWeight) : null,
        product_condition: form.productCondition,
        product_condition_notes: form.productConditionNotes.trim() || null,
        purchased_at_store: form.purchasedAtStore,
        purchase_date: form.purchaseDate || null,
        work_description: form.workDescription.trim(),
        quote_status: form.quoteStatus,
        quote_amount: null,
        quote_notes: null,
        quote_informed_at: null,
        jeweler_id: form.jewelerId || null,
        estimated_ready_date: form.estimatedReadyDate || null,
        delivered_at: null,
        delivered_by: null,
        delivery_notes: null,
        internal_notes: form.internalNotes.trim() || null,
      })

      if (!envelope) { setError("No se pudo crear el sobre."); return }
      onCreated(envelope)
    } finally {
      setSaving(false)
    }
  }

  const confirmCustomerName = form.customerMode === "existing" && selectedCustomer
    ? `${selectedCustomer.last_name}, ${selectedCustomer.first_name}`
    : `${form.newLastName}, ${form.newFirstName}`

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo sobre</DialogTitle>
        </DialogHeader>

        <WizardStepIndicator current={step} steps={STEPS} />

        {/* Step 1: Cliente */}
        {step === "customer" && (
          <div className="grid gap-4">
            <div className="flex gap-2">
              <Button variant={form.customerMode === "existing" ? "default" : "outline"} size="sm"
                onClick={() => set("customerMode", "existing")}>
                Cliente existente
              </Button>
              <Button variant={form.customerMode === "new" ? "default" : "outline"} size="sm"
                onClick={() => set("customerMode", "new")}>
                Nuevo cliente
              </Button>
            </div>

            {form.customerMode === "existing" ? (
              <div className="grid gap-1.5">
                <Label>Cliente <span className="text-destructive">*</span></Label>
                <Select value={form.customerId} onValueChange={(v) => set("customerId", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar cliente..." /></SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.last_name}, {c.first_name} — DNI {c.dni}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label>Nombre <span className="text-destructive">*</span></Label>
                    <Input value={form.newFirstName} onChange={e => set("newFirstName", e.target.value)} placeholder="Juan" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Apellido <span className="text-destructive">*</span></Label>
                    <Input value={form.newLastName} onChange={e => set("newLastName", e.target.value)} placeholder="García" />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>DNI <span className="text-destructive">*</span></Label>
                  <Input value={form.newDni} onChange={e => set("newDni", e.target.value)} placeholder="12345678" />
                  {dniMatch && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded px-2 py-1">
                      Ya existe: {dniMatch.last_name}, {dniMatch.first_name}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label>Teléfono <span className="text-xs text-muted-foreground">(Opcional)</span></Label>
                    <Input value={form.newPhone} onChange={e => set("newPhone", e.target.value)} placeholder="11-1234-5678" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Domicilio <span className="text-xs text-muted-foreground">(Opcional)</span></Label>
                    <Input value={form.newAddress} onChange={e => set("newAddress", e.target.value)} placeholder="Av. Corrientes 123" />
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-1.5">
              <Label>Local receptor <span className="text-destructive">*</span></Label>
              <Select value={form.warehouseId} onValueChange={(v) => set("warehouseId", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar local..." /></SelectTrigger>
                <SelectContent>
                  {warehouses.filter(w => w.is_active).map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Recibido por <span className="text-destructive">*</span></Label>
              <Select value={form.employeeId || "none"} onValueChange={(v) => set("employeeId", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar empleado..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Seleccionar...</SelectItem>
                  {employees.filter(e => e.is_active).map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Step 2: Artículo */}
        {step === "product" && (
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Tipo de artículo <span className="text-destructive">*</span></Label>
              <div className="flex gap-2">
                <Button variant={form.productType === "jewelry" ? "default" : "outline"} size="sm"
                  onClick={() => { set("productType", "jewelry"); set("productSubtypeId", "") }}>
                  Joyería
                </Button>
                <Button variant={form.productType === "watch" ? "default" : "outline"} size="sm"
                  onClick={() => { set("productType", "watch"); set("productSubtypeId", "") }}>
                  Relojería
                </Button>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Subtipo <span className="text-xs text-muted-foreground">(Opcional)</span></Label>
              <Select value={form.productSubtypeId || "none"} onValueChange={(v) => set("productSubtypeId", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Sin especificar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin especificar</SelectItem>
                  {activeSubtypes.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Material <span className="text-xs text-muted-foreground">(Opcional)</span></Label>
              <Select value={form.productMaterial || "none"} onValueChange={(v) => { set("productMaterial", v === "none" ? "" : v); set("productMaterialDetail", ""); set("productWeight", "") }}>
                <SelectTrigger><SelectValue placeholder="Sin especificar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin especificar</SelectItem>
                  {MATERIAL_OPTIONS.map(m => <SelectItem key={m} value={m}>{MATERIAL_LABELS[m]}</SelectItem>)}
                </SelectContent>
              </Select>
              {form.productMaterial === "OTROS" && (
                <Input
                  value={form.productMaterialDetail}
                  onChange={e => set("productMaterialDetail", e.target.value)}
                  placeholder="Ej: Titanio, Acero, Bronce"
                  className="mt-1"
                />
              )}
            </div>

            {form.productMaterial === "ORO" && (
              <div className="grid gap-1.5">
                <Label>Peso (gramos) <span className="text-xs text-muted-foreground">(Opcional)</span></Label>
                <Input
                  type="number"
                  value={form.productWeight}
                  onChange={e => set("productWeight", e.target.value)}
                  placeholder="Ej: 12.5"
                  min="0"
                  step="0.01"
                />
              </div>
            )}

            <div className="grid gap-1.5">
              <Label>Estado del artículo <span className="text-destructive">*</span></Label>
              <Select value={form.productCondition} onValueChange={(v) => set("productCondition", v as "very_good" | "good" | "regular")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="very_good">Muy bueno</SelectItem>
                  <SelectItem value="good">Bueno</SelectItem>
                  <SelectItem value="regular">Regular</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Observaciones del estado <span className="text-xs text-muted-foreground">(Opcional)</span></Label>
              <Input value={form.productConditionNotes} onChange={e => set("productConditionNotes", e.target.value)} placeholder="Ej: Rayado en la parte trasera" />
            </div>

            <div className="flex items-center gap-2">
              <Switch id="purchased-store" checked={form.purchasedAtStore} onCheckedChange={(v) => set("purchasedAtStore", v)} />
              <Label htmlFor="purchased-store">Comprado en Santarelli</Label>
            </div>
            {form.purchasedAtStore && (
              <div className="grid gap-1.5">
                <Label>Fecha de compra <span className="text-xs text-muted-foreground">(Opcional)</span></Label>
                <Input type="date" value={form.purchaseDate} onChange={e => set("purchaseDate", e.target.value)} />
              </div>
            )}
          </div>
        )}

        {/* Step 3: Trabajo */}
        {step === "work" && (
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Trabajo solicitado <span className="text-destructive">*</span></Label>
              <Textarea value={form.workDescription} onChange={e => set("workDescription", e.target.value)}
                placeholder="Describir en detalle el trabajo a realizar..." rows={4} />
            </div>

            <div className="grid gap-1.5">
              <Label>Presupuesto</Label>
              <div className="flex gap-2">
                {(["not_required", "pending"] as QuoteStatus[]).map(qs => (
                  <Button key={qs} variant={form.quoteStatus === qs ? "default" : "outline"} size="sm"
                    onClick={() => set("quoteStatus", qs)}>
                    {QUOTE_STATUS_LABELS[qs]}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Joyero asignado <span className="text-xs text-muted-foreground">(Opcional)</span></Label>
              <Select value={form.jewelerId || "none"} onValueChange={(v) => set("jewelerId", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {jewelers.filter(j => j.is_active).map(j => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Fecha estimada de entrega <span className="text-xs text-muted-foreground">(Opcional)</span></Label>
              <Input type="date" value={form.estimatedReadyDate} onChange={e => set("estimatedReadyDate", e.target.value)} />
            </div>

            <div className="grid gap-1.5">
              <Label>Notas internas <span className="text-xs text-muted-foreground">(Opcional)</span></Label>
              <Textarea value={form.internalNotes} onChange={e => set("internalNotes", e.target.value)}
                placeholder="Solo visible internamente..." rows={2} />
            </div>
          </div>
        )}

        {/* Step 4: Confirmar */}
        {step === "confirm" && (
          <div className="grid gap-3 text-sm">
            <div className="rounded-lg bg-muted/50 border border-border p-3 grid gap-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cliente</span>
                <span className="font-medium">{confirmCustomerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Artículo</span>
                <span className="font-medium">
                  {form.productType === "jewelry" ? "Joyería" : "Relojería"}
                  {envelopeSubtypes.find(s => s.id === form.productSubtypeId)?.name
                    ? ` — ${envelopeSubtypes.find(s => s.id === form.productSubtypeId)?.name}` : ""}
                </span>
              </div>
              {form.productMaterial && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Material</span>
                  <span className="font-medium">{getMaterialDisplay(form.productMaterial, form.productMaterialDetail)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estado artículo</span>
                <span className="font-medium">{CONDITION_LABELS[form.productCondition]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Presupuesto</span>
                <span className="font-medium">{QUOTE_STATUS_LABELS[form.quoteStatus]}</span>
              </div>
              {form.estimatedReadyDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha estimada</span>
                  <span className="font-medium">{formatDate(form.estimatedReadyDate)}</span>
                </div>
              )}
            </div>
            <div className="rounded-lg bg-muted/50 border border-border p-3">
              <p className="text-xs text-muted-foreground mb-1">Trabajo solicitado</p>
              <p className="font-medium whitespace-pre-wrap">{form.workDescription}</p>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Al confirmar se imprimirán 2 copias del sobre automáticamente.
            </p>
            {error && <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">{error}</p>}
          </div>
        )}

        <DialogFooter className="gap-2 mt-2">
          {step !== "customer" && (
            <Button variant="outline" onClick={() => setStep(STEPS[STEPS.indexOf(step) - 1])}>Atrás</Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          {step !== "confirm" ? (
            <Button
              onClick={() => setStep(STEPS[STEPS.indexOf(step) + 1])}
              disabled={
                (step === "customer" && !canAdvanceCustomer()) ||
                (step === "work" && !canAdvanceWork())
              }
            >
              Siguiente <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Guardando..." : "Crear e imprimir"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Detail Dialog ───────────────────────────────────────────────────────────

interface EnvelopeDetailDialogProps {
  envelope: Envelope | null
  onClose: () => void
  onUpdated: (id: string, updates: Partial<Envelope>, statusNote?: string, createdBy?: string) => Promise<void>
  onPrint: (envelope: Envelope) => void
}

function EnvelopeDetailDialog({ envelope, onClose, onUpdated, onPrint }: EnvelopeDetailDialogProps) {
  const { jewelers, warehouses, fetchEnvelopeEvents } = useInventory()
  const [events, setEvents] = useState<EnvelopeEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)

  // Editable fields state
  const [editing, setEditing] = useState(false)
  const [editPhone, setEditPhone] = useState("")
  const [editAddress, setEditAddress] = useState("")
  const [editMaterial, setEditMaterial] = useState("")
  const [editMaterialDetail, setEditMaterialDetail] = useState("")
  const [editProductWeight, setEditProductWeight] = useState("")
  const [editPurchasedAtStore, setEditPurchasedAtStore] = useState(false)
  const [editPurchaseDate, setEditPurchaseDate] = useState("")
  const [editEstimatedReadyDate, setEditEstimatedReadyDate] = useState("")
  const [editInternalNotes, setEditInternalNotes] = useState("")
  const [saving, setSaving] = useState(false)

  // Action state
  const [activeAction, setActiveAction] = useState<ActiveAction>(null)
  const [actionJewelerId, setActionJewelerId] = useState("")
  const [actionWarehouseId, setActionWarehouseId] = useState("")
  const [actionQuoteAmount, setActionQuoteAmount] = useState("")
  const [actionQuoteNotes, setActionQuoteNotes] = useState("")
  const [actionDeliveredBy, setActionDeliveredBy] = useState("")
  const [actionDeliveryNotes, setActionDeliveryNotes] = useState("")
  const [actionNote, setActionNote] = useState("")
  const [actionSaving, setActionSaving] = useState(false)
  const [actionOperator, setActionOperator] = useState<string>(() => {
    if (typeof window !== "undefined") return localStorage.getItem("sobres_operator") || ""
    return ""
  })

  const resetActionForm = () => {
    setActionJewelerId("")
    setActionWarehouseId("")
    setActionQuoteAmount("")
    setActionQuoteNotes("")
    setActionDeliveredBy("")
    setActionDeliveryNotes("")
    setActionNote("")
  }

  useEffect(() => {
    if (envelope) {
      setEditing(false)
      setActiveAction(null)
      resetActionForm()
      // Load events
      setEventsLoading(true)
      fetchEnvelopeEvents(envelope.id).then(data => { setEvents(data); setEventsLoading(false) })
      // Pre-fill editable fields
      setEditPhone(envelope.customer?.phone || "")
      setEditAddress(envelope.customer?.address || "")
      const { option, customDetail } = parseMaterialForEdit(envelope.product_material, envelope.product_material_detail)
      setEditMaterial(option)
      setEditMaterialDetail(customDetail)
      setEditProductWeight(envelope.product_weight != null ? String(envelope.product_weight) : "")
      setEditPurchasedAtStore(envelope.purchased_at_store)
      setEditPurchaseDate(envelope.purchase_date || "")
      setEditEstimatedReadyDate(envelope.estimated_ready_date || "")
      setEditInternalNotes(envelope.internal_notes || "")
    }
  }, [envelope])

  if (!envelope) return null

  const c = envelope.customer
  const availableActions = getAvailableActions(envelope)
  const quoteActions = availableActions.filter(a => QUOTE_ACTIONS.includes(a))
  const otherActions = availableActions.filter(a => !QUOTE_ACTIONS.includes(a))
  const isQuoteAction = !!activeAction && QUOTE_ACTIONS.includes(activeAction)

  const handleSaveEdits = async () => {
    setSaving(true)
    try {
      await onUpdated(envelope.id, {
        product_material: editMaterial || null,
        product_material_detail: editMaterial === "OTROS" ? editMaterialDetail.trim() || null : null,
        product_weight: editMaterial === "ORO" && editProductWeight ? parseFloat(editProductWeight) : null,
        purchased_at_store: editPurchasedAtStore,
        purchase_date: editPurchaseDate || null,
        estimated_ready_date: editEstimatedReadyDate || null,
        internal_notes: editInternalNotes.trim() || null,
      })
      setEditing(false)
      fetchEnvelopeEvents(envelope.id).then(setEvents)
    } finally {
      setSaving(false)
    }
  }

  const handleAction = async () => {
    setActionSaving(true)
    const op = actionOperator.trim() || undefined
    try {
      switch (activeAction) {
        case "request_quote":
          await onUpdated(envelope.id, { status: "quote_pending", quote_status: "pending" }, undefined, op)
          break
        case "send_to_jeweler":
          await onUpdated(envelope.id, { status: "in_workshop", jeweler_id: actionJewelerId || null }, undefined, op)
          break
        case "receive_from_jeweler":
          await onUpdated(envelope.id, { status: "ready" }, undefined, op)
          break
        case "transfer":
          await onUpdated(envelope.id, { current_warehouse_id: actionWarehouseId }, undefined, op)
          break
        case "inform_quote":
          await onUpdated(envelope.id, {
            quote_status: "informed",
            quote_amount: actionQuoteAmount ? parseFloat(actionQuoteAmount) : null,
            quote_notes: actionQuoteNotes.trim() || null,
            quote_informed_at: new Date().toISOString(),
          }, undefined, op)
          break
        case "approve_quote":
          await onUpdated(envelope.id, {
            status: "quote_approved",
            quote_status: "approved",
            quote_approved_at: new Date().toISOString(),
          }, undefined, op)
          break
        case "reject_quote":
          await onUpdated(
            envelope.id,
            { status: "received", quote_status: "rejected" },
            actionNote.trim() || "Presupuesto rechazado por el cliente",
            op
          )
          break
        case "deliver":
          await onUpdated(
            envelope.id,
            {
              status: "delivered",
              delivered_at: new Date().toISOString(),
              delivered_by: actionDeliveredBy.trim() || null,
              delivery_notes: actionDeliveryNotes.trim() || null,
            },
            actionDeliveredBy.trim() ? `Entregado a ${actionDeliveredBy.trim()}` : undefined,
            op
          )
          break
        case "cancel_envelope":
          await onUpdated(envelope.id, { status: "cancelled" }, actionNote.trim() || undefined, op)
          break
      }
      setActiveAction(null)
      resetActionForm()
      fetchEnvelopeEvents(envelope.id).then(setEvents)
    } finally {
      setActionSaving(false)
    }
  }

  const reversedEvents = [...events].reverse()

  // Formulario inline compartido por la tarjeta de Presupuesto y la de Acciones disponibles
  const actionFormPanel = activeAction && (
    <div className="rounded-xl border border-border bg-muted/30 p-4 grid gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xl leading-none">{ACTION_CONFIG[activeAction].icon}</span>
        <p className="font-semibold">{ACTION_CONFIG[activeAction].label}</p>
      </div>

      {activeAction === "send_to_jeweler" && (
        <div className="grid gap-1.5">
          <Label className="text-xs">Joyero <span className="text-muted-foreground">(Opcional)</span></Label>
          <Select value={actionJewelerId || "none"} onValueChange={v => setActionJewelerId(v === "none" ? "" : v)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin asignar</SelectItem>
              {jewelers.filter(j => j.is_active).map(j => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {activeAction === "transfer" && (
        <div className="grid gap-1.5">
          <Label className="text-xs">Destino <span className="text-destructive">*</span></Label>
          <Select value={actionWarehouseId || "none"} onValueChange={v => setActionWarehouseId(v === "none" ? "" : v)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seleccionar local..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Seleccionar...</SelectItem>
              {warehouses.filter(w => w.is_active && w.id !== envelope.current_warehouse_id)
                .map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {activeAction === "inform_quote" && (
        <>
          <div className="grid gap-1.5">
            <Label className="text-xs">Monto <span className="text-muted-foreground">(Opcional)</span></Label>
            <Input type="number" value={actionQuoteAmount} onChange={e => setActionQuoteAmount(e.target.value)}
              className="h-9 text-sm" placeholder="25000" min="0" step="0.01" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Detalle <span className="text-muted-foreground">(Opcional)</span></Label>
            <Input value={actionQuoteNotes} onChange={e => setActionQuoteNotes(e.target.value)}
              className="h-9 text-sm" placeholder="Ej: Cambio de cierre + soldadura" />
          </div>
        </>
      )}

      {activeAction === "deliver" && (
        <>
          <div className="grid gap-1.5">
            <Label className="text-xs">Entregado a <span className="text-destructive">*</span></Label>
            <Input value={actionDeliveredBy} onChange={e => setActionDeliveredBy(e.target.value)}
              className="h-9 text-sm" placeholder="Nombre y apellido" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Observaciones <span className="text-muted-foreground">(Opcional)</span></Label>
            <Input value={actionDeliveryNotes} onChange={e => setActionDeliveryNotes(e.target.value)}
              className="h-9 text-sm" placeholder="Ej: Retirado con DNI 12345678" />
          </div>
        </>
      )}

      {(activeAction === "cancel_envelope" || activeAction === "reject_quote") && (
        <div className="grid gap-1.5">
          <Label className="text-xs">Motivo <span className="text-muted-foreground">(Opcional)</span></Label>
          <Input value={actionNote} onChange={e => setActionNote(e.target.value)} className="h-9 text-sm"
            placeholder={activeAction === "reject_quote" ? "Ej: El cliente no acepta el precio" : "Ej: El cliente desistió"} />
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={() => { setActiveAction(null); resetActionForm() }}>
          Cancelar
        </Button>
        <Button size="sm"
          disabled={actionSaving ||
            (activeAction === "transfer" && !actionWarehouseId) ||
            (activeAction === "deliver" && !actionDeliveredBy.trim())}
          onClick={handleAction}>
          {actionSaving ? "Guardando..." : "Confirmar"}
        </Button>
      </div>
    </div>
  )

  return (
    <Dialog open={!!envelope} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">

        {/* ── HEADER ── */}
        <DialogHeader className="pb-0">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="font-mono text-2xl font-bold tracking-tight">
              {envelope.number}
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={() => onPrint(envelope)} className="shrink-0 text-muted-foreground">
              <Printer className="h-4 w-4 mr-1.5" /> Imprimir
            </Button>
          </div>
        </DialogHeader>

        <div className="grid gap-5 text-sm mt-2">

          {/* ── 1. TARJETA DE ESTADO Y UBICACIÓN ── */}
          <div className={`rounded-xl border-2 p-4 ${STATUS_CARD_COLORS[envelope.status]}`}>
            <div className="flex items-start gap-3">
              <span className="text-3xl leading-none mt-0.5 shrink-0">{STATUS_EMOJI[envelope.status]}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base leading-snug">{STATUS_LABELS[envelope.status]}</p>
                {envelope.quote_status !== "not_required" && (
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mt-1 ${QUOTE_STATUS_COLORS[envelope.quote_status]}`}>
                    Presupuesto: {QUOTE_STATUS_LABELS[envelope.quote_status]}
                    {envelope.quote_amount != null ? ` · $${envelope.quote_amount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}` : ""}
                  </span>
                )}
                <div className="flex items-center gap-1.5 mt-2">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-semibold text-sm">{getEnvelopeLocation(envelope)}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {reversedEvents.length > 0 && reversedEvents[0].created_by && reversedEvents[0].created_by !== "Sistema" && (
                    <div>
                      <span className="block text-muted-foreground/60 uppercase text-[10px] font-medium tracking-wide">Último responsable</span>
                      <span className="font-semibold text-foreground">{reversedEvents[0].created_by}</span>
                    </div>
                  )}
                  <div>
                    <span className="block text-muted-foreground/60 uppercase text-[10px] font-medium tracking-wide">Tiempo en estado</span>
                    <span className="font-semibold text-foreground">{elapsedLabel(daysElapsed(envelope.updated_at))}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── 2. TRABAJO SOLICITADO ── */}
          <section>
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">Trabajo solicitado</p>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="whitespace-pre-wrap leading-relaxed">{envelope.work_description}</p>
            </div>
          </section>

          {/* Selector de operador — persiste en localStorage, compartido por ambas tarjetas de acciones */}
          {!editing && (quoteActions.length > 0 || otherActions.length > 0) && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border border-border">
              <span className="text-xs text-muted-foreground shrink-0">Operador:</span>
              <Input
                value={actionOperator}
                onChange={e => {
                  setActionOperator(e.target.value)
                  localStorage.setItem("sobres_operator", e.target.value)
                }}
                className="h-7 text-xs border-0 bg-transparent p-0 focus-visible:ring-0 flex-1"
                placeholder="Tu nombre..."
              />
            </div>
          )}

          {/* ── 3. PRESUPUESTO ── */}
          {!editing && (envelope.quote_status !== "not_required" || quoteActions.length > 0) && (!activeAction || isQuoteAction) && (
            <section>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Presupuesto</p>
              <div className="rounded-xl border border-border bg-muted/20 p-4 grid gap-3">
                {envelope.quote_status === "approved" ? (
                  <div className="flex items-center gap-2 font-semibold text-green-700 dark:text-green-400">
                    <span className="text-lg leading-none">✅</span> Presupuesto aprobado
                  </div>
                ) : envelope.quote_status === "rejected" ? (
                  <div className="flex items-center gap-2 font-semibold text-red-700 dark:text-red-400">
                    <span className="text-lg leading-none">❌</span> Presupuesto rechazado
                  </div>
                ) : envelope.quote_status !== "not_required" ? (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Estado</p>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mt-0.5 ${QUOTE_STATUS_COLORS[envelope.quote_status]}`}>
                        {QUOTE_STATUS_LABELS[envelope.quote_status]}
                      </span>
                    </div>
                    {envelope.quote_amount != null && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Monto</p>
                        <p className="font-semibold">${envelope.quote_amount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Aún no se solicitó presupuesto.</p>
                )}

                {envelope.quote_notes && (
                  <div>
                    <p className="text-xs text-muted-foreground">Detalle</p>
                    <p className="text-sm">{envelope.quote_notes}</p>
                  </div>
                )}

                {!activeAction ? (
                  quoteActions.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {quoteActions.map(action => (
                        <Button
                          key={action}
                          variant={ACTION_CONFIG[action].variant === "default" ? "default" : "outline"}
                          size="sm"
                          className={action === "reject_quote" ? "text-destructive border-destructive/40 hover:bg-destructive/10" : ""}
                          onClick={() => { resetActionForm(); setActiveAction(action) }}
                        >
                          <span className="mr-1.5">{ACTION_CONFIG[action].icon}</span>
                          {ACTION_CONFIG[action].label}
                        </Button>
                      ))}
                    </div>
                  )
                ) : (
                  isQuoteAction && actionFormPanel
                )}
              </div>
            </section>
          )}

          {/* ── 4. ACCIONES DISPONIBLES ── */}
          {!editing && otherActions.length > 0 && (!activeAction || !isQuoteAction) && (
            <section>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Acciones disponibles</p>
              {!activeAction ? (
                <div className="grid gap-2">
                  {/* Acciones primarias */}
                  {otherActions.filter(a => ACTION_CONFIG[a].variant === "default").map(action => (
                    <Button
                      key={action}
                      className="h-11 justify-start gap-3"
                      onClick={() => { resetActionForm(); setActiveAction(action) }}
                    >
                      <span className="text-lg leading-none">{ACTION_CONFIG[action].icon}</span>
                      {ACTION_CONFIG[action].label}
                    </Button>
                  ))}
                  {/* Acciones secundarias */}
                  {otherActions.filter(a => ACTION_CONFIG[a].variant === "outline").map(action => (
                    <Button
                      key={action}
                      variant="outline"
                      className="h-10 justify-start gap-3"
                      onClick={() => { resetActionForm(); setActiveAction(action) }}
                    >
                      <span className="text-base leading-none">{ACTION_CONFIG[action].icon}</span>
                      {ACTION_CONFIG[action].label}
                    </Button>
                  ))}
                  {/* Acciones destructivas */}
                  {otherActions.filter(a => ACTION_CONFIG[a].variant === "destructive").length > 0 && (
                    <div className="pt-1 border-t border-border mt-1">
                      {otherActions.filter(a => ACTION_CONFIG[a].variant === "destructive").map(action => (
                        <Button
                          key={action}
                          variant="ghost"
                          size="sm"
                          className="justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => { resetActionForm(); setActiveAction(action) }}
                        >
                          <span>{ACTION_CONFIG[action].icon}</span>
                          {ACTION_CONFIG[action].label}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                !isQuoteAction && actionFormPanel
              )}
            </section>
          )}

          {/* ── 4. TRAZABILIDAD OCA-STYLE ── */}
          {!editing && (
            <section>
              <Separator className="mb-4" />
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-4">Historial</p>
              {eventsLoading ? (
                <p className="text-xs text-muted-foreground">Cargando historial...</p>
              ) : reversedEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin eventos registrados.</p>
              ) : (
                <div>
                  {reversedEvents.map((event, i) => (
                    <div key={event.id} className="flex gap-3 relative">
                      {/* Línea vertical conectora */}
                      {i < reversedEvents.length - 1 && (
                        <div className="absolute left-[15px] top-9 bottom-0 w-px bg-border z-0" />
                      )}
                      {/* Círculo con icono */}
                      <div className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm shrink-0 mt-0.5 border
                        ${i === 0
                          ? "bg-primary text-primary-foreground border-primary shadow-sm ring-4 ring-primary/15"
                          : "bg-background border-border text-muted-foreground"}`}>
                        {EVENT_ICONS[event.event_type] || "·"}
                      </div>
                      {/* Contenido del evento */}
                      <div className="pb-5 min-w-0 flex-1">
                        <p className={`font-semibold leading-snug ${i === 0 ? "text-foreground" : "text-muted-foreground"}`}>
                          {event.title}
                        </p>
                        {event.detail && (
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{event.detail}</p>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          {event.created_by && event.created_by !== "Sistema" && (
                            <span className="text-xs font-medium text-foreground/80">
                              Por: {event.created_by}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground/70">
                            {formatDateTime(event.created_at)}
                          </span>
                          <span className="text-xs text-muted-foreground/50">
                            {elapsedLabel(daysElapsed(event.created_at))}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── 5. DATOS SECUNDARIOS ── */}
          <Separator />

          {/* Corregir datos */}
          {!activeAction && (
            <div className="flex gap-2">
              {!editing ? (
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setEditing(true)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Corregir datos
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
                  <Button size="sm" onClick={handleSaveEdits} disabled={saving}>
                    {saving ? "Guardando..." : "Guardar"}
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Artículo */}
          <section>
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">Artículo</p>
            <div className="rounded-lg border border-border p-3 grid gap-1">
              <p className="font-semibold">
                {envelope.product_type === "jewelry" ? "Joyería" : "Relojería"}
                {envelope.product_subtype?.name ? ` — ${envelope.product_subtype.name}` : ""}
              </p>
              {!editing ? (
                <>
                  {envelope.product_material && (
                    <p className="text-muted-foreground text-xs">
                      Material: {getMaterialDisplay(envelope.product_material, envelope.product_material_detail)}
                      {envelope.product_material === "ORO" && envelope.product_weight != null
                        ? ` · Peso: ${envelope.product_weight}g`
                        : ""}
                    </p>
                  )}
                  <p className="text-muted-foreground text-xs">Estado: {CONDITION_LABELS[envelope.product_condition]}</p>
                  {envelope.product_condition_notes && (
                    <p className="text-muted-foreground text-xs">{envelope.product_condition_notes}</p>
                  )}
                  {envelope.purchased_at_store && (
                    <p className="text-green-600 dark:text-green-400 text-xs">
                      ✓ Comprado en Santarelli{envelope.purchase_date ? ` el ${formatDate(envelope.purchase_date)}` : ""}
                    </p>
                  )}
                </>
              ) : (
                <div className="mt-2 grid gap-2">
                  <div className="grid gap-1">
                    <Label className="text-xs">Material</Label>
                    <Select value={editMaterial || "none"} onValueChange={(v) => { setEditMaterial(v === "none" ? "" : v); setEditMaterialDetail(""); setEditProductWeight("") }}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Sin especificar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin especificar</SelectItem>
                        {MATERIAL_OPTIONS.map(m => <SelectItem key={m} value={m}>{MATERIAL_LABELS[m]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {editMaterial === "OTROS" && (
                      <Input value={editMaterialDetail} onChange={e => setEditMaterialDetail(e.target.value)}
                        className="h-8 text-sm mt-1" placeholder="Ej: Titanio, Acero, Bronce" />
                    )}
                    {editMaterial === "ORO" && (
                      <Input type="number" value={editProductWeight} onChange={e => setEditProductWeight(e.target.value)}
                        className="h-8 text-sm mt-1" placeholder="Peso en gramos" min="0" step="0.01" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="edit-purchased" checked={editPurchasedAtStore} onCheckedChange={setEditPurchasedAtStore} />
                    <Label htmlFor="edit-purchased" className="text-xs">Comprado en Santarelli</Label>
                  </div>
                  {editPurchasedAtStore && (
                    <div className="grid gap-1">
                      <Label className="text-xs">Fecha de compra</Label>
                      <Input type="date" value={editPurchaseDate} onChange={e => setEditPurchaseDate(e.target.value)} className="h-8 text-sm" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Joyero / Fecha estimada / Notas internas */}
          {(envelope.jeweler || envelope.estimated_ready_date || editing) && (
            <section>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">Asignación</p>
              <div className="rounded-lg border border-border p-3 grid gap-1.5">
                {envelope.jeweler && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-xs">Joyero</span>
                    <span className="font-medium">{envelope.jeweler.name}</span>
                  </div>
                )}
                {!editing ? (
                  <>
                    {envelope.estimated_ready_date && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground text-xs">Fecha estimada</span>
                        <span className="font-medium">{formatDate(envelope.estimated_ready_date)}</span>
                      </div>
                    )}
                    {envelope.internal_notes && (
                      <div className="grid gap-0.5 pt-1 border-t border-border mt-0.5">
                        <span className="text-muted-foreground text-xs">Notas internas</span>
                        <span className="text-muted-foreground">{envelope.internal_notes}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="grid gap-2 pt-1 border-t border-border mt-0.5">
                    <div className="grid gap-1">
                      <Label className="text-xs">Fecha estimada de entrega</Label>
                      <Input type="date" value={editEstimatedReadyDate} onChange={e => setEditEstimatedReadyDate(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">Notas internas</Label>
                      <Textarea value={editInternalNotes} onChange={e => setEditInternalNotes(e.target.value)} rows={2} className="text-sm" placeholder="Solo visible internamente..." />
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Cliente */}
          <section>
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">Cliente</p>
            <div className="rounded-lg border border-border p-3 grid gap-1">
              <p className="font-semibold">{c ? `${c.last_name}, ${c.first_name}` : "—"}</p>
              <p className="text-muted-foreground text-xs">DNI: {c?.dni || "—"}</p>
              {!editing ? (
                <>
                  <p className="text-muted-foreground text-xs">Tel: {c?.phone || "—"}</p>
                  {c?.address && <p className="text-muted-foreground text-xs">{c.address}</p>}
                </>
              ) : (
                <div className="grid gap-2 mt-1">
                  <div className="grid gap-1">
                    <Label className="text-xs">Teléfono</Label>
                    <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} className="h-8 text-sm" placeholder="11-1234-5678" />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Domicilio</Label>
                    <Input value={editAddress} onChange={e => setEditAddress(e.target.value)} className="h-8 text-sm" placeholder="Av. Corrientes 123" />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Recepción */}
          <section className="grid grid-cols-2 gap-2 pb-2">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Local receptor</p>
              <p className="font-medium">{envelope.received_warehouse?.name || "—"}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Fecha recepción</p>
              <p className="font-medium">{formatDate(envelope.received_at)}</p>
            </div>
            {envelope.received_by_employee && (
              <div className="rounded-lg border border-border p-3 col-span-2">
                <p className="text-xs text-muted-foreground">Recibido por</p>
                <p className="font-medium">{envelope.received_by_employee.name}</p>
              </div>
            )}
          </section>

        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

const ALL_STATUSES: EnvelopeStatus[] = ["received", "quote_pending", "quote_approved", "in_workshop", "ready", "delivered", "cancelled"]

export default function SobresPage() {
  const { fetchEnvelopes, updateEnvelope, updateCustomer, warehouses, jewelers } = useInventory()
  const [envelopes, setEnvelopes] = useState<Envelope[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<EnvelopeStatus | "all">("all")
  const [newOpen, setNewOpen] = useState(false)
  const [detailEnvelope, setDetailEnvelope] = useState<Envelope | null>(null)

  const loadEnvelopes = useCallback(async () => {
    setLoading(true)
    const data = await fetchEnvelopes(statusFilter !== "all" ? { status: statusFilter } : undefined)
    setEnvelopes(data)
    setLoading(false)
  }, [fetchEnvelopes, statusFilter])

  useEffect(() => { loadEnvelopes() }, [loadEnvelopes])

  const filtered = envelopes.filter(e => {
    if (!search) return true
    const q = search.toLowerCase()
    const c = e.customer
    return (
      e.number.toLowerCase().includes(q) ||
      (c?.last_name || "").toLowerCase().includes(q) ||
      (c?.first_name || "").toLowerCase().includes(q) ||
      (c?.dni || "").includes(q)
    )
  })

  const handleCreated = (envelope: Envelope) => {
    setEnvelopes(prev => [envelope, ...prev])
    setNewOpen(false)
    printEnvelope(envelope)
    setDetailEnvelope(envelope)
  }

  const handleUpdated = useCallback(async (id: string, updates: Partial<Envelope>, statusNote?: string, createdBy?: string) => {
    await updateEnvelope(id, updates, statusNote, createdBy)

    // Si cambió el local actual, también actualizamos el objeto joined localmente
    // para que la ubicación se refleje al instante sin esperar un refetch.
    const patch: Partial<Envelope> = { ...updates }
    if ('current_warehouse_id' in updates) {
      patch.current_warehouse = updates.current_warehouse_id
        ? warehouses.find(w => w.id === updates.current_warehouse_id) || undefined
        : undefined
    }
    if ('jeweler_id' in updates) {
      patch.jeweler = updates.jeweler_id
        ? jewelers.find(j => j.id === updates.jeweler_id) || undefined
        : undefined
    }

    // Also update customer phone/address if those were passed (not directly in envelope)
    // Note: phone/address live on the customer record, but we pass them through the edit handler
    // The edit handler in the detail dialog calls updateCustomer separately if needed.
    // Here we just merge into local state.
    setEnvelopes(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e))
    setDetailEnvelope(prev => prev && prev.id === id ? { ...prev, ...patch } : prev)
  }, [updateEnvelope, warehouses, jewelers])

  const activeCounts = envelopes.filter(e => !["delivered", "cancelled"].includes(e.status)).length

  return (
    <div className="flex flex-col h-full">
      <Header title="Sobres" />

      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por número, cliente o DNI..."
                value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as EnvelopeStatus | "all")}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            {activeCounts > 0 && <Badge variant="secondary">{activeCounts} activos</Badge>}
            <Button onClick={() => setNewOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Nuevo sobre
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Cargando sobres...</div>
        ) : (
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-28">Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Artículo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Presupuesto</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(e => {
                  const c = e.customer
                  return (
                    <TableRow key={e.id} className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setDetailEnvelope(e)}>
                      <TableCell className="font-mono font-semibold">{e.number}</TableCell>
                      <TableCell>
                        {c ? (
                          <div>
                            <p className="font-medium">{c.last_name}, {c.first_name}</p>
                            <p className="text-xs text-muted-foreground">DNI {c.dni}</p>
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">
                          {e.product_type === "jewelry" ? "Joyería" : "Relojería"}
                          {e.product_subtype?.name ? ` — ${e.product_subtype.name}` : ""}
                        </p>
                        {e.product_material && <p className="text-xs text-muted-foreground">{getMaterialDisplay(e.product_material, e.product_material_detail)}</p>}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <StatusBadge status={e.status} />
                          {!["delivered", "cancelled"].includes(e.status) && (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium w-fit ${elapsedBadgeColor(e.status, daysElapsed(e.updated_at))}`}>
                              {elapsedLabel(daysElapsed(e.updated_at))}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {e.quote_status !== "not_required" && (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${QUOTE_STATUS_COLORS[e.quote_status]}`}>
                            {QUOTE_STATUS_LABELS[e.quote_status]}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          {getEnvelopeLocation(e)}
                        </div>
                      </TableCell>
                      <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  )
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                      {search || statusFilter !== "all" ? "Sin resultados para ese filtro." : "Todavía no hay sobres registrados."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      <NewEnvelopeDialog open={newOpen} onClose={() => setNewOpen(false)} onCreated={handleCreated} />

      <EnvelopeDetailDialog
        envelope={detailEnvelope}
        onClose={() => setDetailEnvelope(null)}
        onUpdated={handleUpdated}
        onPrint={printEnvelope}
      />
    </div>
  )
}
