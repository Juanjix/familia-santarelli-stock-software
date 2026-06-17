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
import { Card, CardContent } from "@/components/ui/card"
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
} from "lucide-react"
import type { Envelope, EnvelopeStatus, Customer } from "@/lib/types"

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

// Valid next statuses for each status
const NEXT_STATUSES: Partial<Record<EnvelopeStatus, EnvelopeStatus[]>> = {
  received: ["quote_pending", "in_workshop", "cancelled"],
  quote_pending: ["quote_approved", "cancelled"],
  quote_approved: ["in_workshop", "cancelled"],
  in_workshop: ["ready", "cancelled"],
  ready: ["delivered"],
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

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

// ── Print helpers ───────────────────────────────────────────────────────────

function printEnvelope(envelope: Envelope) {
  const customer = envelope.customer
  const fullName = customer ? `${customer.last_name}, ${customer.first_name}` : "—"
  const subtype = envelope.product_subtype?.name || ""
  const type = envelope.product_type === "jewelry" ? "Joyería" : "Relojería"
  const condition = CONDITION_LABELS[envelope.product_condition] || envelope.product_condition

  const html = `
    <!DOCTYPE html><html><head>
    <meta charset="UTF-8"><title>Sobre ${envelope.number}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      @page { size: A5 landscape; margin: 10mm; }
      body { font-family: Arial, sans-serif; font-size: 10pt; }
      .sobre { border: 2px solid #000; padding: 6mm; height: 100%; display: flex; flex-direction: column; gap: 3mm; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; }
      .number { font-size: 18pt; font-weight: bold; letter-spacing: 1px; }
      .logo { font-size: 9pt; text-align: right; color: #444; }
      .divider { border-top: 1px solid #000; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm 6mm; }
      .field { display: flex; flex-direction: column; gap: 0.5mm; }
      .field-label { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.5px; color: #666; }
      .field-value { font-size: 10pt; font-weight: 600; }
      .work { flex: 1; }
      .work-text { border: 1px solid #999; border-radius: 2px; min-height: 18mm; padding: 2mm; font-size: 9pt; white-space: pre-wrap; }
      .footer { display: flex; justify-content: space-between; font-size: 8pt; color: #555; }
    </style>
    </head><body>
    <div class="sobre">
      <div class="header">
        <div>
          <div class="number">${envelope.number}</div>
          <div style="font-size:9pt;color:#555">${STATUS_LABELS[envelope.status]}</div>
        </div>
        <div class="logo">
          <strong>Familia Santarelli</strong><br>
          ${formatDate(envelope.received_at)}
        </div>
      </div>
      <div class="divider"></div>
      <div class="grid">
        <div class="field"><div class="field-label">Cliente</div><div class="field-value">${fullName}</div></div>
        <div class="field"><div class="field-label">DNI</div><div class="field-value">${customer?.dni || "—"}</div></div>
        <div class="field"><div class="field-label">Artículo</div><div class="field-value">${type}${subtype ? ` — ${subtype}` : ""}</div></div>
        <div class="field"><div class="field-label">Estado artículo</div><div class="field-value">${condition}</div></div>
        ${envelope.product_material ? `<div class="field"><div class="field-label">Material</div><div class="field-value">${envelope.product_material}</div></div>` : ""}
        ${envelope.requires_quote ? `<div class="field"><div class="field-label">Presupuesto</div><div class="field-value">${envelope.quote_amount ? `$${envelope.quote_amount.toLocaleString("es-AR")}` : "Pendiente"}</div></div>` : ""}
        ${envelope.estimated_ready_date ? `<div class="field"><div class="field-label">Fecha estimada</div><div class="field-value">${formatDate(envelope.estimated_ready_date)}</div></div>` : ""}
        ${envelope.jeweler?.name ? `<div class="field"><div class="field-label">Joyero</div><div class="field-value">${envelope.jeweler.name}</div></div>` : ""}
      </div>
      <div class="work">
        <div class="field-label" style="margin-bottom:1mm">Trabajo solicitado</div>
        <div class="work-text">${envelope.work_description}</div>
      </div>
      <div class="footer">
        <span>${envelope.received_warehouse?.name || ""}</span>
        <span>Tel: ${customer?.phone || "—"}</span>
      </div>
    </div>
    <script>window.print();</script>
    </body></html>
  `

  const win = window.open("", "_blank")
  if (!win) return
  win.document.write(html)
  win.document.close()
}

// ── New Envelope Wizard ─────────────────────────────────────────────────────

type WizardStep = "customer" | "product" | "work" | "confirm"

interface WizardState {
  // Step 1: customer
  customerMode: "existing" | "new"
  customerId: string
  newFirstName: string
  newLastName: string
  newDni: string
  newPhone: string
  newAddress: string
  // Step 2: product
  productType: "jewelry" | "watch"
  productSubtypeId: string
  productMaterial: string
  productCondition: "very_good" | "good" | "regular"
  productConditionNotes: string
  purchasedAtStore: boolean
  purchaseDate: string
  // Step 3: work
  workDescription: string
  requiresQuote: boolean
  jewelerId: string
  estimatedReadyDate: string
  internalNotes: string
  // Meta
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
  requiresQuote: false,
  jewelerId: "",
  estimatedReadyDate: "",
  internalNotes: "",
  warehouseId: "",
}

function WizardStepIndicator({ current, steps }: { current: WizardStep; steps: WizardStep[] }) {
  const currentIdx = steps.indexOf(current)
  const labels: Record<WizardStep, string> = {
    customer: "Cliente",
    product: "Artículo",
    work: "Trabajo",
    confirm: "Confirmar",
  }
  return (
    <div className="flex items-center gap-1 mb-4">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-1">
          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold
            ${i < currentIdx ? "bg-primary text-primary-foreground" : i === currentIdx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
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
      setForm({ ...defaultWizard, warehouseId: warehouses[0]?.id || "" })
      setError(null)
    }
  }, [open, warehouses])

  const canAdvanceCustomer = () => {
    if (form.customerMode === "existing") return !!form.customerId
    return !!form.newFirstName.trim() && !!form.newLastName.trim() && !!form.newDni.trim()
  }

  const canAdvanceProduct = () => !!form.productType && !!form.productCondition
  const canAdvanceWork = () => !!form.workDescription.trim()

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
        requires_quote: form.requiresQuote,
        quote_amount: null,
        quote_approved_at: null,
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

  const activeSubtypes = envelopeSubtypes.filter(s => s.is_active && s.product_type === form.productType)
  const customerSearch = form.newDni || ""
  const matchingCustomer = customerSearch.length >= 3
    ? customers.find(c => c.dni === customerSearch.trim())
    : undefined

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo sobre</DialogTitle>
        </DialogHeader>

        <WizardStepIndicator current={step} steps={STEPS} />

        {/* Step 1: Customer */}
        {step === "customer" && (
          <div className="grid gap-4">
            <div className="flex gap-2">
              <Button
                variant={form.customerMode === "existing" ? "default" : "outline"}
                size="sm"
                onClick={() => set("customerMode", "existing")}
              >
                Cliente existente
              </Button>
              <Button
                variant={form.customerMode === "new" ? "default" : "outline"}
                size="sm"
                onClick={() => set("customerMode", "new")}
              >
                Nuevo cliente
              </Button>
            </div>

            {form.customerMode === "existing" ? (
              <div className="grid gap-1.5">
                <Label>Cliente</Label>
                <Select value={form.customerId} onValueChange={(v) => set("customerId", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cliente..." />
                  </SelectTrigger>
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
                  <Input
                    value={form.newDni}
                    onChange={e => set("newDni", e.target.value)}
                    placeholder="12345678"
                  />
                  {matchingCustomer && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Ya existe: {matchingCustomer.last_name}, {matchingCustomer.first_name}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label>Teléfono <span className="text-muted-foreground text-xs">(Opcional)</span></Label>
                    <Input value={form.newPhone} onChange={e => set("newPhone", e.target.value)} placeholder="11-1234-5678" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Dirección <span className="text-muted-foreground text-xs">(Opcional)</span></Label>
                    <Input value={form.newAddress} onChange={e => set("newAddress", e.target.value)} placeholder="Av. Corrientes 123" />
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-1.5">
              <Label>Sucursal de recepción</Label>
              <Select value={form.warehouseId} onValueChange={(v) => set("warehouseId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar depósito..." />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.filter(w => w.is_active).map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Step 2: Product */}
        {step === "product" && (
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Tipo de artículo <span className="text-destructive">*</span></Label>
              <div className="flex gap-2">
                <Button
                  variant={form.productType === "jewelry" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { set("productType", "jewelry"); set("productSubtypeId", "") }}
                >
                  Joyería
                </Button>
                <Button
                  variant={form.productType === "watch" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { set("productType", "watch"); set("productSubtypeId", "") }}
                >
                  Relojería
                </Button>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Subtipo <span className="text-muted-foreground text-xs">(Opcional)</span></Label>
              <Select value={form.productSubtypeId || "none"} onValueChange={(v) => set("productSubtypeId", v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar subtipo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin especificar</SelectItem>
                  {activeSubtypes.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Material <span className="text-muted-foreground text-xs">(Opcional)</span></Label>
              <Input value={form.productMaterial} onChange={e => set("productMaterial", e.target.value)} placeholder="Ej: Oro 18k, Plata 925, Acero" />
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
              <Label>Observaciones del estado <span className="text-muted-foreground text-xs">(Opcional)</span></Label>
              <Input value={form.productConditionNotes} onChange={e => set("productConditionNotes", e.target.value)} placeholder="Ej: Rayado en la parte trasera" />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="purchased-at-store"
                checked={form.purchasedAtStore}
                onCheckedChange={(v) => set("purchasedAtStore", v)}
              />
              <Label htmlFor="purchased-at-store">Comprado en la joyería</Label>
            </div>

            {form.purchasedAtStore && (
              <div className="grid gap-1.5">
                <Label>Fecha de compra <span className="text-muted-foreground text-xs">(Opcional)</span></Label>
                <Input type="date" value={form.purchaseDate} onChange={e => set("purchaseDate", e.target.value)} />
              </div>
            )}
          </div>
        )}

        {/* Step 3: Work */}
        {step === "work" && (
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Trabajo solicitado <span className="text-destructive">*</span></Label>
              <Textarea
                value={form.workDescription}
                onChange={e => set("workDescription", e.target.value)}
                placeholder="Describir en detalle el trabajo a realizar..."
                rows={4}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="requires-quote"
                checked={form.requiresQuote}
                onCheckedChange={(v) => set("requiresQuote", v)}
              />
              <Label htmlFor="requires-quote">Requiere presupuesto previo</Label>
            </div>

            <div className="grid gap-1.5">
              <Label>Joyero asignado <span className="text-muted-foreground text-xs">(Opcional)</span></Label>
              <Select value={form.jewelerId || "none"} onValueChange={(v) => set("jewelerId", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {jewelers.filter(j => j.is_active).map(j => (
                    <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Fecha estimada de entrega <span className="text-muted-foreground text-xs">(Opcional)</span></Label>
              <Input type="date" value={form.estimatedReadyDate} onChange={e => set("estimatedReadyDate", e.target.value)} />
            </div>

            <div className="grid gap-1.5">
              <Label>Notas internas <span className="text-muted-foreground text-xs">(Opcional)</span></Label>
              <Textarea
                value={form.internalNotes}
                onChange={e => set("internalNotes", e.target.value)}
                placeholder="Notas visibles solo internamente..."
                rows={2}
              />
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === "confirm" && (
          <div className="grid gap-3 text-sm">
            <div className="rounded-lg bg-muted/50 border border-border p-3 grid gap-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cliente</span>
                <span className="font-medium">
                  {form.customerMode === "existing"
                    ? customers.find(c => c.id === form.customerId)?.last_name + ", " + customers.find(c => c.id === form.customerId)?.first_name
                    : `${form.newLastName}, ${form.newFirstName}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Artículo</span>
                <span className="font-medium">
                  {form.productType === "jewelry" ? "Joyería" : "Relojería"}
                  {envelopeSubtypes.find(s => s.id === form.productSubtypeId)?.name ? ` — ${envelopeSubtypes.find(s => s.id === form.productSubtypeId)?.name}` : ""}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estado artículo</span>
                <span className="font-medium">{CONDITION_LABELS[form.productCondition]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Presupuesto</span>
                <span className="font-medium">{form.requiresQuote ? "Sí, pendiente" : "No"}</span>
              </div>
              {form.estimatedReadyDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha estimada</span>
                  <span className="font-medium">{formatDate(form.estimatedReadyDate)}</span>
                </div>
              )}
            </div>
            <div className="rounded-lg bg-muted/50 border border-border p-3">
              <p className="text-muted-foreground text-xs mb-1">Trabajo solicitado</p>
              <p className="font-medium whitespace-pre-wrap">{form.workDescription}</p>
            </div>
            {error && (
              <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">{error}</p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 mt-2">
          {step !== "customer" && (
            <Button variant="outline" onClick={() => setStep(STEPS[STEPS.indexOf(step) - 1])}>
              Atrás
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          {step !== "confirm" ? (
            <Button
              onClick={() => setStep(STEPS[STEPS.indexOf(step) + 1])}
              disabled={
                (step === "customer" && !canAdvanceCustomer()) ||
                (step === "product" && !canAdvanceProduct()) ||
                (step === "work" && !canAdvanceWork())
              }
            >
              Siguiente
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Guardando..." : "Crear sobre"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Detail / Status Dialog ──────────────────────────────────────────────────

interface EnvelopeDetailDialogProps {
  envelope: Envelope | null
  onClose: () => void
  onStatusChange: (envelope: Envelope, newStatus: EnvelopeStatus, note?: string) => Promise<void>
  onPrint: (envelope: Envelope) => void
}

function EnvelopeDetailDialog({ envelope, onClose, onStatusChange, onPrint }: EnvelopeDetailDialogProps) {
  const { jewelers } = useInventory()
  const [changingStatus, setChangingStatus] = useState(false)
  const [targetStatus, setTargetStatus] = useState<EnvelopeStatus | null>(null)
  const [statusNote, setStatusNote] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (envelope) { setTargetStatus(null); setStatusNote(""); setChangingStatus(false) }
  }, [envelope])

  if (!envelope) return null

  const customer = envelope.customer
  const nextStatuses = NEXT_STATUSES[envelope.status] || []

  const handleStatusChange = async () => {
    if (!targetStatus) return
    setSaving(true)
    try {
      await onStatusChange(envelope, targetStatus, statusNote || undefined)
      setChangingStatus(false)
      setTargetStatus(null)
      setStatusNote("")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!envelope} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="font-mono text-xl">{envelope.number}</DialogTitle>
            <StatusBadge status={envelope.status} />
          </div>
        </DialogHeader>

        <div className="grid gap-4 text-sm">
          {/* Customer */}
          <section>
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Cliente</p>
            <div className="rounded-lg border border-border p-3 grid gap-1">
              <p className="font-semibold">{customer ? `${customer.last_name}, ${customer.first_name}` : "—"}</p>
              <p className="text-muted-foreground">DNI: {customer?.dni || "—"} · Tel: {customer?.phone || "—"}</p>
              {customer?.address && <p className="text-muted-foreground">{customer.address}</p>}
            </div>
          </section>

          {/* Product */}
          <section>
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Artículo</p>
            <div className="rounded-lg border border-border p-3 grid gap-1">
              <p className="font-semibold">
                {envelope.product_type === "jewelry" ? "Joyería" : "Relojería"}
                {envelope.product_subtype?.name ? ` — ${envelope.product_subtype.name}` : ""}
              </p>
              {envelope.product_material && <p className="text-muted-foreground">Material: {envelope.product_material}</p>}
              <p className="text-muted-foreground">Estado: {CONDITION_LABELS[envelope.product_condition]}</p>
              {envelope.product_condition_notes && <p className="text-muted-foreground">{envelope.product_condition_notes}</p>}
              {envelope.purchased_at_store && (
                <p className="text-green-600 dark:text-green-400 text-xs">✓ Comprado en la joyería{envelope.purchase_date ? ` el ${formatDate(envelope.purchase_date)}` : ""}</p>
              )}
            </div>
          </section>

          {/* Work */}
          <section>
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Trabajo solicitado</p>
            <div className="rounded-lg border border-border p-3">
              <p className="whitespace-pre-wrap">{envelope.work_description}</p>
            </div>
          </section>

          {/* Details */}
          <section className="grid grid-cols-2 gap-2">
            {envelope.jeweler && (
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Joyero</p>
                <p className="font-medium">{envelope.jeweler.name}</p>
              </div>
            )}
            {envelope.requires_quote && (
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Presupuesto</p>
                <p className="font-medium">{envelope.quote_amount ? `$${envelope.quote_amount.toLocaleString("es-AR")}` : "Pendiente"}</p>
              </div>
            )}
            {envelope.estimated_ready_date && (
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Fecha estimada</p>
                <p className="font-medium">{formatDate(envelope.estimated_ready_date)}</p>
              </div>
            )}
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Recibido</p>
              <p className="font-medium">{formatDate(envelope.received_at)}</p>
            </div>
          </section>

          {envelope.internal_notes && (
            <section>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Notas internas</p>
              <div className="rounded-lg border border-border p-3">
                <p className="text-muted-foreground whitespace-pre-wrap">{envelope.internal_notes}</p>
              </div>
            </section>
          )}

          {/* Status change */}
          {nextStatuses.length > 0 && (
            <section>
              <Separator className="my-1" />
              {!changingStatus ? (
                <Button variant="outline" size="sm" onClick={() => setChangingStatus(true)}>
                  <Clock className="mr-1.5 h-4 w-4" />
                  Cambiar estado
                </Button>
              ) : (
                <div className="grid gap-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Nuevo estado</p>
                  <div className="flex flex-wrap gap-2">
                    {nextStatuses.map(s => (
                      <button
                        key={s}
                        onClick={() => setTargetStatus(s)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-all border ${targetStatus === s ? "ring-2 ring-primary" : ""} ${STATUS_COLORS[s]}`}
                      >
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Nota (opcional)</Label>
                    <Input value={statusNote} onChange={e => setStatusNote(e.target.value)} placeholder="Ej: El cliente aprobó el presupuesto" />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setChangingStatus(false); setTargetStatus(null) }}>Cancelar</Button>
                    <Button size="sm" disabled={!targetStatus || saving} onClick={handleStatusChange}>
                      {saving ? "Guardando..." : "Confirmar"}
                    </Button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={() => onPrint(envelope)}>
            <Printer className="mr-1.5 h-4 w-4" />
            Imprimir
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
  const { fetchEnvelopes, updateEnvelope } = useInventory()
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
    const customer = e.customer
    return (
      e.number.toLowerCase().includes(q) ||
      (customer?.last_name || "").toLowerCase().includes(q) ||
      (customer?.first_name || "").toLowerCase().includes(q) ||
      (customer?.dni || "").includes(q)
    )
  })

  const handleCreated = (envelope: Envelope) => {
    setEnvelopes(prev => [envelope, ...prev])
    setNewOpen(false)
    setDetailEnvelope(envelope)
    printEnvelope(envelope)
  }

  const handleStatusChange = async (envelope: Envelope, newStatus: EnvelopeStatus, note?: string) => {
    await updateEnvelope(envelope.id, { status: newStatus }, note)
    // Update local state
    setEnvelopes(prev => prev.map(e => e.id === envelope.id ? { ...e, status: newStatus } : e))
    setDetailEnvelope(prev => prev && prev.id === envelope.id ? { ...prev, status: newStatus } : prev)
  }

  // Summary counts
  const activeCounts = envelopes.filter(e => !["delivered", "cancelled"].includes(e.status)).length

  return (
    <div className="flex flex-col h-full">
      <Header title="Sobres" />

      <main className="flex-1 overflow-auto p-4 md:p-6">
        {/* Toolbar */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, cliente o DNI..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as EnvelopeStatus | "all")}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {ALL_STATUSES.map(s => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            {activeCounts > 0 && (
              <Badge variant="secondary">{activeCounts} activos</Badge>
            )}
            <Button onClick={() => setNewOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Nuevo sobre
            </Button>
          </div>
        </div>

        {/* Table */}
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
                  <TableHead>Recibido</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(envelope => {
                  const c = envelope.customer
                  return (
                    <TableRow
                      key={envelope.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setDetailEnvelope(envelope)}
                    >
                      <TableCell className="font-mono font-semibold">{envelope.number}</TableCell>
                      <TableCell>
                        {c ? (
                          <div>
                            <p className="font-medium">{c.last_name}, {c.first_name}</p>
                            <p className="text-xs text-muted-foreground">DNI {c.dni}</p>
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{envelope.product_type === "jewelry" ? "Joyería" : "Relojería"}{envelope.product_subtype?.name ? ` — ${envelope.product_subtype.name}` : ""}</p>
                          {envelope.product_material && <p className="text-xs text-muted-foreground">{envelope.product_material}</p>}
                        </div>
                      </TableCell>
                      <TableCell><StatusBadge status={envelope.status} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(envelope.received_at)}</TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  )
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                      {search || statusFilter !== "all" ? "Sin resultados para ese filtro." : "Todavía no hay sobres registrados."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      <NewEnvelopeDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={handleCreated}
      />

      <EnvelopeDetailDialog
        envelope={detailEnvelope}
        onClose={() => setDetailEnvelope(null)}
        onStatusChange={handleStatusChange}
        onPrint={printEnvelope}
      />
    </div>
  )
}
