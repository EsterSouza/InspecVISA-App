import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Trash2, FileUp, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { TemplateService } from '../../services/templateService';
import { toast } from '../../store/useToastStore';

/**
 * Edição no lugar, dentro da célula da tabela: o campo passa pelo primitivo (foco, alvo de
 * toque e fiação de acessibilidade vêm de lá), mas sem moldura — quem delimita é a célula.
 */
const INLINE_CELL_INPUT = 'h-auto border-0 bg-transparent px-0 py-0 focus-visible:ring-offset-1';

interface ParsedItem {
  id: number;
  section: string;
  description: string;
  legislation: string;
  weight: number;
  isCritical: boolean;
}

export function SmartImporter() {
  const navigate = useNavigate();
  const [templateName, setTemplateName] = useState('');
  const [category, setCategory] = useState<'estetica' | 'ilpi' | 'alimentos'>('estetica');
  const [pastedText, setPastedText] = useState('');
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingFile(true);
    try {
      const { DocumentParser } = await import('../../utils/documentParser');
      let text = '';
      if (file.type === 'application/pdf') {
        text = await DocumentParser.parsePDF(file);
      } else if (file.name.endsWith('.docx')) {
        text = await DocumentParser.parseWord(file);
      } else if (file.name.endsWith('.ts') || file.name.endsWith('.tsx')) {
        text = await DocumentParser.parseTextFile(file);
      } else {
        toast.error('Formato não suportado.', 'Use PDF, DOCX ou TypeScript.');
        return;
      }

      const parsedItems = file.name.endsWith('.ts') || file.name.endsWith('.tsx')
        ? DocumentParser.parseTypeScript(text)
        : DocumentParser.heuristicParse(text);
      const mapped = parsedItems.map((pi, idx) => ({
        id: items.length + idx + 1,
        section: pi.section,
        description: pi.description,
        legislation: pi.legislation || 'Consultar Legislação',
        weight: pi.weight || 1,
        isCritical: pi.isCritical || false
      }));

      setItems(prev => [...prev, ...mapped]);
    } catch (err) {
      console.error('File parse error:', err);
      toast.error('Erro ao processar arquivo.');
    } finally {
      setIsParsingFile(false);
    }
  };

  const handleParseText = async () => {
    setIsProcessing(true);
    try {
      const { DocumentParser } = await import('../../utils/documentParser');
      const looksLikeTypescript = /export\s+const|description:\s*['"`]|sectionId:\s*['"`]/.test(pastedText);
      const parsedItems: Array<{ section: string; description: string; legislation?: string; weight?: number; isCritical?: boolean }> = looksLikeTypescript
        ? DocumentParser.parseTypeScript(pastedText)
        : pastedText.split('\n').filter(l => l.trim().length > 10).map(line => {
            const parts = line.split('\t');
            return {
              section: parts[1] || 'Geral',
              description: parts[2] || parts[1] || line,
              legislation: parts[3] || 'Consultar Legislação',
            };
          });

      const newItems: ParsedItem[] = parsedItems.map((item, idx) => ({
        id: items.length + idx + 1,
        section: item.section,
        description: item.description,
        legislation: item.legislation || 'Consultar Legislação',
        weight: item.weight || 1,
        isCritical: item.isCritical || false
      }));
      setItems([...items, ...newItems]);
      setPastedText('');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!templateName || items.length === 0) return;
    setIsSaving(true);
    try {
      await TemplateService.saveFullTemplate(templateName, category, items);
      toast.success('Roteiro salvo com sucesso!');
      navigate('/templates');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar roteiro.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-navy">Importador Inteligente</h2>
          <p className="text-navy-3">Transforme documentos PDF, Word ou Excel em roteiros digitais.</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/templates')}>Cancelar</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-xs font-bold uppercase text-primary-700">Configurações Gerais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Nome do Roteiro">
              <Input
                type="text"
                placeholder="Ex: ROI Estética II - 2024"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </Field>
            <Field label="Categoria">
              <Select value={category} onChange={(e) => setCategory(e.target.value as 'estetica' | 'ilpi' | 'alimentos')}>
                <option value="estetica">Estética e Beleza</option>
                <option value="ilpi">ILPI</option>
                <option value="alimentos">Alimentos</option>
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-xs font-bold uppercase text-primary-700">Upload de Documento</CardTitle>
          </CardHeader>
          <CardContent>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-default rounded-2xl p-8 cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-all group">
              {isParsingFile ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="h-10 w-10 text-primary-600 animate-spin mb-2" />
                  <p className="text-sm font-medium text-navy-2">Extraindo texto do arquivo...</p>
                </div>
              ) : (
                <>
                  <FileUp className="h-10 w-10 text-navy-3 group-hover:text-primary-500 mb-2" />
                  <span className="text-sm font-medium text-navy-2">Clique para selecionar PDF, Word ou TypeScript</span>
                  <span className="text-xs text-navy-3 mt-1">Sincronização automática de itens</span>
                </>
              )}
              {/* Exceção FE-24: seletor de arquivo escondido — a área clicável é o rótulo inteiro. */}
              <input type="file" className="hidden" accept=".pdf,.docx,.ts,.tsx" onChange={handleFileUpload} disabled={isParsingFile} />
            </label>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <Field
            label={
              <span className="inline-flex items-center gap-2">
                Ou cole conteúdo estruturado (Excel)
                <Badge>Control+V da Planilha</Badge>
              </span>
            }
          >
            <Textarea
              className="min-h-[150px] font-mono text-xs"
              placeholder="Eixo	Item	Descrição	Lei"
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
            />
          </Field>
          <Button onClick={handleParseText} disabled={!pastedText || isProcessing} variant="outline" className="w-full">
            {isProcessing ? 'Processando...' : 'Adicionar texto colado'}
          </Button>
        </CardContent>
      </Card>

      {items.length > 0 && (
        <Card className="border-primary-100 shadow-xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b bg-surface-sunken px-6 py-4">
            <CardTitle className="text-sm font-bold uppercase text-primary-700">
              Revisão dos Itens EXTRAÍDOS ({items.length})
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setItems([])} className="text-danger hover:bg-danger-soft">Zerar</Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving || !templateName} className="shadow-lg shadow-primary-200">
                {isSaving ? 'Salvando...' : <><Save className="h-4 w-4 mr-2" /> Finalizar e Criar Roteiro</>}
              </Button>
            </div>
          </CardHeader>
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full text-left table-fixed">
              <thead className="bg-surface sticky top-0 border-b border-default shadow-sm">
                <tr className="text-[10px] font-bold text-navy-3 uppercase tracking-widest">
                  <th className="px-6 py-3 w-1/4">Seção</th>
                  <th className="px-6 py-3 w-1/2">Descrição</th>
                  <th className="px-6 py-3 w-1/4">Legislação</th>
                  <th className="px-6 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-sunken">
                {items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-primary-50/30 transition-colors">
                    <td className="px-6 py-4 align-top">
                      <Input
                        aria-label={`Seção do item ${idx + 1}`}
                        className={INLINE_CELL_INPUT + ' font-semibold text-primary-900'}
                        value={item.section}
                        onChange={(e) => {
                          const n = [...items];
                          n[idx].section = e.target.value;
                          setItems(n);
                        }}
                      />
                    </td>
                    <td className="px-6 py-4 align-top">
                      <Textarea
                        aria-label={`Descrição do item ${idx + 1}`}
                        className={INLINE_CELL_INPUT + ' min-h-0 resize-none text-xs text-navy-2'}
                        value={item.description}
                        rows={2}
                        onChange={(e) => {
                          const n = [...items];
                          n[idx].description = e.target.value;
                          setItems(n);
                        }}
                      />
                    </td>
                    <td className="px-6 py-4 align-top">
                      <Input
                        aria-label={`Legislação do item ${idx + 1}`}
                        className={INLINE_CELL_INPUT + ' text-xs italic text-secondary-600'}
                        value={item.legislation}
                        onChange={(e) => {
                          const n = [...items];
                          n[idx].legislation = e.target.value;
                          setItems(n);
                        }}
                      />
                    </td>
                    <td className="px-6 py-4 align-top">
                      <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-navy-3 hover:text-danger">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="px-2 py-0.5 bg-surface-sunken rounded-full text-[10px] text-navy-3 font-bold ml-2">{children}</span>;
}
