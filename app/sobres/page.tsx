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
} from "lucide-react"
import type { Envelope, EnvelopeStatus, QuoteStatus } from "@/lib/types"

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

// ── Print ───────────────────────────────────────────────────────────────────

function printEnvelope(envelope: Envelope) {
  const c = envelope.customer
  const fullName = c ? `${c.last_name}, ${c.first_name}` : "—"
  const subtype = envelope.product_subtype?.name || ""
  const type = envelope.product_type === "jewelry" ? "Joyería" : "Relojería"
  const condition = CONDITION_LABELS[envelope.product_condition] || envelope.product_condition
  const quoteLabel = QUOTE_STATUS_LABELS[envelope.quote_status]
  const warehouse = envelope.received_warehouse?.name || "—"

  const sharedFields = `
    <div class="row"><span class="label">Número</span><span class="value mono">${envelope.number}</span></div>
    <div class="row"><span class="label">Cliente</span><span class="value">${fullName}</span></div>
    <div class="row"><span class="label">DNI</span><span class="value">${c?.dni || "—"}</span></div>
    <div class="row"><span class="label">Domicilio</span><span class="value">${c?.address || "—"}</span></div>
    <div class="divider"></div>
    <div class="row"><span class="label">Artículo</span><span class="value">${type}${subtype ? ` — ${subtype}` : ""}${envelope.product_material ? ` · ${envelope.product_material}` : ""}</span></div>
    <div class="row"><span class="label">Estado</span><span class="value">${condition}</span></div>
    ${envelope.product_condition_notes ? `<div class="row"><span class="label">Obs. estado</span><span class="value">${envelope.product_condition_notes}</span></div>` : ""}
    <div class="divider"></div>
    <div class="work-label">Trabajo solicitado</div>
    <div class="work-text">${envelope.work_description}</div>
    <div class="divider"></div>
    <div class="row"><span class="label">Presupuesto</span><span class="value">${quoteLabel}</span></div>
    ${envelope.quote_amount != null ? `<div class="row"><span class="label">Monto</span><span class="value">$${envelope.quote_amount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span></div>` : ""}
    ${envelope.quote_notes ? `<div class="row"><span class="label">Detalle</span><span class="value">${envelope.quote_notes}</span></div>` : ""}
    <div class="row"><span class="label">Local receptor</span><span class="value">${warehouse}</span></div>
    <div class="row"><span class="label">Fecha recepción</span><span class="value">${formatDate(envelope.received_at)}</span></div>
    ${envelope.estimated_ready_date ? `<div class="row"><span class="label">Fecha estimada</span><span class="value">${formatDate(envelope.estimated_ready_date)}</span></div>` : ""}
  `

  const customerCopy = `
    <div class="copy">
      <div class="copy-header">
        <div>
          <div class="copy-title">Familia Santarelli</div>
          <div class="copy-sub">Talón del cliente</div>
        </div>
        <div class="copy-number">${envelope.number}</div>
      </div>
      ${sharedFields}
      <div class="copy-footer">Tel: ${c?.phone || "—"}</div>
    </div>
  `

  const internalCopy = `
    <div class="copy">
      <div class="copy-header">
        <div>
          <div class="copy-title">Familia Santarelli</div>
          <div class="copy-sub">Copia interna</div>
        </div>
        <div class="copy-number">${envelope.number}</div>
      </div>
      ${sharedFields}
      ${envelope.jeweler ? `<div class="row"><span class="label">Joyero</span><span class="value">${envelope.jeweler.name}</span></div>` : ""}
      ${envelope.internal_notes ? `<div class="internal-notes"><div class="work-label">Notas internas</div><div class="work-text">${envelope.internal_notes}</div></div>` : ""}
      <div class="copy-footer">Tel: ${c?.phone || "—"}</div>
    </div>
  `

  const html = `<!DOCTYPE html><html><head>
    <meta charset="UTF-8"><title>Sobre ${envelope.number}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      @page { size: A5 landscape; margin: 6mm; }
      body { font-family: Arial, sans-serif; font-size: 9pt; }
      .copy {
        border: 1.5px solid #000;
        padding: 4mm 5mm;
        page-break-after: always;
        min-height: 130mm;
        display: flex;
        flex-direction: column;
        gap: 1.5mm;
      }
      .copy:last-child { page-break-after: avoid; }
      .copy-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 1.5mm;
      }
      .copy-title { font-size: 11pt; font-weight: bold; }
      .copy-sub { font-size: 7.5pt; color: #555; }
      .copy-number { font-size: 16pt; font-weight: bold; font-family: monospace; letter-spacing: 1px; }
      .divider { border-top: 0.5px solid #bbb; margin: 1mm 0; }
      .row { display: flex; gap: 4mm; align-items: baseline; }
      .label { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.3px; color: #666; min-width: 26mm; flex-shrink: 0; }
      .value { font-size: 9pt; font-weight: 600; }
      .mono { font-family: monospace; }
      .work-label { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.3px; color: #666; margin-bottom: 1mm; }
      .work-text { font-size: 9pt; border: 0.5px solid #bbb; border-radius: 1.5px; padding: 1.5mm 2mm; min-height: 14mm; white-space: pre-wrap; }
      .internal-notes { margin-top: 1mm; }
      .copy-footer { margin-top: auto; padding-top: 2mm; font-size: 7.5pt; color: #555; border-top: 0.5px dashed #bbb; }
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
  productType: "jewelry" | "watch"
  productSubtypeId: string
  productMaterial: string
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
  productType: "jewelry",
  productSubtypeId: "",
  productMaterial: "",
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
  const { customers, jewelers, envelopeSubtypes, warehouses, addCustomer, createEnvelope } = useInventory()
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

  const canAdvanceCustomer = () =>
    form.customerMode === "existing"
      ? !!form.customerId
      : !!form.newFirstName.trim() && !!form.newLastName.trim() && !!form.newDni.trim()

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
        product_type: form.productType,
        product_subtype_id: form.productSubtypeId || null,
        product_material: form.productMaterial.trim() || null,
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
              <Input value={form.productMaterial} onChange={e => set("productMaterial", e.target.value)} placeholder="Ej: Oro 18k, Plata 925" />
            </div>

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
  onUpdated: (id: string, updates: Partial<Envelope>, statusNote?: string) => Promise<void>
  onPrint: (envelope: Envelope) => void
}

function EnvelopeDetailDialog({ envelope, onClose, onUpdated, onPrint }: EnvelopeDetailDialogProps) {
  const { jewelers } = useInventory()

  // Editable fields state
  const [editing, setEditing] = useState(false)
  const [editPhone, setEditPhone] = useState("")
  const [editAddress, setEditAddress] = useState("")
  const [editPurchasedAtStore, setEditPurchasedAtStore] = useState(false)
  const [editPurchaseDate, setEditPurchaseDate] = useState("")
  const [editJewelerId, setEditJewelerId] = useState("")
  const [editQuoteStatus, setEditQuoteStatus] = useState<QuoteStatus>("not_required")
  const [editQuoteAmount, setEditQuoteAmount] = useState("")
  const [editQuoteNotes, setEditQuoteNotes] = useState("")
  const [editEstimatedReadyDate, setEditEstimatedReadyDate] = useState("")
  const [editInternalNotes, setEditInternalNotes] = useState("")
  const [saving, setSaving] = useState(false)

  // Status change
  const [changingStatus, setChangingStatus] = useState(false)
  const [targetStatus, setTargetStatus] = useState<EnvelopeStatus | null>(null)
  const [statusNote, setStatusNote] = useState("")
  const [savingStatus, setSavingStatus] = useState(false)

  useEffect(() => {
    if (envelope) {
      setEditing(false)
      setChangingStatus(false)
      setTargetStatus(null)
      setStatusNote("")
      // Pre-fill editable fields
      setEditPhone(envelope.customer?.phone || "")
      setEditAddress(envelope.customer?.address || "")
      setEditPurchasedAtStore(envelope.purchased_at_store)
      setEditPurchaseDate(envelope.purchase_date || "")
      setEditJewelerId(envelope.jeweler_id || "")
      setEditQuoteStatus(envelope.quote_status)
      setEditQuoteAmount(envelope.quote_amount?.toString() || "")
      setEditQuoteNotes(envelope.quote_notes || "")
      setEditEstimatedReadyDate(envelope.estimated_ready_date || "")
      setEditInternalNotes(envelope.internal_notes || "")
    }
  }, [envelope])

  if (!envelope) return null

  const c = envelope.customer
  const nextStatuses = NEXT_STATUSES[envelope.status] || []

  const handleSaveEdits = async () => {
    setSaving(true)
    try {
      const parsedAmount = editQuoteAmount ? parseFloat(editQuoteAmount) : null

      // Auto-transition: if pending and monto entered → informed
      let resolvedStatus = editQuoteStatus
      let resolvedInformedAt: string | null = envelope.quote_informed_at
      if (
        editQuoteStatus === "pending" &&
        parsedAmount !== null &&
        envelope.quote_status !== "informed"
      ) {
        resolvedStatus = "informed"
        resolvedInformedAt = new Date().toISOString()
      } else if (editQuoteStatus === "informed" && envelope.quote_status !== "informed") {
        resolvedInformedAt = new Date().toISOString()
      }

      const envelopeUpdates: Partial<Envelope> = {
        purchased_at_store: editPurchasedAtStore,
        purchase_date: editPurchaseDate || null,
        jeweler_id: editJewelerId || null,
        quote_status: resolvedStatus,
        quote_amount: parsedAmount,
        quote_notes: editQuoteNotes.trim() || null,
        quote_informed_at: resolvedInformedAt,
        estimated_ready_date: editEstimatedReadyDate || null,
        internal_notes: editInternalNotes.trim() || null,
      }
      await onUpdated(envelope.id, envelopeUpdates)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async () => {
    if (!targetStatus) return
    setSavingStatus(true)
    try {
      await onUpdated(envelope.id, { status: targetStatus }, statusNote || undefined)
      setChangingStatus(false)
      setTargetStatus(null)
      setStatusNote("")
    } finally {
      setSavingStatus(false)
    }
  }

  return (
    <Dialog open={!!envelope} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <DialogTitle className="font-mono text-xl">{envelope.number}</DialogTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={envelope.status} />
              <QuoteBadge status={envelope.quote_status} />
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-4 text-sm">
          {/* Cliente — datos históricos */}
          <section>
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Cliente</p>
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

          {/* Recepción — histórico */}
          <section className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Local receptor</p>
              <p className="font-medium">{envelope.received_warehouse?.name || "—"}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Fecha recepción</p>
              <p className="font-medium">{formatDate(envelope.received_at)}</p>
            </div>
          </section>

          {/* Artículo — histórico */}
          <section>
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Artículo</p>
            <div className="rounded-lg border border-border p-3 grid gap-1">
              <p className="font-semibold">
                {envelope.product_type === "jewelry" ? "Joyería" : "Relojería"}
                {envelope.product_subtype?.name ? ` — ${envelope.product_subtype.name}` : ""}
              </p>
              {envelope.product_material && <p className="text-muted-foreground text-xs">Material: {envelope.product_material}</p>}
              <p className="text-muted-foreground text-xs">Estado: {CONDITION_LABELS[envelope.product_condition]}</p>
              {envelope.product_condition_notes && <p className="text-muted-foreground text-xs">{envelope.product_condition_notes}</p>}
              {!editing ? (
                envelope.purchased_at_store && (
                  <p className="text-green-600 dark:text-green-400 text-xs">
                    ✓ Comprado en Santarelli{envelope.purchase_date ? ` el ${formatDate(envelope.purchase_date)}` : ""}
                  </p>
                )
              ) : (
                <div className="mt-2 grid gap-2">
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

          {/* Trabajo — histórico */}
          <section>
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Trabajo solicitado</p>
            <div className="rounded-lg border border-border p-3">
              <p className="whitespace-pre-wrap">{envelope.work_description}</p>
            </div>
          </section>

          {/* Campos editables */}
          <section>
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Asignación y presupuesto</p>
            <div className="rounded-lg border border-border p-3 grid gap-2">
              {!editing ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-xs">Joyero</span>
                    <span className="text-sm font-medium">{envelope.jeweler?.name || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-xs">Presupuesto</span>
                    <span className="text-sm font-medium">{QUOTE_STATUS_LABELS[envelope.quote_status]}</span>
                  </div>
                  {envelope.quote_amount != null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs">Monto</span>
                      <span className="text-sm font-semibold">${envelope.quote_amount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {envelope.quote_notes && (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground text-xs shrink-0">Detalle</span>
                      <span className="text-sm text-right">{envelope.quote_notes}</span>
                    </div>
                  )}
                  {envelope.estimated_ready_date && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs">Fecha estimada</span>
                      <span className="text-sm font-medium">{formatDate(envelope.estimated_ready_date)}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="grid gap-3">
                  <div className="grid gap-1">
                    <Label className="text-xs">Joyero</Label>
                    <Select value={editJewelerId || "none"} onValueChange={(v) => setEditJewelerId(v === "none" ? "" : v)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin asignar</SelectItem>
                        {jewelers.filter(j => j.is_active).map(j => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Estado del presupuesto</Label>
                    <Select value={editQuoteStatus} onValueChange={(v) => setEditQuoteStatus(v as QuoteStatus)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(QUOTE_STATUS_LABELS) as QuoteStatus[]).map(qs => (
                          <SelectItem key={qs} value={qs}>{QUOTE_STATUS_LABELS[qs]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {editQuoteStatus !== "not_required" && (
                    <>
                      <div className="grid gap-1">
                        <Label className="text-xs">
                          Monto
                          {editQuoteStatus === "pending" && editQuoteAmount
                            ? <span className="ml-1 text-blue-600 dark:text-blue-400 font-normal">→ se marcará como Informado al guardar</span>
                            : <span className="text-muted-foreground font-normal"> (Opcional)</span>}
                        </Label>
                        <Input type="number" value={editQuoteAmount} onChange={e => setEditQuoteAmount(e.target.value)}
                          className="h-8 text-sm" placeholder="25000" min="0" step="0.01" />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs">Detalle del presupuesto <span className="text-muted-foreground font-normal">(Opcional)</span></Label>
                        <Input value={editQuoteNotes} onChange={e => setEditQuoteNotes(e.target.value)}
                          className="h-8 text-sm" placeholder="Ej: Cambio de cierre + soldadura" />
                      </div>
                    </>
                  )}
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

          {!editing && envelope.internal_notes && (
            <section>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Notas internas</p>
              <div className="rounded-lg border border-border p-3">
                <p className="text-muted-foreground whitespace-pre-wrap text-sm">{envelope.internal_notes}</p>
              </div>
            </section>
          )}

          {/* Acciones de edición */}
          {!changingStatus && (
            <div className="flex gap-2">
              {!editing ? (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
                  <Button size="sm" onClick={handleSaveEdits} disabled={saving}>
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Cambio de estado */}
          {!editing && nextStatuses.length > 0 && (
            <section>
              <Separator className="my-1" />
              {!changingStatus ? (
                <Button variant="outline" size="sm" onClick={() => setChangingStatus(true)}>
                  <Clock className="mr-1.5 h-4 w-4" /> Cambiar estado
                </Button>
              ) : (
                <div className="grid gap-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Nuevo estado</p>
                  <div className="flex flex-wrap gap-2">
                    {nextStatuses.map(s => (
                      <button key={s} onClick={() => setTargetStatus(s)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-all border ${targetStatus === s ? "ring-2 ring-primary" : ""} ${STATUS_COLORS[s]}`}>
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Nota <span className="text-muted-foreground">(Opcional)</span></Label>
                    <Input value={statusNote} onChange={e => setStatusNote(e.target.value)} placeholder="Ej: El cliente aprobó el presupuesto" />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setChangingStatus(false); setTargetStatus(null) }}>Cancelar</Button>
                    <Button size="sm" disabled={!targetStatus || savingStatus} onClick={handleStatusChange}>
                      {savingStatus ? "Guardando..." : "Confirmar"}
                    </Button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={() => onPrint(envelope)}>
            <Printer className="mr-1.5 h-4 w-4" /> Imprimir
          </Button>
          <Button onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

