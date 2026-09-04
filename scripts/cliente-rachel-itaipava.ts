// Cadastra a cliente Rachel Garcia Guimarães Ferreira (consultório em Itaipava,
// Petrópolis/RJ) para a vistoria presencial pré-operacional de 04/09/2026.
//
//   npx tsx scripts/cliente-rachel-itaipava.ts            # simulação (padrão)
//   npx tsx scripts/cliente-rachel-itaipava.ts --apply    # grava em produção
//
// TODO campo abaixo veio de um dos dois documentos assinados, e a procedência
// está anotada linha a linha. Nada foi inferido:
//
//   · CONTRATO_VISTORIA_PRESENCIAL_RACHEL_GARCIA_1.pdf (qualificação das Partes,
//     cláusulas 1.4, 1.6, 7.x e 10.1);
//   · "forms rachel petropolis rj.pdf" — formulário de triagem, 26/08/2026.
//
// AS QUATRO MARCAÇÕES DE CONTRATO (PORT-07) NASCEM FALSAS, E ISSO É DELIBERADO.
// A cláusula 7 do contrato exclui expressamente do objeto a Pasta Sanitária, a
// auditoria/revistoria, o acompanhamento continuado e "o acesso da CONTRATANTE à
// plataforma InspecVISA ou a portal do cliente". No formulário ela marcou
// interesse na Pasta Sanitária, mas interesse em formulário não é contrato — se
// ela contratar depois, a marcação se liga na tela do cliente.
//
// `category: 'estetica'` não é engano: `ClientCategory` só admite
// 'estetica' | 'ilpi' | 'alimentos', e é essa categoria que faz aparecerem no
// seletor tanto o Roteiro de Serviços de Saúde quanto o suplemento de
// Petrópolis. Ver o cabeçalho de src/data/saude/roteiro-servicos-saude.ts.
//
// `city`/`state` precisam ser exatamente "Petrópolis" e "RJ": é o que
// `isPetropolisClient` (src/data/supplementRegistry.ts) casa para acoplar o
// suplemento municipal ao roteiro.
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { requireSupabaseEnv } from './env';

const APPLY = process.argv.includes('--apply');
const tenantArg = process.argv.indexOf('--tenant');
const TENANT = tenantArg >= 0 ? process.argv[tenantArg + 1] : undefined;

const { url, key } = requireSupabaseEnv();
const sb = createClient(url, key, { auth: { persistSession: false } });

const AGORA = new Date().toISOString();

const CLIENTE = {
  // Pessoa física: o nome do estabelecimento é o dela. Cláusula 1.6 — "O
  // relatório será emitido em nome da CONTRATANTE, pessoa física".
  name: 'Rachel Garcia Guimarães Ferreira',
  responsible_name: 'Rachel Garcia Guimarães Ferreira',
  // Cláusula 1.6: contrata como pessoa física, sem inscrição no CNPJ, e pretende
  // constituir pessoa jurídica. No formulário: "Abrirei uma empresa/CNPJ".
  cnpj: null,
  address: 'Estrada União e Indústria, nº 10.126, Loja 11, Itaipava — CEP 25.730-745',
  city: 'Petrópolis',
  state: 'RJ',
  category: 'estetica' as const,
  food_types: null,
  // Cláusula 10.1 — canais oficiais de comunicação da CONTRATANTE.
  phone: '(24) 98178-1110',
  email: 'rachelggf@gmail.com',
  contacts: [],
  has_personalized_sanitary_folder: false,
  personalized_sanitary_folder_url: null,
  personalized_sanitary_folder_expected_delivery_date: null,
  has_audit_service: false,
  has_online_followup: false,
  has_evidence_support: false,
  deleted_at: null,
};

async function main() {
  console.log(`Cliente Rachel Garcia — ${APPLY ? 'APLICANDO' : 'simulação'}\n`);

  // Homônimo ou execução repetida: parar é melhor do que criar a segunda linha.
  // Contas separadas já produziram cliente duplicado neste banco antes.
  const { data: existentes, error: erroBusca } = await sb
    .from('clients')
    .select('id, name, city, tenant_id, created_at, deleted_at')
    .ilike('name', '%Rachel%');
  if (erroBusca) throw erroBusca;

  if ((existentes || []).length > 0) {
    console.log('Já existe cliente com "Rachel" no nome:');
    for (const linha of existentes!) {
      console.log(`  · ${linha.id} — ${linha.name} (${linha.city}) tenant ${linha.tenant_id}${linha.deleted_at ? ' [excluído]' : ''}`);
    }
    if ((existentes || []).some((l) => !l.deleted_at)) {
      console.error('\nNada foi gravado. Confira na tela antes de criar outra linha.');
      process.exit(1);
    }
  }

  if (!TENANT) {
    console.error('\nSem tenant: passe --tenant <uuid>.');
    process.exit(1);
  }

  const linha = { id: randomUUID(), ...CLIENTE, tenant_id: TENANT, created_at: AGORA, updated_at: AGORA };

  if (!APPLY) {
    console.log('Simulação — nada gravado. Com --apply, insere:\n');
    console.log(JSON.stringify(linha, null, 2));
    return;
  }

  const { data, error } = await sb.from('clients').insert(linha).select('id, name, city, state, category').single();
  if (error) throw error;
  console.log(`\nCliente criada: ${data.id}`);
  console.log(`  ${data.name} — ${data.city}/${data.state} · categoria ${data.category}`);
  console.log('\nO suplemento de Petrópolis acopla sozinho aos dois roteiros pela cidade e UF.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
