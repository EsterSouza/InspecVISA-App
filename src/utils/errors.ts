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
  return rawErrorMessage(err) ?? 'operação falhou.';
}

/**
 * A mensagem que o erro carrega, se carregar — para quem tem um texto de reserva próprio.
 * É o equivalente exato de `err?.message` do tempo em que a captura era `catch (err: any)`,
 * e existe para que `rawErrorMessage(err) || 'Erro ao salvar cliente.'` continue dizendo
 * "Erro ao salvar cliente." e não o genérico desta casa.
 */
export function rawErrorMessage(err: unknown): string | undefined {
  if (err instanceof Error) return err.message || undefined;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message || undefined;
  }
  return undefined;
}
