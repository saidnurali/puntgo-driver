-- ============================================================
-- Migration: driver_locations table + orders/driver RLS policies
-- Project:   PuntGo Driver (bftsfgoenlgflhpfrqgf)
-- Created:   2026-09-01
--
-- HOW TO RUN:
--   Open the Supabase dashboard → SQL Editor → paste this file
--   and click "Run". Do NOT run through supabase CLI unless you
--   have the service-role key configured locally.
--
-- NOTES:
--   • orders.driver_id uuid column ALREADY EXISTS — no ALTER needed.
--   • Existing rides table is left untouched (may be revisited for
--     taxi features later).
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Create driver_locations table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.driver_locations (
  driver_id   uuid        NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id    uuid        REFERENCES public.orders(id) ON DELETE SET NULL,
  latitude    double precision NOT NULL,
  longitude   double precision NOT NULL,
  heading     double precision,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by order (customer app reads by order_id)
CREATE INDEX IF NOT EXISTS idx_driver_locations_order_id
  ON public.driver_locations (order_id);

COMMENT ON TABLE public.driver_locations IS
  'Live GPS position of a driver, scoped to their active order. '
  'Upserted every ~10 s while driver is online with a current order. '
  'Row is keyed by driver_id (one row per driver).';

-- ─────────────────────────────────────────────────────────────
-- 2. Enable Row Level Security on driver_locations
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- Drivers can insert their own location row
CREATE POLICY "driver_locations: driver can insert own row"
  ON public.driver_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = driver_id);

-- Drivers can update their own location row
CREATE POLICY "driver_locations: driver can update own row"
  ON public.driver_locations
  FOR UPDATE
  TO authenticated
      USING (auth.uid()::text = driver_id::text)
  WITH CHECK (auth.uid()::text = driver_id::text);

-- Drivers can select their own row
CREATE POLICY "driver_locations: driver can select own row"
  ON public.driver_locations
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = driver_id::text);

-- A driver can also read location rows linked to their own orders
-- (redundant safety — the customer-facing read policy lives in the customer app migrations)
CREATE POLICY "driver_locations: readable for order driver"
  ON public.driver_locations
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM public.orders WHERE driver_id::text = auth.uid()::text
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 3. RLS policies on orders table for drivers
-- ─────────────────────────────────────────────────────────────

-- Enable RLS on orders (idempotent)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Policy: drivers can see unclaimed Pending orders
-- "Pending" is the exact status string used by the Customer app.
-- TODO (future task): add PostGIS distance-based filtering to only show nearby orders.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'orders'
      AND policyname = 'orders: drivers can see unclaimed pending orders'
  ) THEN
    CREATE POLICY "orders: drivers can see unclaimed pending orders"
      ON public.orders
      FOR SELECT
      TO authenticated
      USING (
        status = 'Pending'
        AND driver_id IS NULL
        AND EXISTS (SELECT 1 FROM public.drivers WHERE id::text = auth.uid()::text)
      );
  END IF;
END $$;

-- Policy: drivers can see their own active orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'orders'
      AND policyname = 'orders: drivers can see own active orders'
  ) THEN
    CREATE POLICY "orders: drivers can see own active orders"
      ON public.orders
      FOR SELECT
      TO authenticated
      USING (
        driver_id::text = auth.uid()::text
        AND EXISTS (SELECT 1 FROM public.drivers WHERE id::text = auth.uid()::text)
      );
  END IF;
END $$;

-- Policy: drivers can claim (driver_id IS NULL) or update their own order
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'orders'
      AND policyname = 'orders: drivers can claim or update own order'
  ) THEN
    CREATE POLICY "orders: drivers can claim or update own order"
      ON public.orders
      FOR UPDATE
      TO authenticated
      USING (
        (driver_id IS NULL OR driver_id::text = auth.uid()::text)
        AND EXISTS (SELECT 1 FROM public.drivers WHERE id::text = auth.uid()::text)
      )
      WITH CHECK (
        driver_id::text = auth.uid()::text
        AND EXISTS (SELECT 1 FROM public.drivers WHERE id::text = auth.uid()::text)
      );
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 4. Grant table permissions to authenticated role
-- ─────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON public.driver_locations TO authenticated;
GRANT SELECT, UPDATE ON public.orders TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- Done. Verify in: Authentication > Policies in Supabase dashboard.
-- ─────────────────────────────────────────────────────────────
