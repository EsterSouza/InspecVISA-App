// ============================================================
// src/data/templates.ts
// ROTEIROS REAIS — C&C CONSULTORIA SANITÁRIA
// Gerado automaticamente a partir dos ROIs originais
// Estética: V. atual (114 itens) | ILPI: V.11/2024 (81 itens)
// ============================================================

import type { ChecklistSupplement, ChecklistTemplate, Client, Section } from '../types';
import { alimentosTemplates } from './templates_alimentos';
import { getExtraSections } from './templates_alimentos_segmentos';
import { isAlimentosFederalTemplate, supplementRegistry } from './supplementRegistry';
import { templateEsteticaClinica } from './estetica/roteiro-clinica';
import { templateEsteticaEmbelezamento } from './estetica/roteiro-embelezamento';
import { templateServicosSaude } from './saude/roteiro-servicos-saude';
import { buildRequirementIndex, normalizeRequirementText } from '../utils/itemIdentity';


// ── MAPEAMENTO DE PESOS ──────────────────────────────────────
// Estética:  Imprescindível=10 | Necessário=5 | Recomendado=2 | Sugerido=1
// ILPI:      Imprescindível=10 | Necessário=5 | Recomendável=2
// isCritical = true apenas para Imprescindível
// ─────────────────────────────────────────────────────────────

