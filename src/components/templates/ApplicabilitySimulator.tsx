// ============================================================
// src/components/templates/ApplicabilitySimulator.tsx
// COND-07 — "e se fosse assim?": o roteiro inteiro testado sem criar cliente
// nem inspeção real.
//
// O aceite do card é este componente: a consultora inventa um cenário — o
// contexto que viria do cadastro, as respostas que viriam do agendamento ou do
// campo — e vê seção a seção o que apareceria, o que sumiria e o que ficaria
// pendente, **com a justificativa de cada decisão**.
//
// A tela não decide nada. Quem responde é `simulateTemplate`, que por sua vez
// chama o mesmo `evaluateApplicability` da execução — é isso que impede o
// simulador de mentir. Se um dia ele divergir da inspeção real, o erro está no
// motor, nunca aqui.
//
// **Nada disto escreve no banco.** O cenário vive no estado da tela e morre com
// ela: simular não cria inspeção, não toca no rascunho e não publica.
// ============================================================

import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, FlaskConical, HelpCircle, MinusCircle, RotateCcw } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Checkbox } from '../ui/Checkbox';
import { Field } from '../ui/Field';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { STATE_LABELS, parseRoutingAnswer, simulateTemplate, simulationInputs } from '../../domain/applicability';
import type {
  ApplicabilityRule,
  ApplicabilityState,
  ContextField,
  InspectionContext,
  LabeledSection,
  RoutingAnswer,
  RoutingAnswers,
  RoutingQuestion,
  SimulationCounts,
} from '../../domain/applicability';

export interface ApplicabilitySimulatorProps {
  /** A árvore como está na tela — o simulador testa o que se vê, não o publicado. */
  sections: LabeledSection[];
  rules: ApplicabilityRule[];
  questions: RoutingQuestion[];
}

const TOM: Record<ApplicabilityState, 'success' | 'neutral' | 'warning'> = {
  aplicavel: 'success',
  nao_aplicavel_por_regra: 'neutral',
  pendente_de_condicao: 'warning',
};

const ICONE: Record<ApplicabilityState, typeof CheckCircle2> = {
  aplicavel: CheckCircle2,
  nao_aplicavel_por_regra: MinusCircle,
  pendente_de_condicao: HelpCircle,
};

/** Marca de "não foi possível determinar" — resposta legítima, não ausência. */
const INDETERMINADA: RoutingAnswer = { undetermined: true };

function ehIndeterminada(answer: RoutingAnswer | null | undefined): boolean {
  return typeof answer === 'object' && answer !== null && !Array.isArray(answer) && 'undetermined' in answer;
}

/**
 * O que foi digitado vira contexto congelado. Campo em branco **não entra no
 * objeto**: em branco é indeterminado, nunca "assume não" (contrato § 4.1) — a
 * mesma regra de `buildInspectionContext`.
 */
function montarContexto(fields: ContextField[], bruto: Record<string, string>): InspectionContext {
  const contexto: InspectionContext = {};
  for (const field of fields) {
    const texto = (bruto[field.key] ?? '').trim();
    if (texto === '') continue;

    if (field.type === 'number') {
      const numero = Number(texto.replace(',', '.'));
      if (Number.isFinite(numero)) contexto[field.key] = numero;
      continue;
    }
    if (field.type === 'text_list') {
      const lista = texto.split(',').map((entrada) => entrada.trim()).filter(Boolean);
      if (lista.length > 0) contexto[field.key] = lista;
      continue;
    }
    if (field.type === 'boolean') {
      contexto[field.key] = texto === 'true';
      continue;
    }
    contexto[field.key] = texto;
  }
  return contexto;
}

