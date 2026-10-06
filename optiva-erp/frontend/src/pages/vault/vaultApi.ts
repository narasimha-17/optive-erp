import { api, tokenStore } from '../../api/client'

export const FOLDERS = ['Finance', 'Legal', 'Procurement', 'Sales', 'HR', 'Governance', 'General'] as const
export const DOC_TYPES = ['Invoice', 'Contract', 'NDA', 'Purchase Order', 'HR Document', 'Policy', 'Financial Report', 'Meeting Minutes', 'Proposal', 'Other'] as const
export const DOC_STATUSES = ['Draft', 'Pending approval', 'Approved', 'Rejected', 'Awaiting signature', 'Signed', 'Archived'] as const

export interface Person {
  id: number
  name: string
  email: string
  role: string
}

export interface DocSummary {
  id: string
  title: string
  filename: string
  size: number
  docType: string
  confidence: number
  tags: string[]
  folder: string
  status: string
  visibility: 'Private' | 'Company'
  owner: { id: number; name: string }
  retentionPolicy: string | null
  retentionUntil: string | null
  daysToRetention: number | null
  legalHold: boolean
  version: number
  archived: boolean
  createdAt: string
  updatedAt: string
  score?: number
  snippet?: string
  matched?: string[]
}

export interface Overview {
  total: number
  pendingApprovals: number
  awaitingSignature: number
  expiringSoon: number
  storageBytes: number
  folders: Record<string, number>
  statuses: Record<string, number>
  types: Record<string, number>
  recent: AuditEntry[]
}

export interface Chip {
  kind: string
  label: string
}

export interface ListResponse {
  results: DocSummary[]
  total: number
  interpreted: Chip[]
  terms: string[]
}

export interface AuditEntry {
  id: number
  docId: string | null
  docTitle: string
  actor: string
  action: string
  detail: string
  at: string
}

export interface Policy {
  id: string
  name: string
  years: number
  action: string
  description: string
  documents?: number
  due?: number
}

export interface DocDetail extends DocSummary {
  caps: { view: boolean; edit: boolean; manage: boolean; delete: boolean; approve: boolean; sign: boolean }
  preview: string
  intelligence: {
    summary: string
    amounts: string[]
    dates: string[]
    parties: string[]
    references: string[]
    emails: string[]
    keyTerms: string[]
    flags: { level: 'info' | 'warn'; label: string }[]
    wordCount: number
  }
  classification: { docType: string; confidence: number; suggestedFolder: string; suggestedRetention: string }
  versions: { version: number; filename: string; size: number; sha256: string; note: string; uploadedBy: string; createdAt: string; current: boolean }[]
  approvals: {
    id: number
    version: number
    status: string
    requestNote: string
    comment: string
    requestedBy: string
    approver: Person
    createdAt: string
    decidedAt: string | null
    canDecide: boolean
  }[]
  signatures: {
    id: number
    version: number
    signerName: string
    signerEmail: string
    status: string
    typedName: string
    drawing: string
    docHash: string
    signedAt: string | null
    createdAt: string
    canSign: boolean
  }[]
  shares: { email: string; permission: 'view' | 'edit'; name: string }[]
  retention: { policy: Policy | null; until: string | null; legalHold: boolean }
  audit: AuditEntry[]
}

export interface ApprovalItem {
  id: number
  docId: string
  docTitle: string
  docType: string
  version: number
  status: string
  requestNote: string
  comment: string
  requestedBy: string
  approver: string
  createdAt: string
  decidedAt: string | null
}

export interface SignatureItem {
  id: number
  docId: string
  docTitle: string
  docType: string
  version: number
  signerName: string
  signerEmail: string
  status: string
  signedAt: string | null
  requestedBy: string
  createdAt: string
  canSign: boolean
}

export interface RetentionData {
  policies: Policy[]
  upcoming: (DocSummary & { daysLeft: number })[]
  legalHold: number
  overdue: number
}

const j = (body: unknown) => ({ body })

