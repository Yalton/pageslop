import { isJunkToken, normalizeTag } from './classify'

export interface TagRow {
  id: string
  name: string
  source: string
}

export interface TagCleanupPlan {
  /** Move this tag's links onto the tag named `toName`, then drop it. */
  merges: { fromId: string; toName: string }[]
  /** Junk tags to drop outright, with their link_tags. */
  deletes: string[]
}

/**
 * Plans the cleanup of one user's existing tags. Rule tags the extractor would
 * now reject are dropped; generated tags with a plural form fold into the
 * singular. Tags the user typed are left as they are.
 */
export function planTagCleanup(rows: TagRow[]): TagCleanupPlan {
  const plan: TagCleanupPlan = { merges: [], deletes: [] }
  for (const row of rows) {
    if (row.source === 'user') continue
    if (row.source === 'rule' && isJunkToken(row.name)) {
      plan.deletes.push(row.id)
      continue
    }
    const singular = normalizeTag(row.name)
    if (singular !== row.name) plan.merges.push({ fromId: row.id, toName: singular })
  }
  return plan
}
