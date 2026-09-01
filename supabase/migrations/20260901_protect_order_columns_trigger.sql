-- ============================================================
-- Migration: Prevent drivers from modifying protected order details
-- Project:   PuntGo Driver (bftsfgoenlgflhpfrqgf)
-- Created:   2026-09-01
--
-- HOW TO RUN:
--   Open the Supabase dashboard → SQL Editor → paste this file
--   and click "Run".
--
-- CONTEXT:
--   Postgres RLS (Row-Level Security) restricts WHICH rows a user
--   can update, but cannot restrict WHICH columns within that row.
--   Our two RLS update policies for drivers ("claim or update own order"
--   and "update own gps location columns") allow a driver to update
--   an order row, meaning a malicious client could theoretically change
--   the total_price or customer_phone along with the GPS coords.
--
--   This BEFORE UPDATE trigger blocks any changes to critical
--   order details if the caller is an authenticated driver.
-- ============================================================

-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION public.check_driver_order_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER -- Ensures it can reliably check public.drivers
AS $$
BEGIN
  -- Only apply this restriction to users who are drivers.
  -- Backend services (service_role) or customers bypass this.
  -- auth.uid() matches a row in public.drivers for driver users.
  IF auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM public.drivers WHERE id::text = auth.uid()::text) THEN
    
    -- Check protected columns for changes using IS DISTINCT FROM
    -- This ensures NULL to NULL is not treated as a change, etc.
    IF NEW.total_price IS DISTINCT FROM OLD.total_price OR
       NEW.delivery_address IS DISTINCT FROM OLD.delivery_address OR
       NEW.customer_phone IS DISTINCT FROM OLD.customer_phone OR
       NEW.customer_name IS DISTINCT FROM OLD.customer_name OR
       NEW.restaurant_name IS DISTINCT FROM OLD.restaurant_name OR
       NEW.restaurant_id IS DISTINCT FROM OLD.restaurant_id OR
       NEW.payment_method IS DISTINCT FROM OLD.payment_method OR
       NEW.items IS DISTINCT FROM OLD.items THEN
       
       RAISE EXCEPTION 'Drivers are not allowed to modify protected order details (price, address, customer info, items, etc.)';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Attach the trigger to the orders table
DROP TRIGGER IF EXISTS trg_check_driver_order_update ON public.orders;
CREATE TRIGGER trg_check_driver_order_update
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.check_driver_order_update();

-- ============================================================
-- Done.
-- Verify in Supabase Dashboard → Database → Triggers
-- ============================================================
