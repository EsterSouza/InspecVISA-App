# language: pt
Funcionalidade: Referências legislativas no relatório
  Como consultora sanitária
  Quero que o laudo cite só a norma certa, vigente e efetivamente avaliada
  Para não entregar laudo com base legal inventada ou revogada

  # REF-07: a causa de "inventado pela IA" eram fallbacks determinísticos, não IA.
  Cenário: O relatório cita só a norma efetivamente usada
    Dado um relatório com itens avaliados
    Quando gero o PDF
    Então a seção de referências marca apenas as normas citadas por item avaliado
    E as demais normas do segmento aparecem como sugestão desmarcada, não pré-marcadas

  Cenário: Autoria vem de dado curado, nunca de dedução
    Dado uma norma sem verbete na biblioteca curada
    Quando gero o PDF
    Então a norma não é citada na seção de referências
    E ela aparece no modal de geração como "sem fonte cadastrada", para virar curadoria

  Cenário: Norma revogada sai das sugestões e o PDF marca a substituta
    Dado uma norma marcada como revogada com substituta cadastrada
    Quando gero o relatório
    Então a norma revogada não aparece nas sugestões
    E o PDF aponta a norma substituta

  Cenário: Fora do RJ o relatório traz a legislação estadual correta
    Dado uma unidade em um estado diferente do RJ
    Quando o app resolve as normas aplicáveis
    Então a UF é normalizada pelas 27 unidades federativas
    E a comparação com a biblioteca usa chave canônica, não substring

  Cenário: Quebra de página não vaza título nem sobrepõe rodapé
    Dado um relatório longo o suficiente para quebrar página
    Quando o PDF é gerado
    Então o título não vaza a caixa
    E o texto não se sobrepõe ao rodapé

  # Garantido por: src/utils/legislationRefs.ts, src/data/legislationLibrary.ts,
  # src/utils/state.ts (toUF), e a inspeção do PDF gerado em Node.
