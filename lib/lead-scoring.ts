import type { LeadSource } from './types'

export type LeadScore = 'hot' | 'medium' | 'cold'

export interface ScoreResult {
  score: LeadScore
  reason: string
}

/**
 * Parse a dollar amount from text.
 * Handles: "$600k", "$1M", "$300k-$600k" (uses lower end), "$600,000", "600000"
 * Returns number in dollars or null.
 */
export function parseBudget(text: string): number | null {
  if (!text) return null

  // Match patterns like $600k, $1.2M, $300k-$600k, $600,000, 600000
  // For ranges, we capture the first (lower) value
  const rangeMatch = text.match(/\$?([\d,]+(?:\.\d+)?)\s*([kKmM])?\s*[-–—]\s*\$?([\d,]+(?:\.\d+)?)\s*([kKmM])?/)
  if (rangeMatch) {
    return parseAmount(rangeMatch[1], rangeMatch[2])
  }

  // Single value: $600k, $1M, $600,000, 600000
  const singleMatch = text.match(/\$?([\d,]+(?:\.\d+)?)\s*([kKmM])?/)
  if (singleMatch) {
    return parseAmount(singleMatch[1], singleMatch[2])
  }

  return null
}

function parseAmount(numStr: string, suffix?: string): number | null {
  const num = parseFloat(numStr.replace(/,/g, ''))
  if (isNaN(num)) return null

  if (suffix) {
    const s = suffix.toLowerCase()
    if (s === 'k') return num * 1_000
    if (s === 'm') return num * 1_000_000
  }

  return num
}

/**
 * Extract structured fields from Facebook Lead Ad notes.
 */
export function parseFacebookFields(noteText: string): {
  budget: number | null
  howSoon: 'asap' | 'months' | 'year+' | null
  ownsLand: boolean | null
  message: string | null
} {
  const lines = noteText.split('\n')
  let budget: number | null = null
  let howSoon: 'asap' | 'months' | 'year+' | null = null
  let ownsLand: boolean | null = null
  let message: string | null = null

  for (const line of lines) {
    const trimmed = line.trim()

    // Budget line
    const budgetMatch = trimmed.match(/^Budget:\s*(.+)/i)
    if (budgetMatch) {
      budget = parseBudget(budgetMatch[1])
      continue
    }

    // How Soon line
    const howSoonMatch = trimmed.match(/^How Soon:\s*(.+)/i)
    if (howSoonMatch) {
      const val = howSoonMatch[1].toLowerCase().trim()
      if (val.includes('asap') || val.includes('immediate') || val.includes('now') || val.includes('ready')) {
        howSoon = 'asap'
      } else if (val.includes('year') || val.includes('12') || val.includes('not sure') || val.includes('later')) {
        howSoon = 'year+'
      } else {
        // "3-6 months", "6 months", "within months", etc.
        howSoon = 'months'
      }
      continue
    }

    // Owns Land line
    const ownsLandMatch = trimmed.match(/^Owns Land:\s*(.+)/i)
    if (ownsLandMatch) {
      const val = ownsLandMatch[1].toLowerCase().trim()
      ownsLand = val === 'yes' || val === 'true' || val === 'y'
      continue
    }

    // Message line
    const messageMatch = trimmed.match(/^Message:\s*(.+)/i)
    if (messageMatch) {
      const msgText = messageMatch[1].trim()
      if (msgText) {
        message = msgText
      }
      continue
    }
  }

  return { budget, howSoon, ownsLand, message }
}

/**
 * Extract cost and message fields from cost calculator notes.
 * Handles both legacy single "Estimated Build Cost:" format and
 * the new tiered cost format (Economy/Standard/Premium tiers).
 */
export function parseCostCalcFields(noteText: string): {
  estimatedBuildCost: number | null
  message: string | null
} {
  const lines = noteText.split('\n')
  let estimatedBuildCost: number | null = null
  let message: string | null = null
  let highestCost: number | null = null

  for (const line of lines) {
    const trimmed = line.trim()

    // Legacy single cost line
    const legacyCostMatch = trimmed.match(/^Estimated Build Cost:\s*(.+)/i)
    if (legacyCostMatch) {
      estimatedBuildCost = parseBudget(legacyCostMatch[1])
      continue
    }

    // Tiered cost lines — track the highest one (Premium w/ Contractor)
    const tierMatch = trimmed.match(/^(?:Economy|Standard|Premium)\s*\([^)]+\):\s*(.+)/i)
    if (tierMatch) {
      const cost = parseBudget(tierMatch[1])
      if (cost !== null && (highestCost === null || cost > highestCost)) {
        highestCost = cost
      }
      continue
    }

    // Message line
    const messageMatch = trimmed.match(/^Message:\s*(.+)/i)
    if (messageMatch) {
      const msgText = messageMatch[1].trim()
      if (msgText) {
        message = msgText
      }
      continue
    }
  }

  // Use legacy cost if found, otherwise use highest tiered cost
  if (estimatedBuildCost === null) {
    estimatedBuildCost = highestCost
  }

  return { estimatedBuildCost, message }
}

/**
 * Deterministic lead scoring.
 * Pure function: takes a contact's lead_source and initial note text,
 * returns { score, reason }.
 */
export function scoreContact(leadSource: LeadSource | string | null, noteText: string | null): ScoreResult {
  const source = leadSource ?? ''
  const text = noteText ?? ''

  // Facebook Lead Ad
  if (source === 'facebook_ad') {
    const { budget, howSoon, ownsLand, message } = parseFacebookFields(text)

    // Hard disqualify: budget under $400k
    if (budget !== null && budget < 400_000) {
      return { score: 'cold', reason: 'Budget under $400k' }
    }

    // Count hot signals
    const signals: string[] = []
    if (budget !== null && budget >= 600_000) {
      signals.push('budget >= $600k')
    }
    if (message && message.split(/\s+/).length > 15) {
      signals.push('detailed message')
    }
    if (ownsLand === true && howSoon === 'asap') {
      signals.push('owns land & ready ASAP')
    }

    if (signals.length >= 2) {
      return { score: 'hot', reason: signals.join(', ') }
    }

    return { score: 'medium', reason: 'Insufficient qualifying signals' }
  }

  // Cost Calculator
  if (source === 'cost_calculator') {
    const { estimatedBuildCost, message } = parseCostCalcFields(text)

    if (estimatedBuildCost !== null && estimatedBuildCost > 1_000_000 && message) {
      return { score: 'hot', reason: 'Build cost over $1M with project details' }
    }

    return { score: 'cold', reason: 'Build cost under $1M or no message included' }
  }

  // Contact Form
  if (source === 'contact_form') {
    return { score: 'hot', reason: 'Direct contact form inquiry' }
  }

  // Default / unknown source
  return { score: 'medium', reason: 'Unable to determine lead quality' }
}
