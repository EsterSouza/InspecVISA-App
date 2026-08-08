# Roteiro manual — NVDA/VoiceOver no Portal do Cliente (P360-014)

Este roteiro cobre os três pontos citados no critério de teste do card P360-014: login, agenda
e plano de ação. Os três vivem na mesma URL, `/cliente` — login é o estado deslogado, agenda e
plano de ação são seções dentro do painel depois de entrar. Não foi executado nesta sessão
porque exige um leitor de tela do sistema operacional (NVDA no Windows, VoiceOver no Mac), que
não está disponível neste ambiente. O que foi verificado no lugar: varredura automatizada com
`jest-axe` (12 novos testes, zero violações WCAG A/AA), leitura da árvore de acessibilidade via
navegador e checagem de foco por teclado — ver `### Resultado` do card em `docs/HANDOFF.md`.

## Como rodar

- **Windows**: instale o NVDA (gratuito, nvaccess.org). Abra o Chrome ou Edge, ative o NVDA
  (Ctrl+Alt+N), navegue até `/cliente`.
- **Mac**: ative o VoiceOver (Cmd+F5). Abra o Safari, navegue até `/cliente`.
- Em ambos, comece do topo da página a cada seção (Ctrl+Home no NVDA, VO+Cmd+Home no VoiceOver).

## 1. Login (`/cliente` deslogado)

- [ ] O leitor anuncia o título da página/região principal ao entrar (heading "Portal do
      Cliente").
- [ ] Navegando por campo de formulário (Tab ou F ao usar navegação por elemento), o leitor
      anuncia **rótulo + tipo do campo**: "E-mail ou usuario, campo de edição" e "Senha, campo de
      senha" — não deve anunciar só o placeholder.
- [ ] Submeter o formulário vazio anuncia o erro ("Informe o e-mail/usuario e a senha") sem
      precisar mover o foco manualmente até a mensagem.
- [ ] O botão "Acessar meu painel" é anunciado como botão, com esse nome.
- [ ] Ordem de tabulação: logo (link) → campo de e-mail → campo de senha → botão. Nada pula na
      frente ou fica inacessível por teclado.

## 2. Agenda (seção "Calendário de compromissos" após login)

- [ ] Os botões de navegação do calendário ("Mês anterior", "Próximo mês", "Voltar ao mês
      atual") são anunciados pelo nome, não apenas como "botão" sem contexto — o leitor deve
      falar o texto/aria-label, não o ícone.
- [ ] Ao navegar pela grade do calendário, os dias com compromisso (fundo destacado) não geram
      ruído extra — os pontos indicadores no mobile são decorativos e não devem ser lidos como
      itens de lista separados.
- [ ] Cada compromisso na lista "Agendamentos e arquivos" abaixo do calendário é um link com
      nome completo: unidade, data e status — não "link" genérico.
- [ ] Ativar um compromisso (Enter) navega para a página de detalhes do protocolo.

## 3. Plano de ação (seção com âncora `#portal-action-plan`)

- [ ] O título da seção ("Plano de ação") é um heading de verdade — navegável por H no NVDA ou
      VO+Cmd+H no VoiceOver.
- [ ] Cada pendência anuncia prioridade, status e prazo antes do título do item (a ordem visual
      dos badges é a mesma ordem de leitura).
- [ ] Ao clicar em "Enviar evidência", o foco move para dentro do formulário que aparece (nome,
      função, comentário) — o leitor não perde o contexto.
- [ ] Os campos "Seu nome" e "Sua função" são anunciados com esse rótulo (via `aria-label`),
      mesmo sem `<label>` visível ao lado.
- [ ] Se o plano de ação falhar ao carregar, o leitor anuncia a mensagem de erro automaticamente
      (região `role="alert"`) e o botão "Tentar novamente" é alcançável e tem 44×44px de área de
      toque.
- [ ] A transição do skeleton (esqueleto de carregamento) para o conteúdo real não deixa o
      leitor "preso" anunciando "carregando" indefinidamente — depois que os dados chegam, o
      conteúdo novo é lido normalmente na próxima navegação.

## Como reportar o que falhar

Para cada item marcado como falho, anote: leitor de tela + navegador usados, o que foi
anunciado (ou o silêncio), e o que era esperado. Isso vira um achado pontual — não precisa
reabrir o card inteiro, só a seção específica.