export function ApplicabilitySimulator({ sections, rules, questions }: ApplicabilitySimulatorProps) {
  const [aberto, setAberto] = useState(false);
  const [contextoBruto, setContextoBruto] = useState<Record<string, string>>({});
  const [respostas, setRespostas] = useState<RoutingAnswers>({});
  const [numerosBrutos, setNumerosBrutos] = useState<Record<string, string>>({});
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());

  const entradas = useMemo(
    () => simulationInputs({ rules, routingQuestions: questions }),
    [rules, questions]
  );

  const contexto = useMemo(
    () => montarContexto(entradas.contextFields, contextoBruto),
    [entradas.contextFields, contextoBruto]
  );

  const resultado = useMemo(
    () =>
      simulateTemplate({
        template: { sections, rules, routingQuestions: questions },
        scenario: { context: contexto, answers: respostas },
      }),
    [sections, rules, questions, contexto, respostas]
  );

  const responder = (question: RoutingQuestion, cru: unknown) => {
    const { answer } = parseRoutingAnswer(question, cru);
    setRespostas((prev) => ({ ...prev, [question.id]: answer }));
  };

  const alternarIndeterminada = (question: RoutingQuestion, marcar: boolean) => {
    setRespostas((prev) => ({ ...prev, [question.id]: marcar ? INDETERMINADA : null }));
    if (marcar) setNumerosBrutos((prev) => ({ ...prev, [question.id]: '' }));
  };

  const limpar = () => {
    setContextoBruto({});
    setRespostas({});
    setNumerosBrutos({});
  };

  const alternarSecao = (sectionId: string) => {
    setExpandidas((prev) => {
      const proxima = new Set(prev);
      if (proxima.has(sectionId)) proxima.delete(sectionId);
      else proxima.add(sectionId);
      return proxima;
    });
  };

  const semCondicao = rules.length === 0;

  return (
    <Card className="p-6 space-y-4 overflow-visible">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-bold text-navy">
            <FlaskConical className="h-4 w-4 shrink-0 text-teal" aria-hidden="true" />
            Simulador de cenário
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-navy-3 leading-relaxed">
            Invente um cenário e veja o roteiro inteiro como ele apareceria em campo — sem criar
            cliente, sem criar inspeção e sem gravar nada. O simulador usa o mesmo motor da
            execução: o que ele mostra aqui é o que a consultora vai ver lá.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => setAberto((valor) => !valor)}
          className="shrink-0"
          aria-expanded={aberto}
        >
          {aberto ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
          {aberto ? 'Fechar simulador' : 'Simular cenário'}
        </Button>
      </div>

      {aberto && semCondicao && (
        <p className="rounded-xl bg-surface-sunken border border-default p-3 text-xs text-navy-2">
          Este roteiro não tem nenhuma condição configurada — todas as {resultado.itemCounts.total}{' '}
          exigências aparecem em toda inspeção. Não há o que simular ainda.
        </p>
      )}

      {aberto && !semCondicao && (
        <div className="space-y-6">
          {/* ── CENÁRIO ─────────────────────────────────────── */}
          <div className="rounded-xl border border-default bg-surface-sunken p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-navy-2">
                Cenário desta simulação
              </h3>
              <Button variant="ghost" size="sm" onClick={limpar}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Limpar cenário
              </Button>
            </div>

            {entradas.contextFields.length === 0 && entradas.questions.length === 0 && (
              <p className="text-xs text-navy-3">
                Nenhuma condição deste roteiro depende de dado do cadastro ou de pergunta de
                roteamento — não há cenário para variar.
              </p>
            )}

            {entradas.contextFields.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-navy-2">Dados do cadastro</p>
                <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {entradas.contextFields.map((field) => (
                    <Field
                      key={field.key}
                      label={field.label}
                      hint={field.type === 'text_list' ? 'Separe por vírgula' : undefined}
                    >
                      {field.type === 'boolean' ? (
                        <Select
                          size="sm"
                          value={contextoBruto[field.key] ?? ''}
                          onChange={(e) => setContextoBruto((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        >
                          <option value="">Sem valor</option>
                          <option value="true">Sim</option>
                          <option value="false">Não</option>
                        </Select>
                      ) : (
                        <Input
                          size="sm"
                          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                          value={contextoBruto[field.key] ?? ''}
                          onChange={(e) => setContextoBruto((prev) => ({ ...prev, [field.key]: e.target.value }))}
                          placeholder="Deixe em branco para simular dado ausente"
                        />
                      )}
                    </Field>
                  ))}
                </div>
              </div>
            )}

            {entradas.questions.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-navy-2">Perguntas de roteamento</p>
                <div className="mt-2 space-y-3">
                  {entradas.questions.map((question) => {
                    const resposta = respostas[question.id];
                    const indeterminada = ehIndeterminada(resposta);
                    return (
                      <div key={question.id} className="rounded-lg border border-default bg-surface p-3">
                        <Field
                          label={question.text || question.id}
                          hint={question.retiredAt ? 'Pergunta aposentada — o gate acusa isso' : question.helpText}
                        >
                          {question.type === 'boolean' && (
                            <Select
                              size="sm"
                              disabled={indeterminada}
                              value={resposta === true ? 'true' : resposta === false ? 'false' : ''}
                              onChange={(e) => responder(question, e.target.value === '' ? null : e.target.value === 'true')}
                            >
                              <option value="">Sem resposta</option>
                              <option value="true">Sim</option>
                              <option value="false">Não</option>
                            </Select>
                          )}

                          {question.type === 'single_choice' && (
                            <Select
                              size="sm"
                              disabled={indeterminada}
                              value={typeof resposta === 'string' ? resposta : ''}
                              onChange={(e) => responder(question, e.target.value || null)}
                            >
                              <option value="">Sem resposta</option>
                              {(question.options || []).map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </Select>
                          )}

                          {question.type === 'multi_choice' && (
                            <div className="space-y-1.5">
                              {(question.options || []).map((option) => {
                                const marcadas = Array.isArray(resposta) ? (resposta as string[]) : [];
                                return (
                                  <Checkbox
                                    key={option.value}
                                    label={option.label}
                                    disabled={indeterminada}
                                    checked={marcadas.includes(option.value)}
                                    onChange={(e) =>
                                      responder(
                                        question,
                                        e.target.checked
                                          ? [...marcadas, option.value]
                                          : marcadas.filter((valor) => valor !== option.value)
                                      )
                                    }
                                  />
                                );
                              })}
                            </div>
                          )}

                          {question.type === 'number' && (
                            <Input
                              size="sm"
                              type="number"
                              disabled={indeterminada}
                              value={numerosBrutos[question.id] ?? ''}
                              onChange={(e) => {
                                setNumerosBrutos((prev) => ({ ...prev, [question.id]: e.target.value }));
                                responder(question, e.target.value === '' ? null : e.target.value);
                              }}
                              placeholder="Sem resposta"
                            />
                          )}
                        </Field>

                        {/* Contrato § 6.4: "não foi possível determinar" é resposta, não ausência. */}
                        <Checkbox
                          className="mt-2"
                          label="Não foi possível determinar"
                          hint="Simula o campo em que a consultora não conseguiu apurar o dado"
                          checked={indeterminada}
                          onChange={(e) => alternarIndeterminada(question, e.target.checked)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {entradas.unknownQuestionIds.length > 0 && (
              <p className="text-xs font-semibold text-danger-soft-ink">
                {entradas.unknownQuestionIds.length} condição(ões) apontam para pergunta que não
                existe mais neste roteiro. O simulador não tem o que perguntar, e o gate reprova a
                publicação.
              </p>
            )}
          </div>

          {/* ── RESULTADO ───────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-navy-2">
                Neste cenário, a inspeção teria
              </h3>
              <Contagem counts={resultado.itemCounts} />
            </div>

            <p className="text-[11px] text-navy-3">
              {resultado.itemCounts.aplicavel} de {resultado.itemCounts.total} exigências cadastradas
              entrariam na nota. As demais continuam registradas no roteiro — só não seriam avaliadas
              neste cenário.
            </p>

            <ul className="space-y-2">
              {resultado.sections.map((section) => {
                const Icone = ICONE[section.decision.state];
                const expandida = expandidas.has(section.id);
                return (
                  <li key={section.id} className="rounded-xl border border-default bg-surface overflow-hidden">
                    <button
                      type="button"
                      onClick={() => alternarSecao(section.id)}
                      aria-expanded={expandida}
                      className="flex w-full items-start gap-3 p-3 text-left hover:bg-surface-sunken transition-colors [@media(pointer:coarse)]:min-h-11"
                    >
                      {expandida ? (
                        <ChevronDown className="h-4 w-4 shrink-0 mt-0.5 text-navy-3" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 mt-0.5 text-navy-3" aria-hidden="true" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-navy break-words">{section.label}</span>
                          <Badge variant={TOM[section.decision.state]} className="gap-1 shrink-0">
                            <Icone className="h-3 w-3" aria-hidden="true" />
                            {STATE_LABELS[section.decision.state]}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-navy-2 leading-relaxed">
                          {section.decision.explanation}
                        </p>
                        <div className="mt-1.5">
                          <Contagem counts={section.counts} />
                        </div>
                      </div>
                    </button>

                    {expandida && (
                      <ul className="border-t border-default divide-y divide-default">
                        {section.items.map((item) => {
                          const IconeItem = ICONE[item.decision.state];
                          return (
                            <li key={item.id} className="flex items-start gap-2 p-3">
                              <IconeItem
                                className={
                                  item.decision.state === 'aplicavel'
                                    ? 'h-4 w-4 shrink-0 mt-0.5 text-success'
                                    : item.decision.state === 'pendente_de_condicao'
                                      ? 'h-4 w-4 shrink-0 mt-0.5 text-amber-strong'
                                      : 'h-4 w-4 shrink-0 mt-0.5 text-navy-3'
                                }
                                aria-hidden="true"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-navy break-words">{item.label}</p>
                                <p className="mt-0.5 text-[11px] text-navy-3 leading-relaxed">
                                  <span className="sr-only">{STATE_LABELS[item.decision.state]}: </span>
                                  {item.decision.explanation}
                                </p>
                              </div>
                            </li>
                          );
                        })}
                        {section.items.length === 0 && (
                          <li className="p-3 text-[11px] text-navy-3">Seção sem exigências cadastradas.</li>
                        )}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}

/** Os três números, sempre nos três canais: cor, ícone e palavra (Manual de Marca, item 2). */
function Contagem({ counts }: { counts: SimulationCounts }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      <Badge variant="success" className="gap-1">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        {counts.aplicavel} aplicáveis
      </Badge>
      <Badge variant="neutral" className="gap-1">
        <MinusCircle className="h-3 w-3" aria-hidden="true" />
        {counts.nao_aplicavel_por_regra} fora por regra
      </Badge>
      <Badge variant="warning" className="gap-1">
        <HelpCircle className="h-3 w-3" aria-hidden="true" />
        {counts.pendente_de_condicao} pendentes
      </Badge>
    </div>
  );
}
