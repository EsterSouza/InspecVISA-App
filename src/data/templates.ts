import type { ChecklistTemplate, Client } from '../types';
import { templateIlpiGoiasSuplement } from './templates-ilpi-goias-supplement';

export const templates: ChecklistTemplate[] = [
  {
    id: 'tpl-federal-v1',
    name: 'Roteiro de Inspeção Federal (Alimentos)',
    category: 'alimentos',
    version: '1.0.0',
    sections: [
      {
        id: 'sec-fed-01',
        title: 'Documentação e Registro',
        order: 1,
        items: [
          { id: 'fed-001', sectionId: 'sec-fed-01', order: 1, description: 'Possui Alvará de Funcionamento e Sanitário atualizado e em local visível.', legislation: 'Legislação Municipal; RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-002', sectionId: 'sec-fed-01', order: 2, description: 'Possui Manual de Boas Práticas e POPs (Procedimentos Operacionais Padronizados) implementados.', legislation: 'Item 4.11 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-003', sectionId: 'sec-fed-01', order: 3, description: 'Os manipuladores possuem registros de capacitação e asseio pessoal.', legislation: 'Item 4.6 da RDC 216/2004', weight: 5, isCritical: false },
        ],
      },
      // ... Outras seções do roteiro federal de alimentos (abreviado para foco no ILPI)
    ],
  },
  {
    id: 'tpl-ilpi-federal-v1',
    name: 'Roteiro ILPI Federal (RDC 502/2021)',
    category: 'ilpi',
    version: '1.0.0',
    sections: [
      // SEÇÃO 1 _______________________________________
      {
        id: 'sec-ilpi-01',
        title: 'Condições Organizacionais e Documentação',
        order: 1,
        items: [
          { id: 'ilpi-001', sectionId: 'sec-ilpi-01', order: 1, description: 'Possui Alvará de localização e funcionamento atualizado.', legislation: 'Art. 8º da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-002', sectionId: 'sec-ilpi-01', order: 2, description: 'Possui licença sanitária atualizada e afixada em local visível.', legislation: 'Art. 8º da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-003', sectionId: 'sec-ilpi-01', order: 3, description: 'Inscrição do programa junto ao Conselho Municipal da Pessoa Idosa (CMDI) ou, na falta deste, ao Conselho Municipal de Assistência Social.', legislation: 'Art. 48 da Lei n.º 10.741/2003 (Estatuto da Pessoa Idosa)', weight: 10, isCritical: true },
          { id: 'ilpi-004', sectionId: 'sec-ilpi-01', order: 4, description: 'Inscrição no Conselho Municipal ou Estadual de Assistência Social (CMAS/CEAS).', legislation: 'Lei n.º 12.101/2009', weight: 5, isCritical: false },
          { id: 'ilpi-005', sectionId: 'sec-ilpi-01', order: 5, description: 'Possui Regimento Interno atualizado e aprovado pelo órgão competente.', legislation: 'Inciso III do Art. 9º da RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-006', sectionId: 'sec-ilpi-01', order: 6, description: 'Mantém exposto, em local visível, o quadro de equipe técnica e de profissionais.', legislation: 'Art. 13 da RDC 502/2021', weight: 2, isCritical: false },
        ],
      },

      // SEÇÃO 2  _______________________________________
      {
        id: 'sec-ilpi-02',
        title: 'Áreas de Dormitórios',
        order: 2,
        items: [
          { id: 'ilpi-007', sectionId: 'sec-ilpi-02', order: 1, description: 'Os dormitórios são separados por sexo, com no máximo 4 (quatro) camas por dormitório.', legislation: 'Art. 29, Inciso I da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-008', sectionId: 'sec-ilpi-02', order: 2, description: 'Área mínima de 5,50 m² por cama em dormitórios individuais.', legislation: 'Alínea "a", Inciso II do Art. 29 da RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-009', sectionId: 'sec-ilpi-02', order: 3, description: 'Área mínima de 4,50 m² por cama em dormitórios coletivos.', legislation: 'Alínea "b", Inciso II do Art. 29 da RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-010', sectionId: 'sec-ilpi-02', order: 4, description: 'Distância mínima de 0,80 m entre as camas e 1,10 m na cabeceira, para permitir a circulação.', legislation: 'Alínea "c", Inciso II do Art. 29 da RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-011', sectionId: 'sec-ilpi-02', order: 5, description: 'Possui campainha de chamada próxima ao leito, ligada diretamente ao posto de enfermagem ou local de permanência dos cuidadores.', legislation: 'Inciso III do Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-012', sectionId: 'sec-ilpi-02', order: 6, description: 'Mobiliário individual (armário, criado-mudo) em bom estado de conservação.', legislation: 'Alínea "d", Inciso I do Art. 29 da RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-013', sectionId: 'sec-ilpi-02', order: 7, description: 'Luz de vigília noturna instalada para segurança dos idosos.', legislation: 'Alínea "e", Inciso I do Art. 29 da RDC 502/2021', weight: 2, isCritical: false },
          { id: 'ilpi-014', sectionId: 'sec-ilpi-02', order: 8, description: 'Ventilação e iluminação natural adequadas, com telas se necessário.', legislation: 'Item 4.1.4 da RDC 216/2004; RDC 50/2002', weight: 5, isCritical: false },
          { id: 'ilpi-015', sectionId: 'sec-ilpi-02', order: 9, description: 'Piso com revestimento liso e antiderrapante, sem obstáculos que dificultem a circulação de cadeirantes e pessoas com mobilidade reduzida.', legislation: 'NBR 9050/2015; Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-016', sectionId: 'sec-ilpi-02', order: 10, description: 'Paredes e tetos limpos, sem goteiras, umidade, descascamentos ou rachaduras.', legislation: 'RDC 63/2011; RDC 216/2004', weight: 5, isCritical: false },
          { id: 'ilpi-017', sectionId: 'sec-ilpi-02', order: 11, description: 'Janelas e portas com fechamento adequado e parapeitos de segurança, quando necessário.', legislation: 'RDC 50/2002', weight: 10, isCritical: true },
        ],
      },

      // SEÇÃO 3  _______________________________________
      {
        id: 'sec-ilpi-03',
        title: 'Banheiros',
        order: 3,
        items: [
          { id: 'ilpi-018', sectionId: 'sec-ilpi-03', order: 1, description: 'Os banheiros possuem área mínima de 3,60 m².', legislation: 'Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-019', sectionId: 'sec-ilpi-03', order: 2, description: 'Cada banheiro é provido, no mínimo, de 1 bacia sanitária, 1 lavatório e 1 chuveiro, garantindo a privacidade do residente.', legislation: 'Alínea "a", Inciso IV do Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-020', sectionId: 'sec-ilpi-03', order: 3, description: 'O piso do banheiro é projetado sem desnível em forma de degrau, utilizando caimento para escoamento da água.', legislation: 'Alínea "b", Inciso IV do Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-021', sectionId: 'sec-ilpi-03', order: 4, description: 'Possui barras de apoio instaladas no lavatório, na bacia sanitária e no chuveiro.', legislation: 'Alínea "c", Inciso IV do Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
        ],
      },

      // SEÇÃO 4
      {
        id: 'sec-ilpi-04',
        title: 'Medicamentos',
        order: 4,
        items: [
          { id: 'ilpi-022', sectionId: 'sec-ilpi-04', order: 1, description: 'Os medicamentos em uso pelos idosos estão sob responsabilidade do Responsável Técnico (RT), respeitando os regulamentos de vigilância sanitária quanto à guarda, sendo vedado o estoque sem prescrição médica.', legislation: 'Art. 40 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-023', sectionId: 'sec-ilpi-04', order: 2, description: 'Medicamentos sujeitos a controle especial (psicotrópicos) são obrigatoriamente guardados sob chave ou outro dispositivo que ofereça segurança, em local exclusivo, com registros de controle.', legislation: 'Art. 67 da Portaria SVS/MS 344/1998', weight: 10, isCritical: true },
          { id: 'ilpi-024', sectionId: 'sec-ilpi-04', order: 3, description: 'Possui geladeira exclusiva com termômetro e planilha de registro para controle diário de temperatura de medicamentos termolábeis.', legislation: 'Art. 40 da RDC 502/2021; RDC ANVISA nº 430/2020', weight: 10, isCritical: true },
        ],
      },

      // SEÇÃO 5 _______________________________________
      {
        id: 'sec-ilpi-05',
        title: 'Serviço de Nutrição',
        order: 5,
        items: [
          { id: 'ilpi-025', sectionId: 'sec-ilpi-05', order: 1, description: 'É garantido aos residentes o fornecimento de, no mínimo, 6 (seis) refeições diárias.', legislation: 'Art. 44 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-026', sectionId: 'sec-ilpi-05', order: 2, description: 'A alimentação é fornecida de acordo com as necessidades nutricionais e condições de saúde dos residentes.', legislation: 'Art. 44 e Art. 45 da RDC 502/2021; RDC 216/2004', weight: 5, isCritical: false },
          { id: 'ilpi-027', sectionId: 'sec-ilpi-05', order: 3, description: 'O serviço possui e implementa o Manual de Boas Práticas e os Procedimentos Operacionais Padronizados (POPs), mantendo-os acessíveis aos funcionários envolvidos e à autoridade sanitária.', legislation: 'Itens 4.11.1 e 4.11.2 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'ilpi-028', sectionId: 'sec-ilpi-05', order: 4, description: 'Caso realize preparo de Terapia de Nutrição Enteral (TNE) no local, possui área exclusiva e adequada para esta manipulação.', legislation: 'Arts. 1º e 101 da RDC ANVISA nº 503/2021', weight: 5, isCritical: false },
          { id: 'ilpi-029', sectionId: 'sec-ilpi-05', order: 5, description: 'Instalações físicas (piso, parede e teto) possuem revestimento liso, impermeável, lavável e em bom estado de conservação.', legislation: 'Item 4.1.3 da RDC 216/2004', weight: 5, isCritical: false },
          { id: 'ilpi-030', sectionId: 'sec-ilpi-05', order: 6, description: 'Acessos às áreas de preparação de alimentos são controlados e independentes, não sendo utilizados como passagem.', legislation: 'Item 4.1.1 da RDC 216/2004', weight: 5, isCritical: false },
          { id: 'ilpi-031', sectionId: 'sec-ilpi-05', order: 7, description: 'Portas externas possuem fechamento automático e protetor de rodapé. Janelas e aberturas são dotadas de telas milimétricas removíveis para facilitar a limpeza.', legislation: 'Item 4.1.4 da RDC 216/2004', weight: 5, isCritical: false },
          { id: 'ilpi-032', sectionId: 'sec-ilpi-05', order: 8, description: 'Dispõe de lavatório exclusivo para lavagem das mãos na área de manipulação, provido obrigatoriamente de sabonete líquido inodoro, toalha de papel não reciclado e lixeira com tampa de acionamento sem contato manual.', legislation: 'Item 4.1.14 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'ilpi-033', sectionId: 'sec-ilpi-05', order: 9, description: 'Existem cartazes de orientação sobre a correta higienização das mãos afixados em locais de fácil visualização, inclusive nas instalações sanitárias e lavatórios.', legislation: 'Item 4.6.5 da RDC 216/2004', weight: 5, isCritical: false },
          { id: 'ilpi-034', sectionId: 'sec-ilpi-05', order: 10, description: 'Os resíduos são frequentemente coletados e estocados em local fechado e isolado da área de preparação, evitando a contaminação cruzada e atração de pragas.', legislation: 'Item 4.5.2 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'ilpi-035', sectionId: 'sec-ilpi-05', order: 11, description: 'Manipuladores de alimentos que apresentam lesões ou sintomas de enfermidades que possam comprometer a segurança dos alimentos são afastados da atividade de manipulação.', legislation: 'Item 4.6.1 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'ilpi-036', sectionId: 'sec-ilpi-05', order: 12, description: 'Manipuladores de alimentos apresentam-se com uniformes compatíveis à atividade, conservados e limpos, cabelos protegidos por redes ou toucas, unhas curtas e sem adornos.', legislation: 'Itens 4.6.3 e 4.6.6 da RDC 216/2004', weight: 5, isCritical: false },
          { id: 'ilpi-037', sectionId: 'sec-ilpi-05', order: 13, description: 'Equipamentos e utensílios que entram em contato com alimentos são lisos, impermeáveis, laváveis e mantidos em adequado estado de conservação.', legislation: 'Item 4.1.17 da RDC 216/2004', weight: 5, isCritical: false },
          { id: 'ilpi-038', sectionId: 'sec-ilpi-05', order: 14, description: 'Os utensílios utilizados na higienização (esponjas, escovas) são próprios para a atividade, conservados e limpos, sem utilização de materiais que retenham resíduos ou liberem fragmentos físicos (como palha de aço).', legislation: 'Item 4.1.11 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'ilpi-039', sectionId: 'sec-ilpi-05', order: 15, description: 'Ausência de objetos em desuso ou estranhos ao ambiente na área de preparação de alimentos.', legislation: 'Item 4.1.7 da RDC 216/2004', weight: 5, isCritical: false },
          { id: 'ilpi-040', sectionId: 'sec-ilpi-05', order: 16, description: 'O fluxo de preparo e os procedimentos adotados evitam o contato direto ou indireto entre alimentos crus, semipreparados e prontos para o consumo, minimizando o risco de contaminação cruzada.', legislation: 'Item 4.8.4 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'ilpi-041', sectionId: 'sec-ilpi-05', order: 17, description: 'Utiliza saneantes regularizados no Ministério da Saúde para a higienização de hortifrutícolas.', legislation: 'Item 4.8.2 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'ilpi-042n', sectionId: 'sec-ilpi-05', order: 18, description: 'O descongelamento de alimentos é efetuado em condições de refrigeração à temperatura inferior a 5ºC ou em forno micro-ondas, sendo vedado o descongelamento à temperatura ambiente.', legislation: 'Item 4.8.14 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'ilpi-043n', sectionId: 'sec-ilpi-05', order: 19, description: 'Os alimentos preparados conservados a quente são mantidos à temperatura superior a 60ºC (sessenta graus Celsius) por, no máximo, 6 (seis) horas.', legislation: 'Item 4.8.15 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'ilpi-044n', sectionId: 'sec-ilpi-05', order: 20, description: 'A Instituição dispõe de condições para armazenamento, mantendo matérias-primas em temperatura recomendada pelo fabricante.', legislation: 'Art. 45 da RDC 502/2021; Item 4.8.1 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'ilpi-045n', sectionId: 'sec-ilpi-05', order: 21, description: 'Matérias-primas e ingredientes que não forem utilizados em sua totalidade estão adequadamente acondicionados e identificados com data de fracionamento e novo prazo de validade após a abertura.', legislation: 'Item 4.7.4 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'ilpi-046n', sectionId: 'sec-ilpi-05', order: 22, description: 'Alimentos armazenados em local limpo, organizado, dispostos sobre paletes, estrados ou prateleiras adequadas, distantes do piso, paredes e teto.', legislation: 'Item 4.7.5 da RDC 216/2004', weight: 5, isCritical: false },
        ],
      },

      // SEÇÃO 6 _______________________________________
      {
        id: 'sec-ilpi-06',
        title: 'Refeitório',
        order: 6,
        items: [
          { id: 'ilpi-042', sectionId: 'sec-ilpi-06', order: 1, description: 'Refeitório possui área mínima de 1,00 m² por usuário, acrescido de local para guarda de lanches, lavatório para higienização das mãos e luz de vigília.', legislation: 'Art. 29, Inciso VII da RDC 502/2021', weight: 5, isCritical: false },
        ],
      },

      // SEÇÃO 7  _______________________________________
      {
        id: 'sec-ilpi-07',
        title: 'Lavanderia',
        order: 7,
        items: [
          { id: 'ilpi-043', sectionId: 'sec-ilpi-07', order: 1, description: 'Quando houver processamento de roupas na Instituição, possui ambientes distintos para lavagem e para guarda de roupas.', legislation: 'Art. 29, Inciso IX e X, da RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-044', sectionId: 'sec-ilpi-07', order: 2, description: 'As roupas de uso pessoal dos residentes estão devidamente identificadas, visando a manutenção da individualidade e humanização.', legislation: 'Art. 49 da RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-044b', sectionId: 'sec-ilpi-07', order: 3, description: 'A Instituição mantém disponíveis as rotinas técnicas (POPs) do processamento de roupas de uso pessoal e coletivo, contemplando separação, processamento e guarda e troca de roupas de uso coletivo.', legislation: 'Art. 47 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-044c', sectionId: 'sec-ilpi-07', order: 4, description: 'A Instituição possibilita aos idosos com grau de dependência I (independentes) efetuarem o processamento de suas próprias roupas de uso pessoal.', legislation: 'Art. 48 da RDC 502/2021', weight: 2, isCritical: false },
          { id: 'ilpi-045', sectionId: 'sec-ilpi-07', order: 5, description: 'Nos casos de terceirização do serviço de lavanderia, a Instituição possui contrato formal e mantém cópia do alvará sanitário da empresa contratada.', legislation: 'Art. 14 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-046', sectionId: 'sec-ilpi-07', order: 6, description: 'Utiliza exclusivamente produtos saneantes devidamente regularizados na Anvisa.', legislation: 'Art. 50 da RDC 502/2021', weight: 10, isCritical: true },
        ],
      },

      // SEÇÃO 8
      {
        id: 'sec-ilpi-08',
        title: 'Assistência Integral ao Residente',
        order: 8,
        items: [
          { id: 'ilpi-048', sectionId: 'sec-ilpi-08', order: 1, description: 'O Responsável Técnico institui e mantém prontuário individual do residente, organizado e atualizado, contendo dados de identificação, evolução e intercorrências.', legislation: 'Art. 33 da RDC 502/2021; Art. 50, Inciso XV, da Lei Federal nº 10.741/2003', weight: 10, isCritical: true },
          { id: 'ilpi-049', sectionId: 'sec-ilpi-08', order: 2, description: 'Mantém o cartão de vacinação dos residentes atualizado, em conformidade com o calendário do Programa Nacional de Imunizações (PNI).', legislation: 'Art. 39 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-050', sectionId: 'sec-ilpi-08', order: 3, description: 'A ILPI desenvolve atividades físicas, recreativas e de lazer, com base no PAISI e nas condições dos residentes.', legislation: 'Art. 32 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-051', sectionId: 'sec-ilpi-08', order: 4, description: 'A instituição realiza a notificação compulsória de agravos e doenças à vigilância epidemiológica e sanitária.', legislation: 'Art. 54 da RDC 502/2021; Portaria de Consolidação MS nº 4/2017', weight: 10, isCritical: true },
          { id: 'ilpi-052', sectionId: 'sec-ilpi-08', order: 5, description: 'Possui registro e realiza a notificação à autoridade sanitária local da ocorrência de eventos sentinela (ex: quedas com lesões graves).', legislation: 'Art. 55 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-053', sectionId: 'sec-ilpi-08', order: 6, description: 'Garante a convivência familiar e comunitária, assegurando horários e dias flexíveis para visitas.', legislation: 'Art. 6º, Inciso I, da RDC 502/2021; Art. 49, Inciso II, da Lei Federal nº 10.741/2003', weight: 10, isCritical: true },
          { id: 'ilpi-054', sectionId: 'sec-ilpi-08', order: 7, description: 'Em caso de intercorrência médica, o Responsável Técnico providencia o encaminhamento imediato do idoso ao serviço de saúde de referência.', legislation: 'Art. 42 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-054a', sectionId: 'sec-ilpi-08', order: 8, description: 'A instituição comunica à Secretaria Municipal de Assistência Social ou congênere, bem como ao Ministério Público, a situação de abandono familiar do idoso ou a ausência de identificação civil.', legislation: 'Art. 34 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-054b', sectionId: 'sec-ilpi-08', order: 9, description: 'A instituição elabora a cada 2 (dois) anos e avalia anualmente o Plano de Atenção Integral à Saúde dos Residentes (PAISI) para cada idoso.', legislation: 'Arts. 36 e 38 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-054c', sectionId: 'sec-ilpi-08', order: 10, description: 'Possui arquivo de anotações (livro de ocorrências/plantão) contendo data e circunstâncias do atendimento diário e intercorrências de cada residente.', legislation: 'Art. 50, Inciso XV da Lei 10.741/2003; Art. 33 da RDC 502/2021', weight: 10, isCritical: true },
        ],
      },

      // SEÇÃO 9
      {
        id: 'sec-ilpi-09',
        title: 'Manejo de Resíduos de Serviços de Saúde',
        order: 9,
        items: [
          { id: 'ilpi-055', sectionId: 'sec-ilpi-09', order: 1, description: 'A instituição possui e implementa o Plano de Gerenciamento de Resíduos de Serviços de Saúde (PGRSS).', legislation: 'Art. 5º da RDC 222/2018; Art. 53 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-056', sectionId: 'sec-ilpi-09', order: 2, description: 'Os resíduos são devidamente segregados na fonte, acondicionados em sacos e recipientes adequados, identificados e armazenados em local exclusivo até a coleta.', legislation: 'RDC 222/2018', weight: 10, isCritical: true },
          { id: 'ilpi-057', sectionId: 'sec-ilpi-09', order: 3, description: 'Possui contrato com empresa licenciada para coleta, transporte e destino final dos resíduos de saúde (Grupo A e E).', legislation: 'RDC 222/2018', weight: 10, isCritical: true },
        ],
      },

      // SEÇÃO 10
      {
        id: 'sec-ilpi-10',
        title: 'Limpeza e Sanitização',
        order: 10,
        items: [
          { id: 'ilpi-058', sectionId: 'sec-ilpi-10', order: 1, description: 'Possui e implementa cronograma e rotinas de limpeza e desinfecção de todas as áreas e mobiliários.', legislation: 'RDC 502/2021; RDC 63/2011', weight: 10, isCritical: true },
          { id: 'ilpi-059', sectionId: 'sec-ilpi-10', order: 2, description: 'O serviço dispõe de água potável para o consumo dos residentes e funcionários.', legislation: 'Art. 43 da RDC 502/2021; Portaria de Consolidação MS nº 5/2017', weight: 10, isCritical: true },
          { id: 'ilpi-060', sectionId: 'sec-ilpi-10', order: 3, description: 'Possui e implementa cronograma semestral de limpeza dos reservatórios de água, mantendo os registros de execução.', legislation: 'Portaria de Consolidação MS nº 5/2017', weight: 10, isCritical: true },
          { id: 'ilpi-061', sectionId: 'sec-ilpi-10', order: 4, description: 'As caixas d’água e demais reservatórios estão devidamente tampados e íntegros, sem frestas ou vazamentos.', legislation: 'Portaria de Consolidação MS nº 5/2017', weight: 10, isCritical: true },
          { id: 'ilpi-062', sectionId: 'sec-ilpi-10', order: 5, description: 'Dispõe de área exclusiva e adequada para o processamento de produtos para a saúde, realizando limpeza, desinfecção e esterilização conforme a necessidade.', legislation: 'RDC 15/2012', weight: 5, isCritical: false },
          { id: 'ilpi-063', sectionId: 'sec-ilpi-10', order: 6, description: 'O serviço dispõe de instalações hidrossanitárias em bom estado de conservação e funcionamento.', legislation: 'RDC 50/2002; RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-064', sectionId: 'sec-ilpi-10', order: 7, description: 'As pias e lavatórios possuem sifonagem e tampas para evitar a entrada de odores e insetos.', legislation: 'RDC 50/2002', weight: 2, isCritical: false },
          { id: 'ilpi-065', sectionId: 'sec-ilpi-10', order: 8, description: 'O sistema de drenagem de águas residuais está conectado à rede pública de esgoto ou fossa séptica devidamente licenciada.', legislation: 'Normas da concessionária local', weight: 5, isCritical: false },
        ],
      },

      // SEÇÃO 11
      {
        id: 'sec-ilpi-11',
        title: 'Controle de Vetores e Pragas Urbanas',
        order: 11,
        items: [
          { id: 'ilpi-066', sectionId: 'sec-ilpi-11', order: 1, description: 'Possui comprovante de execução de controle de vetores e pragas urbanas (dedetização/desratização) expedido por empresa licenciada, atualizado conforme cronograma.', legislation: 'RDC 222/2018; legislações municipais', weight: 10, isCritical: true },
          { id: 'ilpi-067', sectionId: 'sec-ilpi-11', order: 2, description: 'Não são observados evidências de abrigo ou infestação por pragas e vetores (insetos, roedores) no interior do serviço.', legislation: 'RDC 63/2011', weight: 10, isCritical: true },
        ],
      },

      // SEÇÃO 12
      {
        id: 'sec-ilpi-12',
        title: 'Recursos Humanos',
        order: 12,
        items: [
          { id: 'ilpi-068', sectionId: 'sec-ilpi-12', order: 1, description: 'Possui quadro de pessoal compatível com a capacidade de ocupação e o grau de dependência dos residentes.', legislation: 'Art. 10 da RDC 502/2021; Art. 3º e 4º da Lei Estadual nº 8049/2018', weight: 10, isCritical: true },
          { id: 'ilpi-069', sectionId: 'sec-ilpi-12', order: 2, description: 'RT (Responsável Técnico) possui curso superior.', legislation: 'Art. 10 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-070', sectionId: 'sec-ilpi-12', order: 3, description: 'Enfermeiro presente na equipe técnica.', legislation: 'Lei 8049/18', weight: 10, isCritical: true },
          { id: 'ilpi-071', sectionId: 'sec-ilpi-12', order: 4, description: 'Técnicos de enfermagem compõem a equipe conforme dimensionamento.', legislation: 'Lei 8049/18', weight: 10, isCritical: true },
          { id: 'ilpi-072', sectionId: 'sec-ilpi-12', order: 5, description: 'Possui termo de responsabilidade técnica perante o Conselho de Classe, quando aplicável.', legislation: 'RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-073', sectionId: 'sec-ilpi-12', order: 6, description: 'Comprovação de regularidade técnica do Enfermeiro.', legislation: 'RDC 502/2021', weight: 2, isCritical: false },
          { id: 'ilpi-074', sectionId: 'sec-ilpi-12', order: 7, description: 'Cuidadores de idosos qualificados e integrados à equipe.', legislation: 'Lei 8049/18', weight: 10, isCritical: true },
          { id: 'ilpi-075', sectionId: 'sec-ilpi-12', order: 8, description: 'Nutricionista responsável pelo planejamento das dietas e supervisão do serviço de alimentação.', legislation: 'Lei 8049/18', weight: 10, isCritical: true },
          { id: 'ilpi-076', sectionId: 'sec-ilpi-12', order: 9, description: 'Psicólogo atuando conforme necessidade do serviço.', legislation: 'Lei 8049/18', weight: 10, isCritical: true },
          { id: 'ilpi-077', sectionId: 'sec-ilpi-12', order: 10, description: 'Fisioterapeuta presente na assistência multidisciplinar.', legislation: 'Lei 8049/18', weight: 10, isCritical: true },
          { id: 'ilpi-078', sectionId: 'sec-ilpi-12', order: 11, description: 'Assistência social garantida por profissional habilitado.', legislation: 'Lei 8049/18', weight: 10, isCritical: true },
          { id: 'ilpi-079', sectionId: 'sec-ilpi-12', order: 12, description: 'Terapeuta Ocupacional atuando na estimulação cognitiva e funcional.', legislation: 'Lei 8049/18', weight: 10, isCritical: true },
          { id: 'ilpi-080', sectionId: 'sec-ilpi-12', order: 13, description: 'Os profissionais apresentam evolução em prontuário de forma multidisciplinar e integrada.', legislation: 'RDC 502/2021', weight: 10, isCritical: true },
        ],
      },

      // SEÇÃO 13
      {
        id: 'sec-ilpi-13',
        title: 'Documentação Administrativa',
        order: 13,
        items: [
          { id: 'ilpi-081', sectionId: 'sec-ilpi-13', order: 1,  description: 'O responsável técnico possui curso superior.', legislation: 'Capítulo II, Seção II, Art. 10 – RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-082', sectionId: 'sec-ilpi-13', order: 2,  description: 'Cadastro no Conselho Municipal de Assistência Social – COMDEPI.', legislation: 'Legislação Municipal', weight: 5, isCritical: false },
          { id: 'ilpi-083', sectionId: 'sec-ilpi-13', order: 3,  description: 'Alvará de Funcionamento.', legislation: 'Legislação Municipal', weight: 10, isCritical: true },
          { id: 'ilpi-084', sectionId: 'sec-ilpi-13', order: 4,  description: 'Licença Sanitária.', legislation: 'Legislação Sanitária', weight: 10, isCritical: true },
          { id: 'ilpi-085', sectionId: 'sec-ilpi-13', order: 5,  description: 'CNPJ.', legislation: 'Legislação Federal', weight: 10, isCritical: true },
          { id: 'ilpi-086', sectionId: 'sec-ilpi-13', order: 6,  description: 'Contrato Social.', legislation: 'Inciso III, Art. 48 da Lei Federal 10741/2003', weight: 10, isCritical: true },
          { id: 'ilpi-087', sectionId: 'sec-ilpi-13', order: 7,  description: 'Eventos sentinela registrados.', legislation: 'Capítulo III, Art. 55 – RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-088', sectionId: 'sec-ilpi-13', order: 8,  description: 'Processo de Enfermagem (SAE).', legislation: 'Resolução COFEN 736/2024', weight: 10, isCritical: true },
          { id: 'ilpi-089', sectionId: 'sec-ilpi-13', order: 9,  description: 'Plano Individual de Atendimento – PIA.', legislation: 'RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-090', sectionId: 'sec-ilpi-13', order: 10, description: 'Plano de Atendimento Singular – PAS.', legislation: 'RDC 29/2011', weight: 10, isCritical: true },
          { id: 'ilpi-091', sectionId: 'sec-ilpi-13', order: 11, description: 'Programa de Atenção Integral à Saúde do Idoso – PAISI.', legislation: 'RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-092', sectionId: 'sec-ilpi-13', order: 12, description: 'Dimensionamento da equipe de acordo com a Lei 8049/2018.', legislation: 'Lei 8049/2018', weight: 5, isCritical: false },
          { id: 'ilpi-093', sectionId: 'sec-ilpi-13', order: 13, description: 'Protocolo de contenção ambiental (idoso).', legislation: 'Resolução COFEN 746/2024', weight: 5, isCritical: false },
          { id: 'ilpi-094', sectionId: 'sec-ilpi-13', order: 14, description: 'Manual de Boas Práticas e POPs do serviço de Nutrição e Enfermagem.', legislation: 'RDC 63/2011', weight: 2, isCritical: false },
          { id: 'ilpi-095', sectionId: 'sec-ilpi-13', order: 15, description: 'Estatuto registrado.', legislation: 'Item 4.5.2 – RDC 283/2005; Inciso II, Art. 48º da Lei Federal 10741/2003', weight: 5, isCritical: false },
          { id: 'ilpi-096', sectionId: 'sec-ilpi-13', order: 16, description: 'Contratos de Serviços de Recursos Humanos / vínculo formal de trabalho.', legislation: 'Legislação Trabalhista', weight: 5, isCritical: false },
          { id: 'ilpi-097', sectionId: 'sec-ilpi-13', order: 17, description: 'Contratos de serviços terceirizados e cópia do Alvará Sanitário da empresa terceirizada.', legislation: 'RDC 63/2011', weight: 5, isCritical: false },
          { id: 'ilpi-098', sectionId: 'sec-ilpi-13', order: 18, description: 'Manual de Normas, Rotinas e Procedimentos.', legislation: 'RDC 63/2011', weight: 5, isCritical: false },
          { id: 'ilpi-099', sectionId: 'sec-ilpi-13', order: 19, description: 'Livro de registro de entradas e saídas atualizado.', legislation: 'RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-100', sectionId: 'sec-ilpi-13', order: 20, description: 'Livro de registro de informações sobre o idoso (grau de dependência, direitos previdenciários, alta, óbito).', legislation: 'RDC 502/2021', weight: 2, isCritical: false },
          { id: 'ilpi-101', sectionId: 'sec-ilpi-13', order: 21, description: 'Prontuários de pacientes com a devida evolução.', legislation: 'RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-102', sectionId: 'sec-ilpi-13', order: 22, description: 'Registro diário de intercorrências.', legislation: 'RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-103', sectionId: 'sec-ilpi-13', order: 23, description: 'Contrato de prestação de serviços do idoso com a instituição.', legislation: 'RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-104', sectionId: 'sec-ilpi-13', order: 24, description: 'Notificação das Doenças de Notificação Compulsória (DNC).', legislation: 'Portaria de Consolidação nº 4/2017', weight: 10, isCritical: true },
          { id: 'ilpi-105', sectionId: 'sec-ilpi-13', order: 25, description: 'Instruções para higienização das mãos em local visível.', legislation: 'RDC 36/2013', weight: 2, isCritical: false },
        ],
      },
    ],
  },
];

export function getTemplates(): ChecklistTemplate[] {
  return templates;
}

export function getTemplatesByCategory(category: string): ChecklistTemplate[] {
  return templates.filter(t => t.category === category);
}

export function getTemplateById(id: string): ChecklistTemplate | undefined {
  return templates.find(t => t.id === id);
}

export function enrichTemplate(template: ChecklistTemplate, client: Client): ChecklistTemplate {
  if (template.id === 'tpl-ilpi-federal-v1' && client.state === 'GO') {
    const supplement = templateIlpiGoiasSuplement;
    const sections = JSON.parse(JSON.stringify(template.sections));

    supplement.sectionAdditions.forEach(addition => {
      const targetSection = sections.find((s: any) => s.id === addition.targetSectionId);
      if (targetSection) {
        const existingIds = new Set(targetSection.items.map((i: any) => i.id));
        addition.items.forEach(newItem => {
          if (!existingIds.has(newItem.id)) {
            targetSection.items.push(newItem);
          }
        });
        targetSection.items.sort((a: any, b: any) => a.order - b.order);
      }
    });

    if (supplement.newSections) {
      supplement.newSections.forEach(newSec => {
        if (!sections.find((s: any) => s.id === newSec.id)) {
          sections.push(newSec);
        }
      });
    }

    return {
      ...template,
      name: `${template.name} (+ Suplemento GO)`,
      sections: sections.sort((a: any, b: any) => a.order - b.order)
    };
  }

  return template;
}

export function getTotalItems(template: ChecklistTemplate): number {
  return template.sections.reduce((sum, s) => sum + s.items.length, 0);
}

export function getCriticalItemsCount(template: ChecklistTemplate): number {
  return template.sections.reduce(
    (sum, s) => sum + s.items.filter(i => i.isCritical).length, 0
  );
}
