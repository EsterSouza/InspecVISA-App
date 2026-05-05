-- Migration 008 - Keep sync batch logs lightweight
-- The transactional RPC receives the full bundle, but sync_batches should not
-- duplicate the whole JSON payload on every retry. This keeps the audit log
-- useful without making each request pay the cost of storing all responses.

CREATE OR REPLACE FUNCTION public.trim_sync_batch_payload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.payload IS NOT NULL THEN
    NEW.payload := jsonb_build_object(
      'clientSyncId', NEW.payload->>'clientSyncId',
      'finalizeReport', COALESCE((NEW.payload->>'finalizeReport')::boolean, false),
      'inspectionId', NEW.inspection_id,
      'responsesCount', jsonb_array_length(COALESCE(NEW.payload->'responses', '[]'::jsonb)),
      'photosCount', jsonb_array_length(COALESCE(NEW.payload->'photos', '[]'::jsonb))
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trim_sync_batch_payload ON public.sync_batches;

CREATE TRIGGER trg_trim_sync_batch_payload
BEFORE INSERT OR UPDATE OF payload ON public.sync_batches
FOR EACH ROW
EXECUTE FUNCTION public.trim_sync_batch_payload();
