# language: pt
Funcionalidade: Isolamento multi-tenant e acesso
  Como plataforma
  Quero que cada consultoria só enxergue o próprio dado
  Para nunca vazar dado sanitário entre tenants

  # O escopo vem sempre de private.my_tenant_ids() + is_tenant_staff, nunca de p_tenant_id do front.
  Cenário: Leitura de staff só enxerga o próprio tenant
    Dado dados de duas consultorias (tenant A e tenant B)
    Quando a staff do tenant A consulta qualquer agregado
    Então nenhum registro do tenant B aparece
    E o escopo não depende de o front passar o tenant certo

  # O cliente Supabase é único: staff logada chama RPC pública como `authenticated`, não `anon`.
  Cenário: RPC pública precisa de grant para os dois papéis
    Dado uma RPC pública do portal
    Então ela concede execução a "anon" e a "authenticated"
    E se faltar um dos papéis a página pública quebra só para quem está logado

  Cenário: anon não executa RPC de staff
    Dado as RPCs do Painel operacional
    Então "anon" não tem execução
    E "authenticated" (staff) tem

  Cenário: Anexos e evidências ficam em bucket privado
    Dado fotos de inspeção e evidências do cliente
    Então os buckets são privados
    E o acesso é sempre por URL assinada de curta duração

  Cenário: Link público por token não expõe login nem outra unidade
    Dado o link público de uma visita
    Quando abro o link sem senha
    Então vejo apenas o plano de ação daquele cliente
    E não acesso o dashboard por conta nem outra unidade

  # Garantido por: padrão security definer + search_path='' + revoke/grant nas migrations,
  # SEC-01, e suítes SQL de permissão (has_function_privilege).
