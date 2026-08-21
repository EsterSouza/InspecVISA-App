import { normalizeRequirementText } from './itemIdentity';

/**
 * O texto da consultora vira tarefas separadas — quando ela marcou que são tarefas.
 *
 * Ela escreve o plano de ação em tópicos: um traço por coisa a fazer, às vezes
 * numerando com `1)`. Cada um desses tópicos é uma tarefa independente, que o
 * cliente cumpre (ou não) separadamente das outras. Até aqui os três viravam um
 * parágrafo só, e o cliente só podia responder "fiz" ou "não fiz" pelo conjunto.
 *
 * A regra é conservadora de propósito: **sem marcador, sem tarefa**. Parágrafo
 * corrido continua parágrafo corrido — é o caso mais comum e o mais fácil de
 * estragar adivinhando. Só vira lista o que ela mesma marcou como lista.
 *
 * Os botões `Providenciar` / `Substituir` / `Implementar` da tela de inspeção já
 * escrevem `- ` na frente, então boa parte do texto já nasce marcado.
 */
export interface ParsedCheckpoints {
  /**
   * O que vem antes do primeiro marcador — o "Foi observado o seguinte:" que
   * apresenta a lista. Sem marcador nenhum, é o texto inteiro.
   */
  context: string;
  /** Um por tópico marcado, já sem o marcador. Vazio = texto corrido. */
  points: string[];
}

/**
 * Traço, travessão, bolinha, asterisco, ou número seguido de `)` ou `.` — sempre
 * com espaço depois, ou sozinho na linha. O espaço é o que separa `- Providenciar`
 * de um hífen no meio de uma palavra, e `1) ` de `1.5 m`; o "sozinho na linha"
 * cobre o marcador que ela abriu e ainda não preencheu, que senão seria lido como
 * continuação da frase anterior e entraria no meio dela.
 */
const MARKER = /^[ \t]*(?:[-–—•*]|\(?\d{1,2}[).])(?:[ \t]+|[ \t]*$)/;

/**
 * Os verbos dos botões de atalho da tela de inspeção (`Providenciar`, `Substituir`…).
 *
 * Cada clique escreve `- Verbo ` e espera o complemento. Clicando em dois seguidos, o
 * primeiro fica pendurado sozinho na linha — e viraria uma tarefa chamada só "Abolir",
 * que não diz ao cliente o que fazer. É clique abandonado, não coisa que ela escreveu.
 */
const ATALHOS = new Set(['providenciar', 'substituir', 'implementar', 'abolir', 'adequar']);

function ehAtalhoAbandonado(point: string): boolean {
  return ATALHOS.has(point.trim().toLowerCase().replace(/[.:;,]+$/, ''));
}

export function parseCheckpoints(text: string | null | undefined): ParsedCheckpoints {
  const raw = (text || '').trim();
  if (!raw) return { context: '', points: [] };

  const contextLines: string[] = [];
  const points: string[] = [];

  for (const line of raw.split(/\r?\n/)) {
    if (MARKER.test(line)) {
      points.push(line.replace(MARKER, '').trim());
    } else if (points.length > 0) {
      // Continuação do tópico anterior: ela quebrou a linha no meio da frase.
      const tail = line.trim();
      if (tail) points[points.length - 1] = `${points[points.length - 1]} ${tail}`.trim();
    } else {
      contextLines.push(line.trim());
    }
  }

  const clean = points.filter(Boolean);
  // Verbo de atalho pendurado sai da lista — mas nunca ao ponto de esvaziar o texto dela.
  const uteis = clean.filter((point) => !ehAtalhoAbandonado(point));
  const finais = uteis.length > 0 ? uteis : clean;
  if (finais.length === 0) return { context: raw, points: [] };

  return { context: contextLines.join('\n').trim(), points: finais };
}

/**
 * Chave estável de um ponto, derivada do próprio texto.
 *
 * É o mesmo princípio que já sustenta a reincidência quando a unidade troca de
 * roteiro (ver `itemIdentity.ts`): o texto sobrevive, o id não. Aqui serve para
 * que o "já fiz" que o cliente marcou continue valendo quando o mesmo apontamento
 * é republicado — e para que uma frase reescrita nasça como tarefa nova, que é o
 * certo: texto diferente é outra coisa a fazer.
 */
export function checkpointKey(text: string): string {
  return normalizeRequirementText(text);
}

/** Um tópico do jeito que o banco o guarda: a chave estável e o texto que o cliente lê. */
export interface CheckpointPayload {
  key: string;
  text: string;
}

/**
 * Os tópicos de um texto, prontos para publicar.
 *
 * Deduplica por chave: a identidade do tópico no banco é `(item, chave)`, e mandar a mesma
 * chave duas vezes faz o `on conflict` do upsert falhar com *"cannot affect row a second
 * time"* — a publicação inteira do relatório iria junto. Repetir um tópico é erro de digitação,
 * não duas tarefas; fica a primeira ocorrência, que é a que ela escreveu primeiro.
 */
export function buildCheckpoints(text: string | null | undefined): CheckpointPayload[] {
  const seen = new Set<string>();
  const checkpoints: CheckpointPayload[] = [];

  for (const point of parseCheckpoints(text).points) {
    const key = checkpointKey(point);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    checkpoints.push({ key, text: point });
  }

  return checkpoints;
}
