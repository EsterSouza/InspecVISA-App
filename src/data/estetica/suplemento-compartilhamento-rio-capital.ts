// Compartilhamento de espaço no MUNICÍPIO do Rio de Janeiro.
//
// A seção "Compartilhamento de Espaço" do roteiro-base é neutra de propósito: o
// licenciamento é municipal e cada cidade resolve sublocação de um jeito. O
// município do Rio resolveu, e com detalhe — o Decreto Rio nº 57.501/2026 cria um
// regime inteiro para mais de uma atividade econômica na mesma instalação. Este
// suplemento troca a pergunta genérica pela regra concreta e acrescenta as duas
// situações que só existem aqui.
//
// Alcance: MUNICÍPIO do Rio de Janeiro, e não o estado. O `suplemento-rj.ts`
// já arrasta um alcance velho — cita este mesmo decreto valendo para o interior
// do estado, o que nunca foi verdade (ver o comentário no `supplementRegistry`).
// Este arquivo nasce com o alcance certo em vez de repetir aquele.
import type { ChecklistSupplement } from '../../types';

export const suplementoCompartilhamentoRioCapital: ChecklistSupplement = {
  id: 'sup-compartilhamento-rio-capital-v1',
  name: 'Suplemento de Compartilhamento de Espaço — Município do Rio de Janeiro',
  baseTemplateId: 'tpl-estetica-clinica-v1',
  state: 'RJ',
  municipality: 'Rio de Janeiro',
  version: '09/2026',
  sectionAdditions: [
    {
      targetSectionId: 'sec-est-13',
      targetSectionTitle: 'Compartilhamento de Espaço',
      items: [
        {
          id: 'cw-rio-001',
          sectionId: 'sec-est-13',
          order: 2,
          description: 'Quando há sublocação ou cessão de espaço e equipamentos para a mesma atividade profissional, o arranjo segue uma das duas vias do decreto: outorga de uso junto ao IVISA-RIO, ou licenciamento próprio do ocupante?',
          legislation: 'Decreto Rio nº 57.501/2026, art. 8º',
          guidance:
            'Decreto Rio nº 57.501/2026, art. 8º. O autônomo ou profissional liberal que responde pelo '
            + 'local, já licenciado, e que subloca ou cede espaços e equipamentos a terceiros para a MESMA '
            + 'atividade profissional, tem duas vias, e só duas. Inciso I, com outorga de uso junto ao '
            + 'IVISA-RIO: o locatário ou cessionário fica DESOBRIGADO de requerer licenciamento, e quem cede '
            + 'passa a responder administrativamente pela atividade exercida — é o ponto que costuma passar '
            + 'despercebido de quem cede. Inciso II, sem outorga: o ocupante TEM de requerer o seu '
            + 'licenciamento. O § 1º condiciona a outorga a que as atividades do cadastro do outorgado '
            + 'estejam contempladas no cadastro do outorgante, então a via I não serve quando o ocupante faz '
            + 'algo que quem cede não tem cadastrado. O § 2º diz que a licença emitida em nome do outorgado '
            + 'vale SÓ para o endereço do outorgante, e o § 3º permite ao outorgante pedir a extinção da '
            + 'outorga a qualquer tempo. Perguntar qual das duas vias foi adotada, e pedir o documento: '
            + '"a gente combinou" não é nenhuma das duas.',
          requiredAction:
            '- Definir com o IVISA-RIO qual via adotar: outorga de uso, ou licenciamento próprio de cada ocupante.\n'
            + '- Na outorga, conferir antes se as atividades do ocupante estão contempladas no cadastro de quem cede.\n'
            + '- Registrar por escrito que, na outorga, quem cede responde administrativamente pela atividade do ocupante.',
          weight: 10,
          isCritical: true,
          replacesItemId: 'est-117',
        },
        {
          id: 'cw-rio-002',
          sectionId: 'sec-est-13',
          order: 8,
          description: 'A situação do profissional autônomo que atende no espaço está resolvida: dispensado de licença por prestar serviço à pessoa jurídica já licenciada, ou licenciado por estar instalado em nome próprio?',
          legislation: 'Decreto Rio nº 57.501/2026, art. 7º, §§ 2º e 3º',
          guidance:
            'Decreto Rio nº 57.501/2026, art. 7º. O caput resolve o caso geral: havendo mais de uma '
            + 'atividade econômica em funcionamento na mesma instalação, o licenciamento considera a MAIOR '
            + 'complexidade e o MAIOR risco. O § 2º dispensa de licenciamento próprio o autônomo ou '
            + 'profissional liberal que presta serviço de interesse à saúde para pessoa jurídica já '
            + 'licenciada — EXCETO quando ele também estiver instalado mediante cadastro ou alvará ativo em '
            + 'nome próprio, que é a exceção que devolve a exigência. O § 3º, I, é o outro lado: qualquer '
            + 'atividade econômica DOTADA DE AUTONOMIA instalada no interior de local de interesse da '
            + 'vigilância depende de licenciamento específico, ressalvadas as unidades hospitalares '
            + 'privadas. A pergunta prática é se o profissional trabalha PARA a pessoa jurídica ou apenas '
            + 'DENTRO dela.',
          requiredAction:
            '- Levantar, um a um, os profissionais autônomos que atendem no espaço e sob qual vínculo atuam.\n'
            + '- Para quem presta serviço à pessoa jurídica licenciada, registrar o vínculo e conferir que não há alvará ativo em nome próprio no endereço.\n'
            + '- Para quem atua com autonomia, requerer o licenciamento específico junto ao IVISA-RIO.',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'cw-rio-003',
          sectionId: 'sec-est-13',
          order: 9,
          description: 'Quando a instalação é reconhecida como coworking, business center ou congênere, o licenciamento está em nome de pessoa jurídica e abrange a totalidade das operações que ocorrem no local?',
          legislation: 'Decreto Rio nº 57.501/2026, art. 9º, § 8º',
          guidance:
            'Decreto Rio nº 57.501/2026, art. 9º, § 8º: o licenciamento de instalação reconhecida como '
            + 'dark kitchen, business center, COWORKING e congêneres é concedido exclusivamente a PESSOAS '
            + 'JURÍDICAS e deve abranger a TOTALIDADE das operações que ocorram no local. São duas travas '
            + 'numa frase só: pessoa física não licencia coworking, e licença que cubra apenas parte das '
            + 'operações não serve. O próprio parágrafo diz que essas instalações ainda serão regulamentadas '
            + 'pelo IVISA-RIO, então confirmar lá se já saiu regulamentação antes de fechar o enquadramento '
            + '— o dispositivo vale desde já, o detalhamento é que pode ter mudado.',
          requiredAction:
            '- Confirmar no IVISA-RIO se a instalação se enquadra como coworking, business center ou congênere, e se já há regulamentação publicada.\n'
            + '- Requerer o licenciamento em nome de pessoa jurídica, nunca de pessoa física.\n'
            + '- Conferir que o licenciamento abrange todas as operações que ocorrem no local, e não apenas as do titular.',
          weight: 10,
          isCritical: true,
        },
      ],
    },
  ],
};
