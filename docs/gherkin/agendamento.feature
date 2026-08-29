# language: pt
Funcionalidade: Agendamento e calendário
  Como consultora e como cliente
  Quero ver e organizar compromissos numa mesma grade
  Para enxergar buracos na semana e conferir datas em massa

  # FE-13: um único WeekCalendar renderiza portal e admin — muda o conteúdo, nunca a grade.
  Cenário: Alternar entre calendário de semana e lista
    Dado uma agenda com compromissos
    Quando alterno entre "Semana" e "Lista"
    Então a lista serve para conferir data e situação em massa
    E o calendário serve para enxergar buraco na semana
    E as duas visões existem em toda agenda do produto

  Cenário: Grade de segunda a sexta, 09h às 17h
    Dado a visão de calendário de semana
    Então há uma linha por hora de 09h a 17h
    E cada evento se posiciona por horário de início e duração

  Cenário: Compromisso fora da faixa estica a régua, não corta
    Dado um compromisso marcado às 06h
    Quando abro o calendário de semana
    Então a régua cresce para incluir 06h
    Mas nenhum compromisso é escondido

  Cenário: Abaixo de 720px a grade vira lista por dia
    Dado a visão de calendário num celular estreito
    Então a semana é empilhada como lista por dia
    E continua sendo a mesma semana

  Cenário: Estado do compromisso não depende só de cor
    Dado um compromisso cancelado
    Então o estado aparece por cor de fundo, estilo de borda e palavra na legenda
    E o nome acessível do evento carrega dia, horário e estado por extenso

  # AGD-02: marco (client_milestones) e entrega de pasta sanitária — evento de dia inteiro,
  # categoria própria (rosa), fora do vocabulário de estado do compromisso. Só na agenda do admin.
  Cenário: Marco aparece na grade sem virar um quinto estado de compromisso
    Dado um marco cadastrado para uma unidade numa data
    Quando abro a agenda do admin em "Mês" ou "Semana"
    Então o marco aparece como evento de dia inteiro, sem hora, em rosa
    E a legenda mostra "Marco" só quando existe algum na grade exibida
    E clicar no marco abre o modal de edição, não o formulário de visita

  Cenário: Entrega da pasta sanitária personalizada não tem modal próprio
    Dado um cliente com previsão de entrega da pasta sanitária cadastrada e sem link publicado
    Quando abro a agenda do admin
    Então a previsão aparece como marco na grade, na cor do marco
    E clicar nela navega para a ficha do cliente, aba Portal — onde o campo já é editado

  Cenário: Marco em fim de semana não some
    Dado um marco cadastrado para um sábado ou domingo
    Quando abro a visão de Mês, que só mostra segunda a sexta
    Então o marco aparece na linha "No fim de semana" abaixo da grade
    E aparece sempre na seção "Próximos marcos", que não depende da visão de Mês/Semana

  Cenário: O portal do cliente nunca vê marco
    Dado o mesmo WeekCalendar usado pelo portal (PortalAppointments)
    Então ele não recebe a prop de itens de dia inteiro
    E a grade do portal continua mostrando só as visitas agendadas

  Cenário: Clicar num dia vago pergunta visita ou marco
    Dado a agenda do admin em "Mês" ou "Semana"
    Quando clico num dia (ou horário) sem compromisso
    Então um seletor pergunta "Agendar visita" ou "Novo marco"
    E qualquer uma das duas opções já chega com o dia clicado preenchido

  # PORT-07: a auditoria é uma inspeção com outro nome.
  Cenário: Auditoria abre roteiro, relatório e plano de ação
    Dado um compromisso com finalidade "Auditoria"
    Então ele vale como inspeção: dá para executar o roteiro e publicar relatório e fotos
    E aceita duração de 15 a 720 minutos, como a inspeção — não 30/60/90 de reunião
    E o marco "Relatório" do cronograma do contrato conta com ele
    Mas a cota de uma inspeção por mês não se aplica a ele
    # A auditoria é mensal por contrato; a cota é da inspeção avulsa.

  Cenário: Finalidade no formulário de visita do admin
    Dado o formulário de nova visita, que antes gravava "inspeção" fixo
    Quando escolho um cliente com auditoria marcada no contrato
    Então "Auditoria" aparece como finalidade
    E some quando o cliente escolhido não a tem no contrato
    Mas editar uma visita existente não oferece trocar a finalidade
    # Trocar o tipo de uma inspeção em andamento mexeria com relatório e plano já vinculados.

  # Garantido por: src/components/ui/WeekCalendar.tsx, src/components/ui/MonthCalendar.tsx,
  # src/components/schedules/MilestoneModal.tsx, src/services/clientMilestoneService.ts,
  # supabase/tests/client_milestones.test.sql, PortalAppointments.test.tsx, Schedules.tsx.
