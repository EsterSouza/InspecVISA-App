-- ============================================================
-- Migration 005 - Store inspection photos in Supabase Storage
-- ============================================================
-- Photos used to be synchronized as base64 text through public.photos.data_url.
-- That makes PostgREST upserts slow and fragile. This bucket stores the binary
-- file while public.photos.data_url keeps only "storage://<path>".
-- Limit is 15 MB to leave room for field photos that average around 2.5 MB.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inspection-photos',
  'inspection-photos',
  false,
  15728640,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS "inspection_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "inspection_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "inspection_photos_update" ON storage.objects;
DROP POLICY IF EXISTS "inspection_photos_delete" ON storage.objects;

CREATE POLICY "inspection_photos_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'inspection-photos'
  AND ((storage.foldername(name))[1])::uuid IN (SELECT private.my_tenant_ids())
);

CREATE POLICY "inspection_photos_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'inspection-photos'
  AND ((storage.foldername(name))[1])::uuid IN (SELECT private.my_tenant_ids())
  AND private.is_tenant_staff(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "inspection_photos_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'inspection-photos'
  AND ((storage.foldername(name))[1])::uuid IN (SELECT private.my_tenant_ids())
  AND private.is_tenant_staff(((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'inspection-photos'
  AND ((storage.foldername(name))[1])::uuid IN (SELECT private.my_tenant_ids())
  AND private.is_tenant_staff(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "inspection_photos_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'inspection-photos'
  AND ((storage.foldername(name))[1])::uuid IN (SELECT private.my_tenant_ids())
  AND private.is_tenant_staff(((storage.foldername(name))[1])::uuid)
);
