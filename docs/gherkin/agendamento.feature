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

  Cenário: Grade de segunda a sexta, 07h às 19h
    Dado a visão de calendário de semana
    Então há uma linha por hora de 07h a 19h
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

  # Garantido por: src/components/ui/WeekCalendar.tsx, PortalAppointments.test.tsx, Schedules.tsx.
