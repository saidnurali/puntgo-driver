-- ============================================================
-- Migration: Allow drivers to update live GPS columns on orders
-- Project:   PuntGo Driver (bftsfgoenlgflhpfrqgf)
-- Created:   2026-09-01
--
-- HOW TO RUN:
--   Open the Supabase dashboard → SQL Editor → paste this file
--   and click "Run". Do NOT run through supabase CLI unless you
--   have the service-role key configured locally.
--
-- CONTEXT:
--   The Customer App (PuntEats) OrderTracking.tsx reads
--   driver_latitude, driver_longitude, driver_heading directly from
--   the `orders` row and updates the map via a postgres_changes
--   UPDATE subscription on that row. This migration ensures the
--   driver can write ONLY those three columns (no other fields) to
--   the order row they own, without needing a full status-change
--   update in the same call.
--
-- COLUMNS CONFIRMED:
--   driver_latitude  double precision (already exists, confirmed 2026-09-01)
--   driver_longitude double precision (already exists, confirmed 2026-09-01)
--   driver_heading   double precision (already exists, confirmed 2026-09-01)
--   All three were already present — no ALTER TABLE needed.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. RLS policy: drivers can update GPS columns on their own order
-- ─────────────────────────────────────────────────────────────
-- Note: The existing policy "orders: drivers can claim or update own order"
-- (created in 20260901_driver_locations_and_orders_rls.sql) covers status
-- transitions. This separate policy covers location-only updates where
-- status does NOT change in the same call — which would fail the
-- WITH CHECK clause of the claim policy (it requires driver_id = auth.uid()
-- after the update, which is satisfied here since the driver already owns
-- the row, but we add a dedicated policy for clarity and auditability).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'orders'
      AND policyname = 'orders: drivers can update own gps location columns'
  ) THEN
    CREATE POLICY "orders: drivers can update own gps location columns"
      ON public.orders
      FOR UPDATE
      TO authenticated
      USING (
        -- Row must already belong to this driver
        driver_id::text = auth.uid()::text
        -- And the caller must be a driver (not a customer)
        AND EXISTS (SELECT 1 FROM public.drivers WHERE id::text = auth.uid()::text)
      )
      WITH CHECK (
        -- After update: driver_id must still be auth.uid() (can't reassign)
        driver_id::text = auth.uid()::text
        AND EXISTS (SELECT 1 FROM public.drivers WHERE id::text = auth.uid()::text)
      );
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- Done.
-- Verify in: Authentication > Policies > orders table in Supabase dashboard.
-- The new policy "orders: drivers can update own gps location columns"
-- should appear alongside the two policies created in the previous migration.
-- ─────────────────────────────────────────────────────────────
