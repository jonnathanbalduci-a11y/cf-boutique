DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'OrderDeliveryStatus'
      AND e.enumlabel = 'cancelled'
  ) THEN
    ALTER TYPE "OrderDeliveryStatus" ADD VALUE 'cancelled';
  END IF;
END $$;
