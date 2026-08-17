/**
 * Mensagem legível de um erro de origem desconhecida.
 *
 * Os erros do PostgREST e das funções RPC **não** são instâncias de `Error` — são objetos
 * simples — mas trazem `.message`. Sem o segundo ramo, a tela mostrava "operação falhou."
 * no lugar do motivo real (ex.: "horario indisponivel", do gatilho de conflito da agenda).
 *
 * DEBT-02: existia uma cópia disto em `components/schedules/appointmentRequestsShared.ts` e
 * outra, mais fraca (só o primeiro ramo), em `components/clients/portal/shared.ts`. As duas
 * passaram a reexportar daqui — é também o lugar de onde os serviços importam, em vez de
 * escreverem `catch (err: any)` para poder ler `.message`.
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return 'operação falhou.';
}
