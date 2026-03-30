import type { GatewaySessionRow } from '../types'

/** Statuts côté gateway / sous-agent pouvant indiquer un travail en cours. */
export function isGatewaySessionRowWorking(row: Pick<GatewaySessionRow, 'status'>): boolean {
  const s = (row.status ?? '').toLowerCase().trim()
  if (!s) return false
  return (
    s === 'running' ||
    s === 'pending' ||
    s === 'active' ||
    s === 'busy' ||
    s === 'starting'
  )
}

/** Session en activité : run chat local en attente ou statut gateway « travail ». */
export function isSessionBusy(
  row: GatewaySessionRow,
  pendingRunIdBySession: Record<string, string>,
): boolean {
  if (Boolean(pendingRunIdBySession[row.key])) return true
  return isGatewaySessionRowWorking(row)
}