export const vault = {
  overview: () => api<Overview>('/vault/overview'),
  people: () => api<Person[]>('/vault/people'),
  list: (p: { q?: string; folder?: string; type?: string; status?: string; sort?: string }) => {
    const qs = new URLSearchParams()
    if (p.q) qs.set('q', p.q)
    if (p.folder) qs.set('folder', p.folder)
    if (p.type) qs.set('doc_type', p.type)
    if (p.status) qs.set('status', p.status)
    if (p.sort) qs.set('sort', p.sort)
    return api<ListResponse>(`/vault/documents?${qs}`)
  },
  get: (id: string) => api<DocDetail>(`/vault/documents/${id}`),
  upload: (b: { filename: string; content_b64: string; mime: string; folder?: string; visibility: string }) =>
    api<DocDetail>('/vault/documents', { method: 'POST', ...j(b) }),
  addVersion: (id: string, b: { filename: string; content_b64: string; note: string }) =>
    api<DocDetail>(`/vault/documents/${id}/versions`, { method: 'POST', ...j(b) }),
  restore: (id: string, version: number) => api<DocDetail>(`/vault/documents/${id}/versions/${version}/restore`, { method: 'POST', ...j({}) }),
  patch: (id: string, b: Record<string, unknown>) => api<DocDetail>(`/vault/documents/${id}`, { method: 'PATCH', ...j(b) }),
  reclassify: (id: string) => api<DocDetail>(`/vault/documents/${id}/reclassify`, { method: 'POST', ...j({}) }),
  access: (id: string, b: { visibility: string; shares: { email: string; permission: string }[] }) =>
    api<DocDetail>(`/vault/documents/${id}/access`, { method: 'PUT', ...j(b) }),
  remove: (id: string) => api<{ deleted: string }>(`/vault/documents/${id}`, { method: 'DELETE' }),
  requestApproval: (id: string, b: { approver_id: number; note: string }) => api<DocDetail>(`/vault/documents/${id}/approvals`, { method: 'POST', ...j(b) }),
  decide: (approvalId: number, b: { decision: 'Approved' | 'Rejected'; comment: string }) =>
    api<DocDetail>(`/vault/approvals/${approvalId}/decide`, { method: 'POST', ...j(b) }),
  approvals: () => api<{ assigned: ApprovalItem[]; requested: ApprovalItem[] }>('/vault/approvals'),
  requestSignatures: (id: string, signers: { name: string; email: string }[]) =>
    api<DocDetail>(`/vault/documents/${id}/signatures`, { method: 'POST', ...j({ signers }) }),
  cancelSignatures: (id: string) => api<DocDetail>(`/vault/documents/${id}/signatures/cancel`, { method: 'POST', ...j({}) }),
  sign: (sigId: number, b: { typed_name: string; consent: boolean; drawing: string }) =>
    api<DocDetail>(`/vault/signatures/${sigId}/sign`, { method: 'POST', ...j(b) }),
  remind: (sigId: number) => api<{ sent: boolean }>(`/vault/signatures/${sigId}/remind`, { method: 'POST', ...j({}) }),
  signatures: () => api<{ toSign: SignatureItem[]; sent: SignatureItem[] }>('/vault/signatures'),
  retention: () => api<RetentionData>('/vault/retention'),
  audit: (p: { docId?: string; action?: string; q?: string } = {}) => {
    const qs = new URLSearchParams()
    if (p.docId) qs.set('doc_id', p.docId)
    if (p.action) qs.set('action', p.action)
    if (p.q) qs.set('q', p.q)
    return api<{ entries: AuditEntry[]; actions: string[] }>(`/vault/audit?${qs}`)
  },
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',', 2)[1] ?? '')
    reader.onerror = () => reject(new Error('Could not read the file'))
    reader.readAsDataURL(file)
  })
}

export async function downloadDocument(id: string, filename: string, version?: number) {
  const res = await fetch(`/api/vault/documents/${id}/download${version ? `?version=${version}` : ''}`, {
    headers: { Authorization: `Bearer ${tokenStore.get()}` },
  })
  if (!res.ok) throw new Error('Download failed')
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/* ---------------------------------------------------------------- formatting */
export const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`)

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export function retentionLabel(days: number | null): { text: string; tone: 'ok' | 'warn' | 'coral' | 'neutral' } {
  if (days === null) return { text: 'Indefinite', tone: 'neutral' }
  if (days < 0) return { text: `Due ${Math.abs(days)} d ago`, tone: 'coral' }
  if (days <= 90) return { text: `${days} d left`, tone: 'warn' }
  if (days < 730) return { text: `${Math.round(days / 30)} mo left`, tone: 'neutral' }
  return { text: `${Math.round(days / 365)} yr left`, tone: 'neutral' }
}