export const templates: ChecklistTemplate[] = [
  templateEsteticaClinica,
  templateEsteticaEmbelezamento,
  templateServicosSaude,
  {
    id: 'tpl-ilpi-federal-v1',
    name: 'Roteiro de Inspeção — ILPI (Base Federal)',
    category: 'ilpi',
    version: '06/2026',
    sections: [

      // SEÇÃO 1 _______________________________________
      {
        id: 'sec-fed-01',
        title: 'Estrutura Física : Geral',
        order: 1,
        items: [
          { id: 'fed-001', sectionId: 'sec-fed-01', order: 1, description: 'O funcionamento da ILPI é autorizado mediante Alvará/Licença Sanitária vigente expedida pelo órgão sanitário local, em conformidade com a Lei Federal nº 6.437/1977.', legislation: 'Art. 8º da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-001a', sectionId: 'sec-fed-01', order: 2, description: 'Possui Projeto Básico de Arquitetura (planta baixa) aprovado pela autoridade sanitária local, em caso de construção, reforma ou adaptação.', legislation: 'Art. 19 da RDC 502/2021', weight: 10, isCritical: false },
          { id: 'fed-001b', sectionId: 'sec-fed-01', order: 3, description: 'As instalações prediais de proteção e combate a incêndio atendem às exigências locais (possui Certificado/Laudo do Corpo de Bombeiros vigente).', legislation: 'Art. 23 da RDC 502/2021; legislação estadual', weight: 10, isCritical: true },
          // REF-05: texto unificado com o do banco, que é o que está em uso e é mais verificável
          // em campo (piso antiderrapante, ausência de barreiras). Mesmo Art. 21, que remete à
          // Lei nº 10.098/2000 e, por ela, à NBR 9050.
          { id: 'fed-002', sectionId: 'sec-fed-01', order: 4, description: 'A infraestrutura física garante a independência e a mobilidade dos residentes, com pisos regulares e antiderrapantes, sem obstáculos ou barreiras à locomoção, atendendo à acessibilidade.', legislation: 'Art. 21 da RDC 502/2021 (Lei nº 10.098/2000); ABNT NBR 9050', weight: 10, isCritical: true },
          { id: 'fed-003', sectionId: 'sec-fed-01', order: 5, description: 'Quando o terreno apresenta desníveis, a edificação é dotada de rampas com corrimãos para facilitar o acesso e a movimentação dos residentes, em conformidade com a ABNT NBR 9050.', legislation: 'Art. 22 da RDC 502/2021; ABNT NBR 9050', weight: 10, isCritical: true },
          // REF-05 (06/08/2026): o texto anterior exigia 1,50m nas principais e 1,00m nas
          // secundárias, confundindo o limiar do § 1º com a largura mínima do caput. O Art. 25
          // exige 1,00m e 0,80m; 1,50m é só o ponto a partir do qual o corrimão passa a ser
          // obrigatório dos dois lados (§ 1º), sendo facultado em um só lado abaixo disso (§ 2º).
          // Texto alinhado ao que já estava correto no banco. Verificado contra a RDC em 06/08/2026.
          { id: 'fed-004', sectionId: 'sec-fed-01', order: 6, description: 'As circulações internas principais possuem largura mínima de 1,00m e as secundárias, no mínimo 0,80m, com luz de vigília permanente. Circulações com largura igual ou superior a 1,50m possuem corrimão dos dois lados; as de largura inferior, corrimão em ao menos um lado.', legislation: 'Art. 25 da RDC 502/2021', weight: 10, isCritical: false },
          { id: 'fed-005', sectionId: 'sec-fed-01', order: 7, description: 'Em caso de edificação com mais de um pavimento que não possua rampa com especificações da ABNT, dispõe de elevador.', legislation: 'Art. 26 da RDC 502/2021', weight: 10, isCritical: false },
          { id: 'fed-006', sectionId: 'sec-fed-01', order: 8, description: 'Todas as portas possuem vão livre com largura mínima de 1,10m e travamento simples, sem o uso de trancas ou chaves, permitindo abertura imediata em situação de emergência.', legislation: 'Art. 27 da RDC 502/2021', weight: 10, isCritical: false },
          { id: 'fed-007', sectionId: 'sec-fed-01', order: 9, description: 'Janelas e guarda-corpos possuem peitoris com altura mínima de 1,00m, garantindo a segurança dos residentes contra quedas.', legislation: 'Art. 28 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-008', sectionId: 'sec-fed-01', order: 10, description: 'Possui sala de convivência com área mínima de 1,3 m² (um vírgula três metros quadrados) por residente.', legislation: 'Art. 29, Inciso II da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-009', sectionId: 'sec-fed-01', order: 11, description: 'Possui ambiente para guarda de material de limpeza (DML), provido de tanque e área para guarda de saneantes e utensílios.', legislation: 'Art. 29, Inciso XI da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-010', sectionId: 'sec-fed-01', order: 12, description: 'Possui sala para atividades de assistência individualizada e sigilosa (assistência social, psicológica, saúde, etc).', legislation: 'Art. 29, Inciso II, item 3, da RDC 502/2021', weight: 5, isCritical: false },
          { id: 'fed-011', sectionId: 'sec-fed-01', order: 13, description: 'Possui espaço destinado para os serviços administrativos da instituição.', legislation: 'Art. 29, Inciso VI da RDC 502/2021', weight: 5, isCritical: false },
          { id: 'fed-012', sectionId: 'sec-fed-01', order: 14, description: 'As instalações elétricas não apresentam fiação exposta ou componentes danificados que ofereçam risco aos residentes e trabalhadores.', legislation: 'NR-10; Art. 21 e Art. 23 da RDC 502/2021', weight: 10, isCritical: true },
          // REF-05 (06/08/2026): seis itens que existiam só no banco, criados pelo app e nunca
          // devolvidos ao código. Conferidos contra a RDC 502/2021 — todos bem ancorados. Sem
          // isto, um reseed do roteiro os apagaria de produção.
          { id: 'fed-012a', sectionId: 'sec-fed-01', order: 15, description: 'As paredes, pisos, rodapés e tetos apresentam revestimentos íntegros, laváveis, impermeáveis e em bom estado de conservação, sem soluções de continuidade, trincas ou infiltrações.', legislation: 'Art. 21; Art. 24, II da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-012b', sectionId: 'sec-fed-01', order: 16, description: 'Os ambientes, especialmente dormitórios e banheiros, encontram-se livres de mofo, bolor e umidade excessiva nos revestimentos.', legislation: 'Art. 21 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-012c', sectionId: 'sec-fed-01', order: 17, description: 'Os dormitórios e banheiros possuem iluminação e ventilação naturais adequadas, com janelas em condições de uso para renovação do ar e redução da umidade.', legislation: 'Art. 21 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-012d', sectionId: 'sec-fed-01', order: 18, description: 'Os ambientes (quartos, banheiros e áreas comuns) encontram-se limpos, organizados e sem odores desagradáveis, restos de alimentos, presença de pragas/vetores ou acúmulo de inservíveis (móveis e objetos quebrados sem uso).', legislation: 'Art. 21; Art. 51; Art. 46, IV da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-012e', sectionId: 'sec-fed-01', order: 19, description: 'As instalações hidrossanitárias dos banheiros dos residentes (encanamento, ralos, registros e descargas) encontram-se em pleno funcionamento, sem entupimentos, vazamentos ou escoamento deficiente.', legislation: 'Art. 23 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-012f', sectionId: 'sec-fed-01', order: 20, description: 'As esquadrias e vidros das janelas encontram-se íntegros, sem improvisos (ex.: vedação com papelão), e a edificação não apresenta aberturas ou buracos que comprometam a segurança e a salubridade dos ambientes.', legislation: 'Art. 21 da RDC 502/2021', weight: 10, isCritical: true },
        ],
      },

      // SEÇÃO 2 _______________________________________
      {
        id: 'sec-fed-02',
        title: 'Dormitórios',
        order: 2,
        items: [
          { id: 'fed-013', sectionId: 'sec-fed-02', order: 1, description: 'Dormitórios são separados por sexo e possuem no máximo 4 (quatro) camas por ambiente.', legislation: 'Alínea "a", Inciso I do Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-014', sectionId: 'sec-fed-02', order: 2, description: 'Dormitórios para 1 (uma) pessoa possuem área mínima de 7,50 m² (sete vírgula cinquenta metros quadrados).', legislation: 'Alínea "a.1", Inciso I do Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-015', sectionId: 'sec-fed-02', order: 3, description: 'Dormitórios de 2 a 4 pessoas possuem área mínima de 5,50 m² (cinco vírgula cinquenta metros quadrados) por cama.', legislation: 'Alínea "a.2", Inciso I do Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-016', sectionId: 'sec-fed-02', order: 4, description: 'Dormitórios são dotados de luz de vigília e campainha de alarme próximos a cada cama.', legislation: 'Alínea "b", Inciso I do Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-016a', sectionId: 'sec-fed-02', order: 5, description: 'Os colchões, colchonetes e demais mobiliários almofadados são revestidos de material lavável e impermeável, sem furos ou rasgos.', legislation: 'Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-017', sectionId: 'sec-fed-02', order: 6, description: 'Existe distância mínima de 0,80m (oitenta centímetros) entre duas camas.', legislation: 'Alínea "c", Inciso I do Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
        ],
      },

      // SEÇÃO 3  _______________________________________
      {
        id: 'sec-fed-03',
        title: 'Banheiros',
        order: 3,
        items: [
          { id: 'fed-018', sectionId: 'sec-fed-03', order: 1, description: 'Os banheiros possuem área mínima de 3,60 m².', legislation: 'Art. 29 da RDC 502/2021', weight: 10, isCritical: false },
          { id: 'fed-019', sectionId: 'sec-fed-03', order: 2, description: 'Cada banheiro é provido, no mínimo, de 1 bacia sanitária, 1 lavatório e 1 chuveiro, garantindo a privacidade do residente.', legislation: 'Art. 29, Inciso I, item 5, da RDC 502/2021', weight: 10, isCritical: false },
          { id: 'fed-020', sectionId: 'sec-fed-03', order: 3, description: 'O piso do banheiro é projetado sem desnível em forma de degrau, utilizando caimento para escoamento da água.', legislation: 'Art. 29, Inciso I, item 5, da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-021', sectionId: 'sec-fed-03', order: 4, description: 'Possui barras de apoio instaladas no lavatório, na bacia sanitária e no chuveiro.', legislation: 'ABNT NBR 9050; Art. 21 da RDC 502/2021', weight: 10, isCritical: true },
        ],
      },

      // SEÇÃO 4 
      {
        id: 'sec-fed-04',
        title: 'Medicamentos',
        order: 4,
        items: [
          { id: 'fed-022', sectionId: 'sec-fed-04', order: 1, description: 'Os medicamentos em uso pelos idosos estão sob responsabilidade do Responsável Técnico (RT), respeitando os regulamentos de vigilância sanitária quanto à guarda, sendo vedado o estoque sem prescrição médica.', legislation: 'Art. 40 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-023', sectionId: 'sec-fed-04', order: 2, description: 'Medicamentos sujeitos a controle especial (psicotrópicos) são obrigatoriamente guardados sob chave ou outro dispositivo que ofereça segurança, em local exclusivo, com registros de controle.', legislation: 'Art. 67 da Portaria SVS/MS 344/1998', weight: 10, isCritical: true },
          { id: 'fed-024', sectionId: 'sec-fed-04', order: 3, description: 'Possui geladeira exclusiva com termômetro e planilha de registro para controle diário de temperatura de medicamentos termolábeis.', legislation: 'Art. 40 da RDC 502/2021; RDC ANVISA nº 430/2020', weight: 10, isCritical: true },
        ],
      },

      // SEÇÃO 5 _______________________________________
      {
        id: 'sec-fed-05',
        title: 'Serviço de Nutrição',
        order: 5,
        items: [
          { id: 'fed-025', sectionId: 'sec-fed-05', order: 1, description: 'É garantido aos residentes o fornecimento de, no mínimo, 6 (seis) refeições diárias.', legislation: 'Art. 44 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-026', sectionId: 'sec-fed-05', order: 2, description: 'A alimentação é fornecida de acordo com as necessidades nutricionais e condições de saúde dos residentes.', legislation: 'Art. 44 e Art. 45 da RDC 502/2021; RDC 216/2004', weight: 5, isCritical: false },
          { id: 'fed-027', sectionId: 'sec-fed-05', order: 3, description: 'O serviço possui e implementa o Manual de Boas Práticas e os Procedimentos Operacionais Padronizados (POPs), mantendo-os acessíveis aos funcionários envolvidos e à autoridade sanitária.', legislation: 'Itens 4.11.1 e 4.11.2 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-028', sectionId: 'sec-fed-05', order: 4, description: 'Caso realize preparo de Terapia de Nutrição Enteral (TNE) no local, possui área exclusiva e adequada para esta manipulação.', legislation: 'Arts. 1º e 101 da RDC ANVISA nº 503/2021', weight: 5, isCritical: false },
          { id: 'fed-029', sectionId: 'sec-fed-05', order: 5, description: 'Instalações físicas (piso, parede e teto) possuem revestimento liso, impermeável, lavável e em bom estado de conservação.', legislation: 'Item 4.1.3 da RDC 216/2004', weight: 5, isCritical: false },
          { id: 'fed-030', sectionId: 'sec-fed-05', order: 6, description: 'Acessos às áreas de preparação de alimentos são controlados e independentes, não sendo utilizados como passagem.', legislation: 'Item 4.1.1 da RDC 216/2004', weight: 5, isCritical: false },
          { id: 'fed-031', sectionId: 'sec-fed-05', order: 7, description: 'Portas externas possuem fechamento automático e protetor de rodapé. Janelas e aberturas são dotadas de telas milimétricas removíveis para facilitar a limpeza.', legislation: 'Item 4.1.4 da RDC 216/2004', weight: 5, isCritical: false },
          { id: 'fed-032', sectionId: 'sec-fed-05', order: 8, description: 'Dispõe de lavatório exclusivo para lavagem das mãos na área de manipulação, provido obrigatoriamente de sabonete líquido inodoro, toalha de papel não reciclado e lixeira com tampa de acionamento sem contato manual.', legislation: 'Item 4.1.14 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-033', sectionId: 'sec-fed-05', order: 9, description: 'Existem cartazes de orientação sobre a correta higienização das mãos afixados em locais de fácil visualização, inclusive nas instalações sanitárias e lavatórios.', legislation: 'Item 4.6.5 da RDC 216/2004', weight: 5, isCritical: false },
          { id: 'fed-034', sectionId: 'sec-fed-05', order: 10, description: 'Os resíduos são frequentemente coletados e estocados em local fechado e isolado da área de preparação, evitando a contaminação cruzada e atração de pragas.', legislation: 'Item 4.5.2 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-035', sectionId: 'sec-fed-05', order: 11, description: 'Manipuladores de alimentos que apresentam lesões ou sintomas de enfermidades que possam comprometer a segurança dos alimentos são afastados da atividade de manipulação.', legislation: 'Item 4.6.1 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-036', sectionId: 'sec-fed-05', order: 12, description: 'Manipuladores de alimentos apresentam-se com uniformes compatíveis à atividade, conservados e limpos, cabelos protegidos por redes ou toucas, unhas curtas e sem adornos.', legislation: 'Itens 4.6.3 e 4.6.6 da RDC 216/2004', weight: 5, isCritical: false },
          { id: 'fed-037', sectionId: 'sec-fed-05', order: 13, description: 'Equipamentos e utensílios que entram em contato com alimentos são lisos, impermeáveis, laváveis e mantidos em adequado estado de conservação.', legislation: 'Item 4.1.17 da RDC 216/2004', weight: 5, isCritical: false },
          { id: 'fed-038', sectionId: 'sec-fed-05', order: 14, description: 'Os utensílios utilizados na higienização (esponjas, escovas) são próprios para a atividade, conservados e limpos, sem utilização de materiais que retenham resíduos ou liberem fragmentos físicos (como palha de aço).', legislation: 'Item 4.1.11 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-039', sectionId: 'sec-fed-05', order: 15, description: 'Ausência de objetos em desuso ou estranhos ao ambiente na área de preparação de alimentos.', legislation: 'Item 4.1.7 da RDC 216/2004', weight: 5, isCritical: false },
          { id: 'fed-040', sectionId: 'sec-fed-05', order: 16, description: 'O fluxo de preparo e os procedimentos adotados evitam o contato direto ou indireto entre alimentos crus, semipreparados e prontos para o consumo, minimizando o risco de contaminação cruzada.', legislation: 'Item 4.8.4 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-041', sectionId: 'sec-fed-05', order: 17, description: 'Utiliza saneantes regularizados no Ministério da Saúde para a higienização de hortifrutícolas.', legislation: 'Item 4.8.2 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-042n', sectionId: 'sec-fed-05', order: 18, description: 'O descongelamento de alimentos é efetuado em condições de refrigeração à temperatura inferior a 5ºC ou em forno micro-ondas, sendo vedado o descongelamento à temperatura ambiente.', legislation: 'Item 4.8.14 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-043n', sectionId: 'sec-fed-05', order: 19, description: 'Os alimentos preparados conservados a quente são mantidos à temperatura superior a 60ºC (sessenta graus Celsius) por, no máximo, 6 (seis) horas.', legislation: 'Item 4.8.15 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-044n', sectionId: 'sec-fed-05', order: 20, description: 'A Instituição dispõe de condições para armazenamento, mantendo matérias-primas em temperatura recomendada pelo fabricante.', legislation: 'Art. 45 da RDC 502/2021; Item 4.8.1 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-045n', sectionId: 'sec-fed-05', order: 21, description: 'Matérias-primas e ingredientes que não forem utilizados em sua totalidade estão adequadamente acondicionados e identificados com data de fracionamento e novo prazo de validade após a abertura.', legislation: 'Item 4.7.4 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-046n', sectionId: 'sec-fed-05', order: 22, description: 'Alimentos armazenados em local limpo, organizado, dispostos sobre paletes, estrados ou prateleiras adequadas, distantes do piso, paredes e teto.', legislation: 'Item 4.7.5 da RDC 216/2004', weight: 5, isCritical: false },
        ],
      },

      // SEÇÃO 6 _______________________________________
      {
        id: 'sec-fed-06',
        title: 'Refeitório',
        order: 6,
        items: [
          { id: 'fed-042', sectionId: 'sec-fed-06', order: 1, description: 'Refeitório possui área mínima de 1,00 m² por usuário, acrescido de local para guarda de lanches, lavatório para higienização das mãos e luz de vigília.', legislation: 'Art. 29, Inciso VII da RDC 502/2021', weight: 5, isCritical: false },
        ],
      },

      // SEÇÃO 7  _______________________________________
      {
        id: 'sec-fed-07',
        title: 'Lavanderia',
        order: 7,
        items: [
          { id: 'fed-043', sectionId: 'sec-fed-07', order: 1, description: 'Quando houver processamento de roupas na Instituição, possui ambientes distintos para lavagem e para guarda de roupas.', legislation: 'Art. 29, Inciso IX e X, da RDC 502/2021', weight: 5, isCritical: false },
          { id: 'fed-044', sectionId: 'sec-fed-07', order: 2, description: 'As roupas de uso pessoal dos residentes estão devidamente identificadas, visando a manutenção da individualidade e humanização.', legislation: 'Art. 49 da RDC 502/2021', weight: 5, isCritical: false },
          { id: 'fed-044b', sectionId: 'sec-fed-07', order: 3, description: 'A Instituição mantém disponíveis as rotinas técnicas (POPs) do processamento de roupas de uso pessoal e coletivo, contemplando separação, processamento e guarda e troca de roupas de uso coletivo.', legislation: 'Art. 47 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-044c', sectionId: 'sec-fed-07', order: 4, description: 'A Instituição possibilita aos idosos com grau de dependência I (independentes) efetuarem o processamento de suas próprias roupas de uso pessoal.', legislation: 'Art. 48 da RDC 502/2021', weight: 2, isCritical: false },
          { id: 'fed-045', sectionId: 'sec-fed-07', order: 5, description: 'Nos casos de terceirização do serviço de lavanderia, a Instituição possui contrato formal e mantém cópia do alvará sanitário da empresa contratada.', legislation: 'Art. 14 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-046', sectionId: 'sec-fed-07', order: 6, description: 'Utiliza exclusivamente produtos saneantes devidamente regularizados na Anvisa.', legislation: 'Art. 50 da RDC 502/2021', weight: 10, isCritical: true },
        ],
      },

      // SEÇÃO 8
      {
        id: 'sec-fed-08',
        title: 'Assistência Integral ao Residente',
        order: 8,
        items: [
          { id: 'fed-048', sectionId: 'sec-fed-08', order: 1, description: 'O Responsável Técnico institui e mantém prontuário individual do residente, organizado e atualizado, contendo dados de identificação, evolução e intercorrências.', legislation: 'Art. 33 da RDC 502/2021; Art. 50, Inciso XV, da Lei Federal nº 10.741/2003', weight: 10, isCritical: true },
          { id: 'fed-049', sectionId: 'sec-fed-08', order: 2, description: 'Mantém o cartão de vacinação dos residentes atualizado, em conformidade com o calendário do Programa Nacional de Imunizações (PNI).', legislation: 'Art. 39 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-050', sectionId: 'sec-fed-08', order: 3, description: 'A ILPI desenvolve atividades físicas, recreativas e de lazer, com base no PAISI e nas condições dos residentes.', legislation: 'Art. 32 da RDC 502/2021', weight: 10, isCritical: false },
          { id: 'fed-051', sectionId: 'sec-fed-08', order: 4, description: 'A instituição realiza a notificação compulsória de agravos e doenças à vigilância epidemiológica e sanitária.', legislation: 'Art. 54 da RDC 502/2021; Portaria de Consolidação MS nº 4/2017', weight: 10, isCritical: false },
          { id: 'fed-052', sectionId: 'sec-fed-08', order: 5, description: 'Possui registro e realiza a notificação à autoridade sanitária local da ocorrência de eventos sentinela (ex: quedas com lesões graves).', legislation: 'Art. 55 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-053', sectionId: 'sec-fed-08', order: 6, description: 'Garante a convivência familiar e comunitária, assegurando horários e dias flexíveis para visitas.', legislation: 'Art. 6º, Inciso I, da RDC 502/2021; Art. 49, Inciso II, da Lei Federal nº 10.741/2003', weight: 10, isCritical: false },
          { id: 'fed-054', sectionId: 'sec-fed-08', order: 7, description: 'Em caso de intercorrência médica, o Responsável Técnico providencia o encaminhamento imediato do idoso ao serviço de saúde de referência.', legislation: 'Art. 42 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-054a', sectionId: 'sec-fed-08', order: 8, description: 'A instituição comunica à Secretaria Municipal de Assistência Social ou congênere, bem como ao Ministério Público, a situação de abandono familiar do idoso ou a ausência de identificação civil.', legislation: 'Art. 34 da RDC 502/2021', weight: 10, isCritical: false },
          { id: 'fed-054b', sectionId: 'sec-fed-08', order: 9, description: 'A instituição elabora a cada 2 (dois) anos e avalia anualmente o Plano de Atenção Integral à Saúde dos Residentes (PAISI) para cada idoso.', legislation: 'Arts. 36 e 38 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-054c', sectionId: 'sec-fed-08', order: 10, description: 'Possui arquivo de anotações (livro de ocorrências/plantão) contendo data e circunstâncias do atendimento diário e intercorrências de cada residente.', legislation: 'Art. 50, Inciso XV da Lei 10.741/2003; Art. 33 da RDC 502/2021', weight: 10, isCritical: true },
          // REF-05: existia só no banco. O PIA não vem da RDC 502/2021 — ela exige o PAISI
          // (Art. 36) e o registro individual (Art. 33). A âncora do PIA é a assistência social,
          // e a citação já estava correta no banco.
          { id: 'fed-054d', sectionId: 'sec-fed-08', order: 11, description: 'A instituição elabora e mantém atualizado o Plano Individual de Atendimento (PIA) de cada residente, contemplando avaliação multidimensional (saúde, funcional e social), objetivos, ações de cuidado e responsáveis.', legislation: 'Resolução CNAS nº 109/2009 (Tipificação); Art. 50 da Lei 10.741/2003 (Estatuto da Pessoa Idosa)', weight: 10, isCritical: true },
        ],
      },

      // SEÇÃO 9
      {
        id: 'sec-fed-09',
        title: 'Saúde e Segurança do Trabalhador',
        order: 9,
        items: [
          { id: 'fed-058a', sectionId: 'sec-fed-09', order: 1, description: 'A instituição garante aos trabalhadores a avaliação de saúde admissional, periódica e demissional, implementando o PCMSO e PGR.', legislation: 'NR-7; NR-1', weight: 5, isCritical: false },
          { id: 'fed-058b', sectionId: 'sec-fed-09', order: 2, description: 'A instituição fornece aos trabalhadores os Equipamentos de Proteção Individual (EPI), adequados aos riscos das atividades desenvolvidas.', legislation: 'NR-6; NR-32', weight: 10, isCritical: true },
          { id: 'fed-058c', sectionId: 'sec-fed-09', order: 3, description: 'Existe comprovação do esquema de vacinação atualizado dos profissionais da instituição.', legislation: 'NR-32', weight: 5, isCritical: false },
          { id: 'fed-058d', sectionId: 'sec-fed-09', order: 4, description: 'A instituição dispõe de instalações sanitárias, vestiários e locais para refeições exclusivos para os trabalhadores.', legislation: 'NR-24', weight: 5, isCritical: false },
          // REF-05: dois itens que existiam só no banco.
          // O primeiro reproduz as áreas do Art. 29 XIII a/b literalmente.
          { id: 'fed-058e', sectionId: 'sec-fed-09', order: 5, description: 'Dispõe de vestiário e banheiro para funcionários, separados por sexo: banheiro com área mínima de 3,6 m² (1 bacia, 1 lavatório e 1 chuveiro para cada 10 funcionários ou fração) e vestiário com área mínima de 0,5 m² por funcionário/turno.', legislation: 'Art. 29, Inciso XIII da RDC 502/2021', weight: 10, isCritical: false },
          // O descanso da equipe de enfermagem não está na RDC 502/2021: vem da Lei Federal
          // nº 14.602/2023, que alterou a Lei do Exercício da Enfermagem. Por ser federal, o item
          // pertence a esta base e não ao suplemento regional.
          { id: 'fed-058f', sectionId: 'sec-fed-09', order: 6, description: 'Dispõe de local/sala de descanso para a equipe de enfermagem durante a jornada de trabalho, com mobiliário adequado (conforto térmico e acústico), instalações sanitárias e ventilação compatíveis com o número de profissionais, observada a inviolabilidade do repouso.', legislation: 'Lei Federal nº 14.602/2023', weight: 5, isCritical: false },
        ],
      },

      // SEÇÃO 10
      {
        id: 'sec-fed-10',
        title: 'Gestão de Resíduos (PGRSS)',
        order: 10,
        items: [
          { id: 'fed-059', sectionId: 'sec-fed-10', order: 1, description: 'O serviço elaborou, implantou e mantém atualizado o Plano de Gerenciamento de Resíduos de Serviços de Saúde (PGRSS).', legislation: 'Art. 5º da RDC 222/2018', weight: 10, isCritical: false },
          { id: 'fed-060', sectionId: 'sec-fed-10', order: 2, description: 'Possui abrigo de resíduos sólidos externo à edificação para armazenamento temporário.', legislation: 'Art. 29, Inciso XIV, da RDC 502/2021; RDC 222/2018', weight: 10, isCritical: false },
          { id: 'fed-061', sectionId: 'sec-fed-10', order: 3, description: 'Os materiais perfurocortantes são descartados no local de geração em recipientes rígidos, providos de tampa.', legislation: 'RDC 222/2018', weight: 10, isCritical: true },
          { id: 'fed-062', sectionId: 'sec-fed-10', order: 4, description: 'Os recipientes para coleta interna de resíduos possuem tampa provida de sistema de abertura sem contato manual e são identificados.', legislation: 'RDC 222/2018', weight: 5, isCritical: false },
          { id: 'fed-063', sectionId: 'sec-fed-10', order: 5, description: 'A instituição possui contrato formal com empresa licenciada para coleta, tratamento e destinação final de resíduos infectantes e perfurocortantes.', legislation: 'RDC 222/2018', weight: 10, isCritical: false },
        ],
      },

      // SEÇÃO 11
      {
        id: 'sec-fed-11',
        title: 'Água e Controle de Pragas',
        order: 11,
        items: [
          { id: 'fed-064', sectionId: 'sec-fed-11', order: 1, description: 'A instituição utiliza água potável para consumo e preparo de alimentos, e o reservatório de água é higienizado no mínimo a cada 6 (seis) meses, mantendo-se o registro da operação.', legislation: 'Art. 46 da RDC 502/2021; Item 4.3 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-065', sectionId: 'sec-fed-11', order: 2, description: 'Possui programa de controle de vetores e pragas urbanas executado por empresa especializada e licenciada.', legislation: 'Art. 46 da RDC 502/2021; Item 4.4.2 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-066', sectionId: 'sec-fed-11', order: 3, description: 'A edificação, as instalações e os equipamentos são mantidos livres de vetores e pragas urbanas, sendo adotadas medidas preventivas como o uso de telas e ralos sifonados.', legislation: 'Item 4.4.1 da RDC 216/2004', weight: 5, isCritical: false },
        ],
      },

      // SEÇÃO 12
      {
        id: 'sec-fed-12',
        title: 'Recursos Humanos',
        order: 12,
        items: [
          { id: 'fed-067', sectionId: 'sec-fed-12', order: 1, description: 'A ILPI conta com Responsável Técnico (RT) com formação de nível superior, vínculo formal de trabalho e carga horária mínima de 20 (vinte) horas semanais.', legislation: 'Arts. 10 e 11 e 16 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-068', sectionId: 'sec-fed-12', order: 2, description: 'A proporção de cuidadores para residentes de Grau de Dependência I atende ao mínimo exigido: 1 (um) cuidador para cada 20 (vinte) residentes, com carga horária de 8h/dia.', legislation: 'Alínea "a", Inciso II do Art. 16 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-069', sectionId: 'sec-fed-12', order: 3, description: 'A proporção de cuidadores para residentes de Grau de Dependência II atende ao mínimo exigido: 1 (um) cuidador para cada 10 (dez) residentes, por turno.', legislation: 'Alínea "b", Inciso II do Art. 16 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-070', sectionId: 'sec-fed-12', order: 4, description: 'A proporção de cuidadores para residentes de Grau de Dependência III atende ao mínimo exigido: 1 (um) cuidador para cada 6 (seis) residentes, por turno.', legislation: 'Alínea "c", Inciso II do Art. 16 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-071', sectionId: 'sec-fed-12', order: 5, description: 'A instituição dispõe de 1 (um) profissional para atividades de lazer para cada 40 (quarenta) residentes, com carga horária de 12 (doze) horas semanais.', legislation: 'Inciso III do Art. 16 da RDC 502/2021', weight: 5, isCritical: false },
          { id: 'fed-072', sectionId: 'sec-fed-12', order: 6, description: 'A instituição dispõe de 1 (um) profissional de limpeza para cada 100m² (cem metros quadrados) de área interna ou fração, por turno, diariamente.', legislation: 'Inciso IV do Art. 16 da RDC 502/2021', weight: 5, isCritical: false },
          { id: 'fed-072b', sectionId: 'sec-fed-12', order: 7, description: 'Quando o serviço de lavanderia for realizado internamente, a instituição dispõe de 1 (um) profissional para cada 30 (trinta) residentes ou fração, diariamente.', legislation: 'Inciso VI do Art. 16 da RDC 502/2021', weight: 2, isCritical: false },
          { id: 'fed-073', sectionId: 'sec-fed-12', order: 8, description: 'A instituição dispõe de 1 (um) profissional no serviço de alimentação para cada 20 (vinte) residentes, garantindo a cobertura de 2 (dois) turnos de 8 (oito) horas.', legislation: 'Inciso V do Art. 16 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-074', sectionId: 'sec-fed-12', order: 9, description: 'A ILPI garante a capacitação e a educação permanente dos profissionais envolvidos na prestação dos serviços, mantendo registros dessa capacitação.', legislation: 'Art. 18 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-075a', sectionId: 'sec-fed-12', order: 10, description: 'Apresenta contratos que comprovem o vínculo formal de trabalho de todos os recursos humanos atuantes na instituição.', legislation: 'Art. 16 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-076a', sectionId: 'sec-fed-12', order: 11, description: 'Apresenta escala de trabalho atualizada comprovando o quantitativo mínimo de cuidadores por turno exigido para o Grau I (1:20), Grau II (1:10) e Grau III (1:6).', legislation: 'Art. 16 da RDC 502/2021', weight: 10, isCritical: true },
        ],
      },

      // SEÇÃO 13
      {
        id: 'sec-fed-13',
        title: 'Documentação Administrativa',
        order: 13,
        items: [
          { id: 'fed-075', sectionId: 'sec-fed-13', order: 1, description: 'Possui Estatuto ou Contrato Social e ata de eleição da diretoria atual (quando aplicável).', legislation: 'Incisos I e II do Art. 9º da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-076', sectionId: 'sec-fed-13', order: 2, description: 'Possui Regimento Interno.', legislation: 'Inciso III do Art. 9º da RDC 502/2021', weight: 5, isCritical: false },
          { id: 'fed-077', sectionId: 'sec-fed-13', order: 3, description: 'A instituição de longa permanência possui inscrição e registro de seus programas junto ao Conselho Municipal da Pessoa Idosa (CMDI) ou Estadual (CEDI).', legislation: 'Art. 48 da Lei 10.741/2003', weight: 10, isCritical: true },
          { id: 'fed-078', sectionId: 'sec-fed-13', order: 4, description: 'A ILPI celebra contrato formal e escrito de prestação de serviços com o residente ou com seu representante legal, estabelecendo direitos, deveres, valores e forma de reajuste.', legislation: 'Art. 12 da RDC 502/2021; Art. 35 da Lei 10.741/2003', weight: 10, isCritical: true },
          { id: 'fed-079', sectionId: 'sec-fed-13', order: 5, description: 'A ILPI possui Procedimentos Operacionais Padrão (POP) escritos, atualizados e implantados referentes a todas as atividades desenvolvidas na instituição.', legislation: 'Art. 41 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-080', sectionId: 'sec-fed-13', order: 6, description: 'A instituição possui Plano de Trabalho compatível com os princípios do Estatuto da Pessoa Idosa, apresentado no ato de inscrição no conselho competente.', legislation: 'Parágrafo único do Art. 48 da Lei 10.741/2003', weight: 10, isCritical: true },
          { id: 'fed-081', sectionId: 'sec-fed-13', order: 7, description: 'A instituição realiza avaliação continuada de desempenho levando em conta, no mínimo, os indicadores de taxa de mortalidade, e incidência de DDA, escabiose, desidratação, úlcera de decúbito e desnutrição.', legislation: 'Art. 59 e Anexo da RDC 502/2021', weight: 10, isCritical: false },
          { id: 'fed-082', sectionId: 'sec-fed-13', order: 8, description: 'A Instituição encaminha à Vigilância Sanitária local, todo mês de janeiro, o consolidado dos indicadores referentes ao ano anterior.', legislation: 'Art. 60 da RDC 502/2021', weight: 10, isCritical: false },
        ],
      },
    ],
  },
  // Roteiro avulso de Goiás aposentado (17/08/2026): substituído pelo caminho
  // oficial "Base Federal + Suplemento GO" (supplementRegistry). Ver
  // [[roteiro-ilpi-go-cobertura-legal-completa]].
  ...alimentosTemplates,
];

export function getTemplates(): ChecklistTemplate[] {
  return templates;
}

export function getTemplatesByCategory(category: string): ChecklistTemplate[] {
  return templates.filter((t: ChecklistTemplate) => t.category === category);
}

export function getTemplateById(id: string): ChecklistTemplate | undefined {
  let mappedId = id;
  if (id === 'tpl-estetica-v1' || id === 'tpl-estetica' || id === 'tpl-estetica-federal') mappedId = 'tpl-estetica-clinica-v1';
  if (id === 'tpl-ilpi-federal') mappedId = 'tpl-ilpi-federal-v1';
  if (id === 'tpl-ilpi-bh' || id === 'tpl-ilpi-belo-horizonte') mappedId = 'tpl-ilpi-federal-v1';
  if (id === 'tpl-alimentos-federal' || id === 'tpl-alimentos') mappedId = 'tpl-alimentos-federal-v1';
  if (id === 'tpl-alimentos-rj') mappedId = 'tpl-alimentos-rj-v1';
  if (id === 'tpl-ilpi-go' || id === 'tpl-ilpi-goias') mappedId = 'tpl-ilpi-go-v1';

  return templates.find((t: ChecklistTemplate) => t.id === mappedId);
}

/**
 * Filter sections based on consultant role (Saúde / Nutrição)
 * This is used for the execution UI, while Summary/PDF uses full=true
 */
function filterSectionsByRole(sections: Section[], role: string, full: boolean): Section[] {
  if (full || !role || role === 'ambos') return sections;
  return filterSectionsByRoleForDisplay(sections, role);
}

/**
 * COND-03 · Filtro de exibição por papel — **puro, sem compor roteiro**.
 *
 * Decisão da Ester (contrato § 6.6): existe UMA árvore por inspeção, a completa.
 * O papel não monta uma segunda árvore — ele apenas esconde seções na exibição,
 * e a consultora sempre pode pedir "ver tudo". Nota, snapshot, resumo e PDF usam
 * SEMPRE a árvore completa; só a lista que a consultora percorre é recortada.
 *
 * Recebe as seções já compostas (canônicas) e devolve o subconjunto do papel.
 * `ambos`/vazio devolve tudo. Roteiro sem seção de nutrição devolve tudo.
 */
export function filterSectionsByRoleForDisplay(sections: Section[], role: string): Section[] {
  if (!role || role === 'ambos') return sections;

  // Identify sections that belong to Nutrition - by ID (static templates) OR by title keywords (remote templates)
  const nutritionSectionIds = ['sec-fed-05', 'sec-fed-06'];
  const nutritionKeywords = ['nutri', 'aliment', 'dieta', 'cardápio', 'refei'];

  const isNutritionSection = (s: Section): boolean => {
    if (nutritionSectionIds.includes(s.id)) return true;
    const titleLower = (s.title || '').toLowerCase();
    return nutritionKeywords.some(kw => titleLower.includes(kw));
  };

  const templateHasNutrition = sections.some(isNutritionSection);

  // If no nutrition sections found in this template, show everything (e.g. Estética)
  if (!templateHasNutrition) return sections;

  return sections.filter((section) => {
    const isNutrition = isNutritionSection(section);

    if (role === 'nutricao') return isNutrition;
    if (role === 'saude') return !isNutrition;

    return true;
  });
}

function normalizeSectionTitle(title: string): string {
  return (title || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

/**
 * Descrição normalizada de cada item dos roteiros empacotados, por id.
 *
 * `replacesItemId` aponta para o id do roteiro estático (`est-001`), mas a
 * execução carrega o roteiro do **banco**, onde o mesmo requisito tem id UUID.
 * Comparar só por id não removia nada e o item federal ficava lado a lado com o
 * item local: o roteiro de SP abria com 130 itens em vez de 122, e a seção
 * "Documentação e Regularização" com 24 em vez de 19.
 */
let textoDoItemEstatico: Map<string, string> | null = null;

function descricaoDoItemEstatico(itemId: string): string | undefined {
  if (!textoDoItemEstatico) {
    textoDoItemEstatico = new Map();
    for (const template of templates) {
      for (const section of template.sections) {
        for (const item of section.items) {
          textoDoItemEstatico.set(item.id, normalizeRequirementText(item.description));
        }
      }
    }
  }
  return textoDoItemEstatico.get(itemId);
}

function applySupplement(effective: ChecklistTemplate, supplement: ChecklistSupplement): void {
  // Índice do roteiro efetivo ANTES de qualquer remoção — só é consultado para
  // achar item federal, e `buildRequirementIndex` já descarta descrição repetida,
  // então nunca se remove no escuro.
  const idPorTexto = buildRequirementIndex(effective);

  supplement.sectionAdditions.forEach((addition) => {
    // Casa por id (roteiro estático) OU por título (roteiros do banco usam id UUID,
    // então 'sec-fed-12' nunca bate; o título "Recursos Humanos" sim).
    const targetSection =
      effective.sections.find((s) => s.id === addition.targetSectionId)
      || (addition.targetSectionTitle
        ? effective.sections.find((s) => normalizeSectionTitle(s.title) === normalizeSectionTitle(addition.targetSectionTitle))
        : undefined);
    if (targetSection) {
      // Suplemento local mais restritivo: o item local substitui o item federal
      // apontado (removido de onde estiver), em vez de somar os dois.
      addition.items.forEach((newItem) => {
        if (newItem.replacesItemId) {
          const texto = descricaoDoItemEstatico(newItem.replacesItemId);
          const equivalente = texto ? idPorTexto.get(texto) : undefined;
          effective.sections.forEach((section) => {
            section.items = section.items.filter(
              (i) => i.id !== newItem.replacesItemId && i.id !== equivalente
            );
          });
        }
      });

      const existingIds = new Set(targetSection.items.map((i) => i.id));
      addition.items.forEach((newItem) => {
        if (!existingIds.has(newItem.id)) {
          targetSection.items.push(newItem);
          existingIds.add(newItem.id);
        }
      });
      targetSection.items.sort((a, b) => a.order - b.order);
    }
  });

  if (supplement.newSections) {
    supplement.newSections.forEach((newSec) => {
      if (!effective.sections.find((s) => s.id === newSec.id)) {
        effective.sections.push(newSec);
      }
    });
  }
}

/**
 * Ordem operacional para percorrer um serviço de alimentação sem voltar de setor.
 * Usa títulos porque os roteiros carregados do Supabase têm UUIDs diferentes dos
 * arquivos empacotados, mas preservam os nomes das seções.
 */
function foodInspectionFlowRank(section: Section): number {
  const title = normalizeSectionTitle(section.title);
  const rankByMatch: Array<[RegExp, number]> = [
    [/regularizacao|licenciamento/, 0],
    [/edificacao|instalacoes/, 10],
    [/recepcao|materias-primas/, 20],
    [/rotulagem.*pos-preparo/, 60],
    [/armazenamento/, 30],
    [/mercado|hortifruti/, 35],
    [/equipamentos|moveis|utensilios/, 40],
    [/producao|preparo/, 50],
    [/acougue|peixaria|pescado|japones|culinaria oriental|padaria|confeitaria|industria artesanal/, 55],
    [/exposicao|sorveteria|lanchonete|cafe|buffet|catering/, 70],
    [/transporte|delivery|dark kitchen/, 80],
    [/higienizacao/, 90],
    [/manipuladores/, 100],
    [/documentacao|registros|responsabilidade tecnica/, 110],
  ];

  const match = rankByMatch.find(([pattern]) => pattern.test(title));
  return match ? match[1] : 500 + section.order;
}


/**
 * Main function to get the final template for a specific context.
 * - Handles Regional Supplements (GO, etc.)
 * - Handles Role Filtering (Saúde/Nutrição)
 * - 'full' flag: true for Reports/PDF, false for Execution UI
 */
export function getEffectiveTemplate(
  baseTemplate: ChecklistTemplate,
  client: Client,
  role?: string,
  full: boolean = false,
  // Decisão 21 (FE-17b): item aposentado some das PRÓXIMAS inspeções, mas uma inspeção já em
  // andamento continua vendo o item se ele foi aposentado DEPOIS que ela começou — por isso o
  // corte é a data de início da inspeção (pass a `createdAt` dela), não "agora". `undefined`
  // desliga o filtro (usado por relatório concluído, que nunca deve perder item aposentado).
  filterRetiredAsOf?: Date
): ChecklistTemplate {
  // A base de alimentos é curada e versionada no código. O Supabase fornece a
  // identidade selecionável (UUID), mas não pode reintroduzir o conteúdo legado
  // quando ainda estiver com a carga anterior no cache ou no banco.
  const compositionBase = baseTemplate.category === 'alimentos' && isAlimentosFederalTemplate(baseTemplate)
    ? (alimentosTemplates.find(template => template.id === 'tpl-alimentos-federal-v1') || baseTemplate)
    : baseTemplate;

  // 1. Initial Deep Copy — o roteiro efetivo é montado destrutivamente daqui para baixo
  // (suplemento, filtro de papel, itens aposentados), então nunca pode ser o base.
  const effective: ChecklistTemplate = JSON.parse(JSON.stringify(compositionBase));
  effective.id = baseTemplate.id;
  effective.name = baseTemplate.name;

  // 1.5. Apply Alimentos Segments
  if (baseTemplate.category === 'alimentos') {
    const extra = getExtraSections(client.foodTypes || [], client.state);
    if (extra.length > 0) {
      effective.sections = [...effective.sections, ...extra];
    }
  }

  // 2. Apply Regional Supplements — registry-driven (ver src/data/supplementRegistry.ts)
  supplementRegistry.forEach(entry => {
    if (entry.appliesTo(baseTemplate, client)) {
      applySupplement(effective, entry.supplement);
      effective.name = `${baseTemplate.name}${entry.nameSuffix}`;
    }
  });

  // 3. Apply Food Segment Filtering (Alimentos)
  if (baseTemplate.category === 'alimentos') {
    const foodTypes = client.foodTypes || [];
    effective.sections = effective.sections.filter((section) => {
      if (!section.applicableFoodTypes || section.applicableFoodTypes.length === 0) return true;
      return section.applicableFoodTypes.some((t) => foodTypes.includes(t));
    });
  }

  // 4. Apply Multi-professional Filtering (ILPI)
  effective.sections = filterSectionsByRole(effective.sections, role || '', full);

  // 4.5. Remove itens aposentados antes do corte (decisão 21) — grandfather de quem já estava
  // em andamento quando o item foi aposentado.
  if (filterRetiredAsOf) {
    effective.sections = effective.sections.map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.retiredAt || new Date(item.retiredAt) > filterRetiredAsOf),
    }));
  }

  // 5. Final Sorting — alimentos seguem o percurso físico da fiscalização.
  effective.sections.sort((a, b) => {
    if (baseTemplate.category === 'alimentos') {
      const flow = foodInspectionFlowRank(a) - foodInspectionFlowRank(b);
      if (flow !== 0) return flow;
    }
    return a.order - b.order;
  });

  return effective;
}

