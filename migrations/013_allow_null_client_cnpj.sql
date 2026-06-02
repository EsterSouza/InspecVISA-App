-- Keep client CNPJ optional, matching the app forms and TypeScript model.
ALTER TABLE public.clients
  ALTER COLUMN cnpj DROP NOT NULL;
