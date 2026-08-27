// ============================================================
// src/components/templates/RoutingQuestionsPanel.tsx
// COND-06 — as perguntas de roteamento do roteiro, e as travas do ciclo de vida.
//
// Pergunta de roteamento **não é requisito sanitário** (contrato § 3): não tem
// peso, não é NC, não entra na nota. Ela existe só para decidir o que aparece —
// e é por isso que ela mora aqui, longe dos itens.
//
// As duas travas do card são bloqueio, não aviso:
//   · aposentar pergunta com dependente — **bloqueada**
//   · excluir opção citada por regra — **bloqueada**
// Quem decide as duas é `domain/applicability/authoring.ts`; esta tela só mostra
// o motivo e lista quem depende, para a consultora saber onde mexer primeiro.
//
// O que **não** trava: renomear a pergunta e renomear a opção. O rótulo é texto,
// a regra guarda id — mudar a redação nunca quebra regra (handoff, regra 4).
// ============================================================

import { Archive, ChevronDown, ChevronRight, HelpCircle, Lock, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Checkbox } from '../ui/Checkbox';
import { EmptyState } from '../ui/EmptyState';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';
import { describeRule, rulesUsingQuestion } from '../../domain/applicability';
import type { ApplicabilityRule, AuthoringGuard, RoutingQuestion } from '../../domain/applicability';

export interface RoutingQuestionsPanelProps {
  questions: RoutingQuestion[];
  rules: ApplicabilityRule[];
  /** Seções do roteiro em edição — para dizer onde a pergunta é respondida. */
  sections: { id: string; title: string }[];
  onChange: (questions: RoutingQuestion[]) => void;
  podeAposentar: (questionId: string) => AuthoringGuard;
  podeExcluirOpcao: (questionId: string, optionValue: string) => AuthoringGuard;
  makeId: () => string;
}

const TIPOS: { value: RoutingQuestion['type']; label: string }[] = [
  { value: 'boolean', label: 'Sim / Não' },
  { value: 'single_choice', label: 'Escolha única' },
  { value: 'multi_choice', label: 'Escolha múltipla' },
  { value: 'number', label: 'Número' },
];

const TEM_OPCAO: RoutingQuestion['type'][] = ['single_choice', 'multi_choice'];