const ALL_STATUSES: EnvelopeStatus[] = ["received", "quote_pending", "quote_approved", "in_workshop", "ready", "delivered", "cancelled"]

export default function SobresPage() {
  const { fetchEnvelopes, updateEnvelope, updateCustomer } = useInventory()
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

  const handleUpdated = useCallback(async (id: string, updates: Partial<Envelope>, statusNote?: string) => {
    await updateEnvelope(id, updates, statusNote)

    // Also update customer phone/address if those were passed (not directly in envelope)
    // Note: phone/address live on the customer record, but we pass them through the edit handler
    // The edit handler in the detail dialog calls updateCustomer separately if needed.
    // Here we just merge into local state.
    setEnvelopes(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
    setDetailEnvelope(prev => prev && prev.id === id ? { ...prev, ...updates } : prev)
  }, [updateEnvelope])

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
                  <TableHead>Recibido</TableHead>
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
                        {e.product_material && <p className="text-xs text-muted-foreground">{e.product_material}</p>}
                      </TableCell>
                      <TableCell><StatusBadge status={e.status} /></TableCell>
                      <TableCell>
                        {e.quote_status !== "not_required" && (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${QUOTE_STATUS_COLORS[e.quote_status]}`}>
                            {QUOTE_STATUS_LABELS[e.quote_status]}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(e.received_at)}</TableCell>
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