/**
 * Keeps the old enrichTemplate for backward compatibility if needed,
 * but routes to the new getEffectiveTemplate.
 */
export function enrichTemplate(template: ChecklistTemplate, client: Client): ChecklistTemplate {
  return getEffectiveTemplate(template, client, undefined, true);
}

/**
 * COND-03 · A composição canônica única.
 *
 * Uma inspeção tem UMA árvore: a completa (todas as áreas, sem filtro de papel),
 * na ordem testada `base → seções extras → suplemento regional → filtro de
 * alimento → corte de aposentados → ordenação`. É esta a representação que se
 * congela na criação da inspeção e que nota, snapshot, resumo e PDF consomem —
 * o motor de aplicabilidade (COND-02+) tem, assim, uma superfície só para ler.
 *
 * O papel deixa de compor: vira filtro de exibição (`filterSectionsByRoleForDisplay`).
 *
 * `retiredAsOf` fixa o corte de itens aposentados no momento passado (início da
 * inspeção). Congelado, o corte nunca mais muda — é o que unifica execução e
 * relatório, que hoje divergem (mapa, achado A9).
 */
export function composeCanonicalTemplate(
  baseTemplate: ChecklistTemplate,
  client: Client,
  retiredAsOf?: Date,
): ChecklistTemplate {
  return getEffectiveTemplate(baseTemplate, client, undefined, true, retiredAsOf);
}

export function getTotalItems(template: ChecklistTemplate): number {
  return template.sections.reduce((sum, s) => sum + s.items.length, 0);
}

export function getCriticalItemsCount(template: ChecklistTemplate): number {
  return template.sections.reduce(
    (sum, s) => sum + s.items.filter((i) => i.isCritical).length, 0
  );
}