export function RoutingQuestionsPanel({
  questions,
  rules,
  sections,
  onChange,
  podeAposentar,
  podeExcluirOpcao,
  makeId,
}: RoutingQuestionsPanelProps) {
  const [aberta, setAberta] = useState<string | null>(null);
  const [bloqueio, setBloqueio] = useState<{ questionId: string; motivo: string } | null>(null);

  const atualizar = (questionId: string, mudanca: Partial<RoutingQuestion>) => {
    onChange(questions.map((q) => (q.id === questionId ? { ...q, ...mudanca } : q)));
  };

  const adicionar = () => {
    const nova: RoutingQuestion = {
      id: makeId(),
      text: '',
      type: 'boolean',
      askAt: 'execution',
      required: false,
    };
    onChange([...questions, nova]);
    setAberta(nova.id);
  };

  /** Excluir de vez só vale para pergunta que ninguém usa — mesma trava do aposentar. */
  const excluir = (question: RoutingQuestion) => {
    const guarda = podeAposentar(question.id);
    if (!guarda.allowed) {
      setBloqueio({ questionId: question.id, motivo: guarda.reason });
      return;
    }
    onChange(questions.filter((q) => q.id !== question.id));
    setBloqueio(null);
  };

  const aposentar = (question: RoutingQuestion) => {
    const guarda = podeAposentar(question.id);
    if (!guarda.allowed) {
      setBloqueio({ questionId: question.id, motivo: guarda.reason });
      return;
    }
    atualizar(question.id, { retiredAt: new Date().toISOString() });
    setBloqueio(null);
  };

  return (
    <Card className="p-6 space-y-4 overflow-visible">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-navy">Perguntas de roteamento</h2>
          <p className="mt-1 text-xs text-navy-3 leading-relaxed max-w-2xl">
            Servem só para decidir o que aparece na inspeção. Não têm peso, não viram não
            conformidade e não entram na nota — por isso ficam separadas dos itens.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={adicionar} className="shrink-0">
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Pergunta
        </Button>
      </div>

      {questions.length === 0 ? (
        <EmptyState
          icon={<HelpCircle className="h-8 w-8" />}
          title="Nenhuma pergunta de roteamento"
          description="Sem pergunta, as condições só podem olhar o contexto da inspeção (UF, categoria, capacidade)."
        />
      ) : (
        <div className="space-y-2">
          {questions.map((question) => {
            const expandida = aberta === question.id;
            const dependentes = rulesUsingQuestion({ rules }, question.id);
            const travada = bloqueio?.questionId === question.id ? bloqueio.motivo : null;

            return (
              <div key={question.id} className="rounded-xl border border-default overflow-hidden">
                <div className="flex items-center gap-2 bg-surface-sunken p-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    aria-expanded={expandida}
                    aria-label={expandida ? 'Recolher pergunta' : 'Expandir pergunta'}
                    onClick={() => setAberta(expandida ? null : question.id)}
                  >
                    {expandida ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm font-semibold ${
                        question.retiredAt ? 'text-navy-3 line-through' : 'text-navy'
                      } ${!question.text ? 'italic text-navy-3' : ''}`}
                    >
                      {question.text || 'Nova pergunta…'}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-navy-3">
                      <span>{TIPOS.find((t) => t.value === question.type)?.label}</span>
                      <span>·</span>
                      <span>{question.askAt === 'wizard' ? 'Respondida no agendamento' : 'Respondida em campo'}</span>
                      {question.required && (
                        <>
                          <span>·</span>
                          <span className="font-semibold text-amber-strong">Obrigatória</span>
                        </>
                      )}
                    </div>
                  </div>

                  {dependentes.length > 0 && (
                    <Badge variant="neutral" className="shrink-0 gap-1">
                      <Lock className="h-3 w-3" />
                      {dependentes.length} {dependentes.length === 1 ? 'regra' : 'regras'}
                    </Badge>
                  )}
                  {question.retiredAt && (
                    <Badge variant="neutral" className="shrink-0">Aposentada</Badge>
                  )}
                </div>

                {expandida && (
                  <div className="space-y-4 border-t border-default p-4">
                    <div>
                      <Label>Pergunta</Label>
                      <Input
                        className="mt-1.5"
                        value={question.text}
                        onChange={(e) => atualizar(question.id, { text: e.target.value })}
                        placeholder="Ex: Realiza processamento de artigos?"
                      />
                      <p className="mt-1 text-[11px] text-navy-3">
                        Reescrever o texto não quebra regra nenhuma — a condição guarda o id, não a frase.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div>
                        <Label>Tipo de resposta</Label>
                        <Select
                          className="mt-1.5"
                          value={question.type}
                          onChange={(e) =>
                            atualizar(question.id, { type: e.target.value as RoutingQuestion['type'] })
                          }
                        >
                          {TIPOS.map((tipo) => (
                            <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <Label>Quando é respondida</Label>
                        <Select
                          className="mt-1.5"
                          value={question.askAt ?? 'execution'}
                          onChange={(e) =>
                            atualizar(question.id, { askAt: e.target.value as 'wizard' | 'execution' })
                          }
                        >
                          <option value="wizard">No agendamento, antes da visita</option>
                          <option value="execution">Em campo, durante a inspeção</option>
                        </Select>
                      </div>
                      <div>
                        <Label>Seção onde aparece</Label>
                        <Select
                          className="mt-1.5"
                          value={question.sectionId ?? ''}
                          onChange={(e) => atualizar(question.id, { sectionId: e.target.value || undefined })}
                        >
                          <option value="">Sem seção definida</option>
                          {sections.map((section) => (
                            <option key={section.id} value={section.id}>{section.title}</option>
                          ))}
                        </Select>
                      </div>
                    </div>

                    <Checkbox
                      checked={Boolean(question.required)}
                      onChange={(e) => atualizar(question.id, { required: e.target.checked })}
                      label="Obrigatória"
                      hint="Enquanto não for respondida, o que depende dela fica pendente e o bloco não libera."
                    />

                    {TEM_OPCAO.includes(question.type) && (
                      <EditorDeOpcoes
                        question={question}
                        podeExcluirOpcao={podeExcluirOpcao}
                        onChange={(options) => atualizar(question.id, { options })}
                        makeId={makeId}
                      />
                    )}

                    {dependentes.length > 0 && (
                      <div className="rounded-lg border border-default bg-surface-sunken p-3">
                        <p className="text-xs font-bold text-navy">
                          Quem depende desta pergunta
                        </p>
                        <ul className="mt-2 space-y-1">
                          {dependentes.map((regra) => (
                            <li key={regra.id} className="text-xs text-navy-2">
                              <span className="font-semibold">
                                {regra.target.type === 'section' ? 'Seção' : 'Item'}
                              </span>{' '}
                              — {describeRule(regra, { routingQuestions: questions })}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {travada && (
                      <p className="rounded-lg bg-amber-soft border border-amber-soft-border p-3 text-xs font-medium text-amber-strong">
                        {travada}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 border-t border-default pt-4">
                      {question.retiredAt ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => atualizar(question.id, { retiredAt: null })}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reativar pergunta
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-amber-strong border-amber-soft-border hover:bg-amber-soft disabled:opacity-40"
                          disabled={dependentes.length > 0}
                          title={
                            dependentes.length > 0
                              ? 'Remova as regras que usam esta pergunta antes de aposentá-la'
                              : 'Aposentar pergunta'
                          }
                          onClick={() => aposentar(question)}
                        >
                          <Archive className="h-3.5 w-3.5 mr-1.5" /> Aposentar pergunta
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger hover:bg-danger-soft disabled:opacity-40"
                        disabled={dependentes.length > 0}
                        title={
                          dependentes.length > 0
                            ? 'Remova as regras que usam esta pergunta antes de excluí-la'
                            : 'Excluir pergunta'
                        }
                        onClick={() => excluir(question)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Excluir
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

interface OpcoesProps {
  question: RoutingQuestion;
  podeExcluirOpcao: (questionId: string, optionValue: string) => AuthoringGuard;
  onChange: (options: RoutingQuestion['options']) => void;
  makeId: () => string;
}

function EditorDeOpcoes({ question, podeExcluirOpcao, onChange, makeId }: OpcoesProps) {
  const [bloqueio, setBloqueio] = useState<string | null>(null);
  const opcoes = question.options ?? [];

  const excluir = (value: string) => {
    const guarda = podeExcluirOpcao(question.id, value);
    if (!guarda.allowed) {
      setBloqueio(guarda.reason);
      return;
    }
    setBloqueio(null);
    onChange(opcoes.filter((option) => option.value !== value));
  };

  return (
    <div>
      <Label>Opções de resposta</Label>
      <div className="mt-1.5 space-y-2">
        {opcoes.map((option) => {
          const guarda = podeExcluirOpcao(question.id, option.value);
          return (
            <div key={option.value} className="flex items-center gap-2">
              <Input
                size="sm"
                className="flex-1"
                aria-label="Rótulo da opção"
                value={option.label}
                onChange={(e) =>
                  onChange(
                    opcoes.map((o) => (o.value === option.value ? { ...o, label: e.target.value } : o))
                  )
                }
                placeholder="Ex: Próprio"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-navy-3 hover:text-danger hover:bg-danger-soft disabled:opacity-30"
                disabled={!guarda.allowed}
                title={guarda.allowed ? 'Excluir opção' : guarda.reason}
                onClick={() => excluir(option.value)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>

      {bloqueio && (
        <p className="mt-2 rounded-lg bg-amber-soft border border-amber-soft-border p-2.5 text-xs font-medium text-amber-strong">
          {bloqueio}
        </p>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="mt-2 border border-dashed border-default"
        onClick={() => onChange([...opcoes, { value: makeId(), label: '' }])}
      >
        <Plus className="h-3.5 w-3.5 mr-1.5" /> Opção
      </Button>
      <p className="mt-1 text-[11px] text-navy-3">
        Renomear a opção é seguro; excluir uma opção citada por regra é bloqueado.
      </p>
    </div>
  );
}
