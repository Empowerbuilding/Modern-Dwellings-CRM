-- Add ATTOM property enrichment columns
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS attom_avm_value integer,
  ADD COLUMN IF NOT EXISTS attom_avm_high integer,
  ADD COLUMN IF NOT EXISTS attom_avm_low integer,
  ADD COLUMN IF NOT EXISTS attom_avm_score integer,
  ADD COLUMN IF NOT EXISTS attom_lot_acres numeric,
  ADD COLUMN IF NOT EXISTS attom_sqft integer,
  ADD COLUMN IF NOT EXISTS attom_beds integer,
  ADD COLUMN IF NOT EXISTS attom_baths numeric,
  ADD COLUMN IF NOT EXISTS attom_year_built integer,
  ADD COLUMN IF NOT EXISTS attom_owner_occupied boolean,
  ADD COLUMN IF NOT EXISTS attom_prop_type text,
  ADD COLUMN IF NOT EXISTS attom_last_sale_price integer,
  ADD COLUMN IF NOT EXISTS attom_last_sale_date text,
  ADD COLUMN IF NOT EXISTS attom_enriched_at timestamptz;
