/**
 * Agenda multiuso e reserva concorrente (P360-015).
 *
 * A reserva concorrente é testada pela RPC, não pela tela, por um motivo de
 * segurança: a página pública `/agendar` usa o `VITE_DEFAULT_TENANT_ID` do
 * bundle, que em produção é o tenant real da consultoria. Um teste de corrida
 * pela interface criaria solicitações de verdade na agenda da Ester. A RPC
 * recebe o tenant no payload, então dá para exercitar a mesma regra dentro do
 * tenant de homologação.
 */
import { expect, test, type APIRequestContext } from '@playwright/test';
import { exige } from './apoio/ambiente';

type RespostaRpc = { ok: boolean; status: number; corpo: unknown };

async function chamaRpc(
  request: APIRequestContext,
  funcao: string,
  corpo: Record<string, unknown>
): Promise<RespostaRpc> {
  const url = exige('E2E_SUPABASE_URL').replace(/\/$/, '');
  const chave = exige('E2E_SUPABASE_ANON_KEY');
  const resposta = await request.post(`${url}/rest/v1/rpc/${funcao}`, {
    headers: { apikey: chave, Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    data: corpo,
    failOnStatusCode: false,
  });
  return { ok: resposta.ok(), status: resposta.status(), corpo: await resposta.json().catch(() => null) };
}

/**
 * Pergunta ao próprio banco um horário livre, em vez de calcular uma data.
 * Somar dias no relógio cai em fim de semana, feriado ou fora do expediente — e
 * aí o teste falha por indisponibilidade, não pelo que ele quer provar.
 */
async function horarioLivre(
  request: APIRequestContext,
  pularPrimeiros = 0
): Promise<{ inicio: string; fim: string }> {
  const tenant = exige('E2E_TENANT_HOMOLOG');
  const hoje = new Date().toISOString().slice(0, 10);

  const dias = await chamaRpc(request, 'public_list_calendar_days', {
    p_tenant_id: tenant,
    p_start_date: hoje,
    p_days: 45,
    p_appointment_type: 'briefing',
    p_duration_minutes: 45,
  });
  const listaDias = (dias.corpo as Array<{ day: string }>) ?? [];
  expect(listaDias.length, 'a agenda de homologação não ofereceu nenhum dia').toBeGreaterThan(0);

  // Um dia bem à frente: os próximos tendem a ter menos horário sobrando, e a
  // antecedência mínima é de 24 h.
  for (const dia of listaDias.slice(-10)) {
    const horarios = await chamaRpc(request, 'public_list_available_times', {
      p_tenant_id: tenant,
      p_day: dia.day,
      p_appointment_type: 'briefing',
      p_duration_minutes: 45,
    });
    const lista = (horarios.corpo as Array<{ starts_at: string; ends_at: string }>) ?? [];
    if (lista.length > pularPrimeiros) {
      const escolhido = lista[pularPrimeiros];
      return { inicio: escolhido.starts_at, fim: escolhido.ends_at };
    }
  }
  throw new Error('nenhum horário livre na agenda de homologação');
}

test.describe('canal público de agendamento', () => {
  test('só aceita briefing — inspeção e reunião exigem o portal', async ({ request }) => {
    // "Inspeção e reunião sem contaminação de fluxo": o canal aberto não pode
    // criar compromisso que dependa de vínculo de cliente.
    const { inicio, fim } = await horarioLivre(request);
    const base = {
      tenant_id: exige('E2E_TENANT_HOMOLOG'),
      unit_name: '[HOMOLOG] E2E tipo indevido',
      responsible_name: '[HOMOLOG] Teste',
      phone: '21999999999',
      requested_starts_at: inicio,
      requested_ends_at: fim,
      duration_minutes: 30,
    };

    for (const tipo of ['inspection', 'follow_up_meeting', 'training']) {
      const r = await chamaRpc(request, 'public_create_calendar_appointment_request', {
        p_payload: { ...base, appointment_type: tipo },
      });
      expect(r.ok, `tipo ${tipo} não podia ser aceito neste canal`).toBe(false);
      expect(JSON.stringify(r.corpo)).toMatch(/apenas briefing/i);
    }
  });

  test('exige antecedência mínima de 24 horas', async ({ request }) => {
    const agora = new Date();
    const inicio = new Date(agora.getTime() + 2 * 60 * 60 * 1000);
    // A duração TEM que bater com o intervalo. Enquanto foram 30 minutos contra
    // `duration_minutes: 45`, quem recusava o pedido era a checagem de coerência
    // (`duracao nao corresponde ao intervalo informado`) — a regra de 24 horas,
    // que é o assunto do teste, nunca chegava a ser exercida. Achado no FE-27.
    const fim = new Date(inicio.getTime() + 45 * 60 * 1000);

    const r = await chamaRpc(request, 'public_create_calendar_appointment_request', {
      p_payload: {
        tenant_id: exige('E2E_TENANT_HOMOLOG'),
        unit_name: '[HOMOLOG] E2E cedo demais',
        responsible_name: '[HOMOLOG] Teste',
        phone: '21999999999',
        appointment_type: 'briefing',
        duration_minutes: 45,
        requested_starts_at: inicio.toISOString(),
        requested_ends_at: fim.toISOString(),
      },
    });

    expect(r.ok).toBe(false);
    expect(JSON.stringify(r.corpo)).toMatch(/antecedencia|antecedência/i);
  });

  test('duas reservas simultâneas no mesmo horário: só uma entra', async ({ request }) => {
    const { inicio, fim } = await horarioLivre(request, 1);
    const payload = (sufixo: string) => ({
      p_payload: {
        tenant_id: exige('E2E_TENANT_HOMOLOG'),
        unit_name: `[HOMOLOG] E2E corrida ${sufixo}`,
        responsible_name: '[HOMOLOG] Teste',
        phone: '21999999999',
        appointment_type: 'briefing',
        duration_minutes: 45,
        requested_starts_at: inicio,
        requested_ends_at: fim,
      },
    });

    // Disparadas juntas de propósito: o que se quer provar é que a decisão é do
    // banco, não da ordem em que a interface chamou.
    const [a, b] = await Promise.all([
      chamaRpc(request, 'public_create_calendar_appointment_request', payload('A')),
      chamaRpc(request, 'public_create_calendar_appointment_request', payload('B')),
    ]);

    const aceitas = [a, b].filter((r) => r.ok);
    const recusadas = [a, b].filter((r) => !r.ok);

    expect(aceitas.length, 'o mesmo horário não pode ser reservado duas vezes').toBe(1);
    expect(recusadas.length).toBe(1);
    expect(JSON.stringify(recusadas[0].corpo)).toMatch(/indispon|conflit|ocupad/i);
  });
});
