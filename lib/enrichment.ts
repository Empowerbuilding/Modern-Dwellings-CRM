import { createClient } from '@supabase/supabase-js'

// ── Trestle reverse phone enrichment ─────────────────────────────────────────
export async function enrichWithTrestle(phone: string) {
  const key = process.env.TRESTLE_API_KEY
  if (!key) return null
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length < 10) return null
  try {
    const res = await fetch(`https://api.trestleiq.com/3.2/phone?phone=${cleaned}`, {
      headers: { 'x-api-key': key },
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.is_valid) return null
    const owner = data.owners?.[0] || null
    const addr = owner?.current_addresses?.[0] || null
    const emails: string[] =
      owner?.emails?.map((e: { email_address: string }) => e.email_address).filter(Boolean) || []
    return {
      trestle_line_type: data.line_type || null,
      trestle_carrier: data.carrier || null,
      trestle_is_prepaid: data.is_prepaid ?? null,
      trestle_is_commercial: data.is_commercial ?? null,
      trestle_owner_name: owner?.name || null,
      trestle_owner_type: owner?.type || null,
      trestle_owner_age_range: owner?.age_range || null,
      trestle_owner_gender: owner?.gender || null,
      trestle_address: addr
        ? [addr.street_line_1, addr.street_line_2].filter(Boolean).join(' ') || null
        : null,
      trestle_city: addr?.city || null,
      trestle_state: addr?.state_code || null,
      trestle_zip: addr?.postal_code || null,
      trestle_emails: emails.length > 0 ? emails : null,
      trestle_enriched_at: new Date().toISOString(),
    }
  } catch (e) {
    console.error('[Trestle error]', e)
    return null
  }
}

// ── ATTOM property enrichment (chained from Trestle address) ─────────────────
export async function enrichWithAttom(
  address: string,
  city: string,
  state: string,
  zip: string,
) {
  const key = process.env.ATTOM_API_KEY
  if (!key || !address || !city || !state) return null
  try {
    const a1 = encodeURIComponent(address)
    const a2 = encodeURIComponent(`${city} ${state} ${zip}`.trim())
    const avmRes = await fetch(
      `https://api.gateway.attomdata.com/propertyapi/v1.0.0/avm/detail?address1=${a1}&address2=${a2}`,
      { headers: { apikey: key, Accept: 'application/json' } },
    )
    if (!avmRes.ok) return null
    const avmData = await avmRes.json()
    const p = avmData?.property?.[0]
    if (!p) return null
    const avm = p.avm?.amount || {}
    const lot = p.lot || {}
    const bldg = p.building || {}
    const summary = p.summary || {}
    const sale = p.sale?.saleAmountData || {}
    return {
      attom_avm_value: avm.value || null,
      attom_avm_high: avm.high || null,
      attom_avm_low: avm.low || null,
      attom_avm_score: avm.scr || null,
      attom_lot_acres: lot.lotsize2 || null,
      attom_sqft: bldg.size?.universalsize || bldg.size?.bldgsize || null,
      attom_beds: bldg.rooms?.beds || null,
      attom_baths: bldg.rooms?.bathstotal || null,
      attom_year_built: bldg.yearbuilt || summary.yearbuilt || null,
      attom_owner_occupied: summary.absenteeInd
        ? summary.absenteeInd.toLowerCase().includes('owner')
        : null,
      attom_prop_type: summary.proptype || null,
      attom_last_sale_price: sale.saleamt || null,
      attom_last_sale_date: sale.saledisc || null,
      attom_enriched_at: new Date().toISOString(),
    }
  } catch (e) {
    console.error('[Attom error]', e)
    return null
  }
}

// ── Fire-and-forget enrichment for a contact (Trestle → chain Attom) ─────────
// Call this after any new contact is created. Pass the supabase service client.
export function fireEnrichment(
  supabase: ReturnType<typeof createClient>,
  contactId: string,
  phone: string,
  label = '',
) {
  enrichWithTrestle(phone)
    .then(async (trestle) => {
      if (!trestle) return
      await supabase.from('contacts').update(trestle).eq('id', contactId)
      console.log(
        `[Trestle${label}] Enriched ${contactId}: ${trestle.trestle_owner_name} | ${trestle.trestle_line_type} | ${trestle.trestle_city}, ${trestle.trestle_state}`,
      )
      if (trestle.trestle_address && trestle.trestle_city && trestle.trestle_state) {
        enrichWithAttom(
          trestle.trestle_address,
          trestle.trestle_city,
          trestle.trestle_state,
          trestle.trestle_zip || '',
        )
          .then(async (attom) => {
            if (!attom) return
            await supabase.from('contacts').update(attom).eq('id', contactId)
            console.log(
              `[Attom${label}] Enriched ${contactId}: AVM $${attom.attom_avm_value?.toLocaleString()} | ${attom.attom_sqft} sqft`,
            )
          })
          .catch((e) => console.error('[Attom chain error]', e))
      }
    })
    .catch((e) => console.error('[Trestle chain error]', e))
}
