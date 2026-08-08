-- SEC-01 (1 de 2) — fechar o bucket `photos`.
--
-- Criado em 19/03/2026 com `public = true`, sem `file_size_limit` e sem `allowed_mime_types`.
-- Conferido em 08/08/2026: está VAZIO e nenhum código o referencia — as fotos de inspeção vivem
-- em `inspection-photos` (privado, 5 MB, jpeg/png/webp) e as do portal em `client-portal-files`.
--
-- Não há o que quebrar hoje; o risco é o nome. `photos` é o bucket mais óbvio para alguém
-- escrever `.from('photos')` um dia, e aí foto de cliente iria parar em URL pública permanente.
-- Fechado em vez de apagado: se algum dia for usado, nasce privado e com limite, em vez de
-- precisar ser criado de novo (e voltar aberto pelo padrão do Supabase).
--
-- Autorizado pela Ester em 08/08/2026.

update storage.buckets
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'photos';
