# EST-01 — Mapa de migração das respostas · MEIRE BEAUTY CLINIC

**Status: aguardando revisão da Ester. Nada foi executado.**

Este documento é a **proposta** de correspondência entre o roteiro arquivado e o roteiro novo.
Nenhuma linha foi escrita no banco. O script de migração só será construído depois que você
aprovar este mapa — em especial os 6 itens marcados como **REVISAR** na seção 5.

| | |
|---|---|
| Inspeção | `548466d6-ee61-42da-b844-76fbbfa679ce` |
| Cliente | MEIRE BEAUTY CLINIC |
| Consultora | Ester Caiafa |
| Data da inspeção | 31/07/2026 |
| Roteiro atual | `b37caf84…` — [ARQUIVADO] Estética e Beleza (v2027), 12 seções, 112 itens |
| Roteiro de destino | `0c55f120…` — Clínica de Estética e Saúde 08/2026, 12 seções, 113 itens |

---

## 1. Resumo

| Medida | Valor |
|---|---|
| Respostas na inspeção | 124 |
| Itens distintos respondidos | 121 |
| Itens do roteiro respondidos | **112 de 112** — você respondeu o roteiro inteiro |
| Itens extras criados por você durante a inspeção | 9 |
| Itens com resposta duplicada | 3 |
| **Equivalência direta, confiança alta** | **106 itens** |
| **Exigem sua decisão** | **6 itens** |
| Itens novos que ficarão em branco | 2 |

As 12 seções dos dois roteiros correspondem uma a uma, na mesma ordem. Três mudaram de nome
sem mudar de assunto: *Processamento de Artigos (CME)* → *Processamento de Artigos*,
*Lavanderia* → *Processamento de Roupas*, *Considerações Gerais* → *Requisitos Gerais*.

---

## 2. O que muda no seu resultado, mesmo sem você mudar nenhuma resposta

Esta é a parte que merece mais atenção. O roteiro novo reclassificou vários itens como
**boa prática** (`good_practice`), que entram no score com peso reduzido e **nunca são críticos**.
Isso altera o resultado da inspeção sem que nenhuma resposta sua mude.

### 2.1 Não conformidades que deixam de ser críticas

Você marcou estes como **não conforme**. No roteiro novo eles continuam NC, mas param de pesar
como item crítico:

| Item | Antes | Depois |
|---|---|---|
| 11.16 — sinalização visível (nome do RT, telefones, direitos) | peso 1, não crítico | **boa prática**, peso 1, escopo reduzido a orientações de emergência |

### 2.2 Itens conformes que mudam de peso

Você marcou estes como **conforme**, então não viram NC — mas o peso deles no score cai:

| Item | Antes | Depois |
|---|---|---|
| 1.2 — CNPJ / CNAE compatível | crítico, peso 10 | boa prática, peso 2 |
| 1.14 — qualificação de fornecedores | peso 5 | boa prática, peso 2 |
| 3.10 — acessibilidade para PCD | crítico, peso 10 | boa prática, peso 2 |
| 5.6 — barreira descartável | crítico, peso 10 | boa prática, peso 2 |
| 7.6 — produtos à venda segregados | crítico, peso 10 | boa prática, peso 2 |
| 11.4 — extintores | peso 5 | boa prática, peso 2 |
| 11.5 — saídas de emergência | peso 2 | boa prática, peso 2 |
| 11.11 — Livro de Reclamações | crítico, peso 10 | boa prática, peso 2 |
| 11.13 — descarte de embalagens inutilizadas | crítico, peso 10 | boa prática, peso 2 |
| 11.15 — guarda de pertences | peso 2 | boa prática, peso 2 |

### 2.3 Itens "não se aplica" que o roteiro novo passou a condicionar explicitamente

Aqui a mudança é a seu favor: o roteiro novo já traz a condicional no texto da pergunta, então
o "não se aplica" deixa de parecer uma exceção aberta pela consultora.

- **1.5 — Plano de Segurança do Paciente.** Você marcou NA. O novo pergunta *"Nos casos abrangidos
  pela norma…"*, o que sustenta sua decisão no próprio enunciado.
- **Seção 4 inteira (CME), 12 itens NA.** O novo condiciona o item 4.1 a *"Quando processa produtos
  para saúde…"*.
- **Seção 10 (roupas), 4 itens NA.** Dois viraram boa prática e o 10.3 ganhou *"Quando terceiriza…"*.
- **6.1 e 6.5 — NSP e identificação do paciente.** Ambos agora condicionados à RDC Anvisa nº 36/2013.

**Recomendação:** depois da migração, reabra a inspeção e confira o score por área antes de gerar
o relatório. O número vai mudar, e é melhor você ver isso antes do cliente.

---

## 3. Regras de migração propostas

### 3.1 Respostas duplicadas — 3 itens

Os itens **1.1**, **1.2** e **1.3** têm duas respostas cada: uma de 31/07 e outra de 03/08. A de
03/08 é a que tem o conteúdo bom — é onde estão a análise do Decreto Rio nº 57.501/2026 na licença,
a consulta da correlação CAE/CNAE e o protocolo do CRBM.

O aplicativo já resolve isso com `getLatestResponsesByItem`, que usa a mais recente. **Proposta:**
migrar apenas a mais recente de cada item e marcar a antiga como `deleted_at`, preservando-a.

> ⚠️ Confirme: em **1.1**, a resposta antiga tem a anotação `"50 me na lsf / Cnae de atividades de
> estética"`. Ela parece ser rascunho da análise que você depois escreveu por extenso na resposta
> de 03/08. Se for isso, ela se perde na migração — e é o comportamento correto. Se houver algo
> ali que você quer manter, avise que eu concateno.

### 3.2 Os 9 itens extras

Não são itens de roteiro. São itens que você criou durante a inspeção, e o app os identifica por
`extra|<id-da-seção>|<id>`. Como o identificador embute a **seção**, e as seções do roteiro novo
têm IDs diferentes, eles ficariam órfãos se nada fosse feito.

**Proposta:** reescrever o prefixo de seção de cada extra para a seção equivalente do roteiro novo.

| Seção do extra | Quantos | Destino |
|---|---|---|
| Documentação e Regularização | 1 | Documentação e Regularização |
| Saúde e Segurança do Trabalhador | 1 | Saúde e Segurança do Trabalhador |
| Infraestrutura Física | 3 | Infraestrutura Física |
| Segurança do Paciente | 2 | Segurança do Paciente |
| Equipamentos e Produtos | 1 | Equipamentos e Produtos |
| Controle de Vetores e Qualidade da Água | 1 | Controle de Vetores e Qualidade da Água |

Oito deles só têm resultado, sem texto. Um tem a ação `"Verificar questão dos CNAEs"`.

### 3.3 O que é preservado

`result`, `situation_description`, `corrective_action`, `responsible`, `deadline`,
`custom_description` e as fotos vinculadas — todos migram sem alteração de conteúdo. **O texto que
você ditou não será corrigido, reescrito nem normalizado.**

### 3.4 Reversibilidade

Nada é apagado. As respostas antigas recebem `deleted_at` e as novas são criadas. Antes de rodar,
sai um backup em JSON das 124 respostas, guardado fora do repositório.

---

## 4. Os 2 itens novos que ficarão em branco

O roteiro novo tem 113 itens e o antigo 112. Estes dois não existiam e ficam aguardando sua
resposta:

| Item novo | Texto | Tipo |
|---|---|---|
| 1.12 | Mantém memorial descritivo atualizado com os procedimentos, técnicas e tecnologias utilizados? | boa prática |
| 1.16 | Quando exigível pelas características da instalação e dos equipamentos, apresenta documentação técnica do aterramento elétrico? | legal, peso 2 |

O 1.16 tem relação direta com a NBR 13534, que você acabou de baixar para o repositório.

---

## 5. ⚠️ Os 6 itens que precisam da sua decisão

Estes são os únicos pontos onde eu não tenho segurança para decidir sozinha. Os demais 106 são
correspondência direta.

### 5.1 · Item 2.6 — vestiário e copa

- **Antigo:** "Possui vestiário com armários individuais para guarda de pertences dos funcionários,
  **e copa ou local para descanso e refeições**."
- **Novo (2.6):** "Os trabalhadores dispõem de local próprio e seguro para guardar seus pertences?"
- **Sua resposta:** não se aplica.
- **O problema:** o item novo cobre só a guarda de pertences. A exigência de copa/local de refeição
  sumiu do enunciado.
- **Proposta:** migrar como equivalente. O NA continua válido para o escopo reduzido.
- **Decida:** aceita, ou quer que a questão da copa vire um item extra para não se perder?

### 5.2 · Item 3.5 — sanitários

- **Antigo:** "Possui sanitários para funcionários e público, **distintos**, completos e em bom
  estado."
- **Novo (3.5):** "Os sanitários disponíveis são compatíveis com a capacidade e a organização
  funcional do serviço?"
- **Sua resposta:** conforme.
- **O problema:** o novo não exige mais que sejam distintos. É um afrouxamento real do critério.
- **Proposta:** migrar como equivalente — sua resposta era "conforme", então o resultado não muda.
- **Decida:** confirma que a clínica atende o critério novo também?

### 5.3 · Item 7.11 — controle especial

- **Antigo:** "Caso utilize medicamentos sujeitos a controle especial (Portaria 344/98), apresenta
  a **Autorização de Funcionamento Especial (AFE)**."
- **Novo (7.11):** "Quando utiliza substâncias sujeitas a controle especial, mantém a
  **documentação de aquisição e a escrituração** aplicável?"
- **Sua resposta:** não se aplica.
- **O problema:** o antigo cobrava um documento específico (AFE); o novo cobra outra coisa
  (aquisição e escrituração). Não é a mesma exigência.
- **Proposta:** migrar como equivalente, já que sua resposta é NA e a clínica não usa controlados.
- **Decida:** aceita? Se a clínica passar a usar controlados, o item novo cobra algo diferente.

### 5.4 · Item 7.15 — medicamentos manipulados · **o mais importante**

- **Antigo:** "Os medicamentos manipulados possuem rótulo com os dados da farmácia de manipulação
  e do paciente/clínica." — crítico, peso 10.
- **Sua resposta: NÃO CONFORME.**
- **O problema:** **não existe item equivalente no roteiro novo.** A seção 7 saiu de 15 para 14
  itens, e este foi o que caiu. Se nada for feito, **essa não conformidade desaparece do
  relatório**.
- **Proposta:** fundir em **7.8** — "Os produtos abertos ou preparados para uso estão identificados
  com nome, data de abertura ou preparo e validade aplicável?", que você também marcou como não
  conforme. As duas NCs viram uma só, e o texto da sua descrição é concatenado.
- **Alternativas:** (a) criar um item extra na seção 7 preservando a NC isolada; (b) aceitar que a
  exigência saiu do roteiro e descartar a resposta, registrando o motivo.
- **Decida:** esta é a única linha do mapa em que uma NC crítica sua pode sumir. Preciso da sua
  instrução explícita.

### 5.5 · Item 11.7 — bebedouro

- **Antigo:** "Há bebedouro com água potável disponível para **funcionários e clientes**, com
  manutenção em dia."
- **Novo (11.7):** "Os **trabalhadores** têm acesso a água potável em condições higiênicas?"
- **Sua resposta: NÃO CONFORME.**
- **O problema:** o novo cobre só os trabalhadores. Se a sua NC era sobre a falta de água para os
  **clientes**, ela não se sustenta no item novo.
- **Proposta:** migrar como equivalente e manter a NC.
- **Decida:** a não conformidade era sobre funcionários, clientes, ou os dois?

### 5.6 · Item 11.16 — sinalização

- **Antigo:** "Possui toda a sinalização visível (**nome do RT, telefones de emergência, direitos
  do paciente**, etc.)."
- **Novo (11.16):** "As **orientações de emergência** estão visíveis para trabalhadores e
  pacientes?" — agora boa prática.
- **Sua resposta: NÃO CONFORME.**
- **O problema:** o escopo encolheu bastante. Nome do RT e direitos do paciente saíram.
- **Proposta:** migrar como equivalente, mantendo a NC — que passa a ser boa prática.
- **Decida:** se a NC era pela ausência do nome do RT, ela deixa de ter enquadramento. Quer que
  isso vire item extra?

---

## 6. Mapa completo

Notação: `seção.item`. "→" indica o destino no roteiro novo. Salvo indicação, a classificação é
**equivalente, confiança alta**, e a resposta migra sem alteração.

### Seção 1 — Documentação e Regularização · 14 → 16

| Antigo | Novo | Resultado atual | Obs. |
|---|---|---|---|
| 1.1 Alvará/Licença Sanitária vigente e afixada | 1.1 | conforme | novo não exige mais "afixada em local visível" |
| 1.2 CNPJ e CNAE compatível | 1.2 | conforme | vira boa prática |
| 1.3 RT nível superior habilitado | 1.3 | conforme | |
| 1.4 PGRSS implementado | 1.4 | **não conforme** | |
| 1.5 Plano de Segurança do Paciente | 1.5 | não se aplica | novo condiciona no enunciado |
| 1.6 Manual de Rotinas / Biossegurança | 1.6 | **não conforme** | |
| 1.7 POPs das atividades críticas | 1.7 | **não conforme** | |
| 1.8 Prontuários preenchidos e sigilosos | 1.8 | conforme | |
| 1.9 TCLE por procedimento invasivo | 1.9 | conforme | |
| 1.10 PBA/LTA aprovado pela VISA | 1.10 | conforme | |
| 1.11 Relação formal de profissionais | 1.11 | **não conforme** | |
| 1.12 Lista de equipamentos com registro Anvisa | 1.13 | **não conforme** | |
| 1.13 Contratos e licenças de terceirizadas | 1.14 | conforme | |
| 1.14 Qualificação de fornecedores | 1.15 | conforme | vira boa prática |
| — | 1.12 memorial descritivo | *em branco* | item novo |
| — | 1.16 aterramento elétrico | *em branco* | item novo |

### Seção 2 — Saúde e Segurança do Trabalhador · 6 → 6

| Antigo | Novo | Resultado atual | Obs. |
|---|---|---|---|
| 2.1 PCMSO | 2.1 | não se aplica | |
| 2.2 PGR com Mapa de Risco | 2.2 | não se aplica | novo admite documentação simplificada ME/EPP |
| 2.3 EPIs com CA | 2.3 | conforme | |
| 2.4 Vacinação e Anti-HBs | 2.4 | não se aplica | |
| 2.5 Educação permanente documentada | 2.5 | **não conforme** | |
| 2.6 Vestiário e copa | 2.6 | não se aplica | **REVISAR — ver 5.1** |

### Seção 3 — Infraestrutura Física · 13 → 13

| Antigo | Novo | Resultado atual | Obs. |
|---|---|---|---|
| 3.1 Pisos, paredes e tetos | 3.1 | conforme | |
| 3.2 Mobiliário lavável e íntegro | 3.2 | **não conforme** | tem descrição: poltronas permeáveis, mantas de tecido |
| 3.3 Instalações protegidas | 3.3 | conforme | |
| 3.4 Iluminação e ventilação | 3.4 | conforme | tem descrição: "Ar central" |
| 3.5 Sanitários distintos | 3.5 | conforme | **REVISAR — ver 5.2** |
| 3.6 Sala de procedimentos exclusiva | 3.6 | conforme | tem ação sobre identificação das áreas |
| 3.7 Lavatório exclusivo com insumos | 3.7 | conforme | |
| 3.8 DML com tanque | 3.8 | **não conforme** | descrição longa sobre armazenamento na copa |
| 3.9 Organização e limpeza | 3.9 | conforme | |
| 3.10 Acessibilidade PCD | 3.10 | conforme | vira boa prática |
| 3.11 Recepção separada | 3.11 | conforme | |
| 3.12 Tela milimétrica nas janelas | 3.12 | conforme | |
| 3.13 Ralos com fechamento | 3.13 | conforme | |

### Seção 4 — Processamento de Artigos · 12 → 12

Correspondência posicional exata, item a item (4.1→4.1 … 4.12→4.12).
**Todos os 12 estão marcados como "não se aplica"** — a clínica optou por material descartável.
O item 4.1 do roteiro novo já traz a condicional *"Quando processa produtos para saúde…"*, o que
sustenta a decisão. O item 4.1 tem uma ação registrada sobre pinças e materiais metálicos.

### Seção 5 — Biossegurança · 7 → 7

Correspondência posicional exata (5.1→5.1 … 5.7→5.7). Todos conformes.
O **5.6** (barreira descartável) vira boa prática e muda de escopo: passa a valer para superfícies
que não podem ser desinfetadas adequadamente.

### Seção 6 — Segurança do Paciente · 8 → 8

| Antigo | Novo | Resultado atual | Obs. |
|---|---|---|---|
| 6.1 NSP instituído | 6.1 | não se aplica | novo condiciona à RDC 36/2013 |
| 6.2 Protocolo de intercorrências | 6.2 | **não conforme** | |
| 6.3 Maleta de intercorrências | 6.3 | não se aplica | |
| 6.4 Notificação NOTIVISA | 6.4 | não se aplica | |
| 6.5 Identificação do paciente | 6.5 | não se aplica | novo condiciona à RDC 36/2013 |
| 6.6 Cirurgia segura | 6.6 | conforme | |
| 6.7 Instruções pós-procedimento | 6.7 | conforme | tem descrição sobre envio eletrônico |
| 6.8 Rastreabilidade de produtos | 6.8 | conforme | descrição longa sobre prontuário e etiquetagem |

### Seção 7 — Equipamentos e Produtos · 15 → 14

| Antigo | Novo | Resultado atual | Obs. |
|---|---|---|---|
| 7.1 Equipamentos regularizados na Anvisa | 7.1 | **não conforme** | |
| 7.2 Manual em português | 7.2 | conforme | |
| 7.3 Manutenção e calibração | 7.3 | conforme | |
| 7.4 Saneantes regularizados | 7.4 | conforme | |
| 7.5 Cosméticos regularizados e na validade | 7.5 | **não conforme** | |
| 7.6 Produtos à venda segregados | 7.6 | conforme | vira boa prática |
| 7.7 Fracionamento proibido | 7.7 | não se aplica | vira boa prática |
| 7.8 Produtos abertos identificados | 7.8 | **não conforme** | recebe também o 7.15 — ver 5.4 |
| 7.9 Refrigerador exclusivo | 7.9 | conforme | |
| 7.10 Contingência para termolábeis | 7.10 | conforme | |
| 7.11 AFE para controlados | 7.11 | não se aplica | **REVISAR — ver 5.3** |
| 7.12 Armazenamento de controlados | 7.12 | conforme | |
| 7.13 BSPO | 7.13 | não se aplica | |
| 7.14 Amostras grátis | 7.14 | conforme | vira boa prática |
| 7.15 Medicamentos manipulados | **7.8 (fundido)** | **não conforme** | **REVISAR — ver 5.4** |

### Seção 8 — Gestão de Resíduos · 7 → 7

Correspondência posicional exata (8.1→8.1 … 8.7→8.7).
O **8.3** (recipientes de descarte) está marcado como não conforme. Os demais, conformes.

### Seção 9 — Controle de Vetores e Qualidade da Água · 3 → 3

Correspondência posicional exata. **Os três estão como não conforme:** controle de vetores,
limpeza do reservatório e laudo de potabilidade.

### Seção 10 — Lavanderia → Processamento de Roupas · 4 → 4

Correspondência posicional exata. **Os quatro estão como "não se aplica".**
O 10.4 do roteiro novo não exige mais que as toalhas sejam de cor clara; 10.3 e 10.4 viram boa
prática.

### Seção 11 — Considerações Gerais → Requisitos Gerais · 18 → 18

| Antigo | Novo | Resultado atual | Obs. |
|---|---|---|---|
| 11.1 Publicidade não enganosa | 11.1 | conforme | |
| 11.2 Proibido bronzeamento UV | 11.2 | conforme | |
| 11.3 Profissionais habilitados | 11.3 | conforme | |
| 11.4 Extintores | 11.4 | conforme | vira boa prática |
| 11.5 Saídas de emergência | 11.5 | conforme | vira boa prática |
| 11.6 Proibido fumar | 11.6 | **não conforme** | |
| 11.7 Bebedouro | 11.7 | **não conforme** | **REVISAR — ver 5.5** |
| 11.8 Ar condicionado | 11.8 | conforme | novo exige PMOC nominalmente |
| 11.9 Validade dos saneantes | 11.9 | conforme | |
| 11.10 Uniformes | 11.10 | conforme | |
| 11.11 Livro de Reclamações | 11.11 | conforme | vira boa prática; novo aceita canal equivalente |
| 11.12 Notificação compulsória | 11.12 | não se aplica | |
| 11.13 Descarte de embalagens | 11.13 | conforme | vira boa prática |
| 11.14 Limpeza externa dos equipamentos | 11.14 | conforme | |
| 11.15 Guarda de pertences | 11.15 | conforme | vira boa prática |
| 11.16 Sinalização visível | 11.16 | **não conforme** | **REVISAR — ver 5.6** |
| 11.17 Certificados de calibração | 11.17 | não se aplica | |
| 11.18 Gerenciamento de tecnologias | 11.18 | não se aplica | |

### Seção 12 — Gestão da Qualidade · 5 → 5

Correspondência posicional exata. **Os cinco estão como "não se aplica".**

---

## 7. O que acontece depois que você aprovar

1. Backup em JSON das 124 respostas, fora do repositório.
2. Script de migração idempotente, aplicando as decisões desta revisão.
3. Ensaio em Postgres descartável.
4. **Nova autorização sua** para executar em produção — a aprovação deste mapa não vale como
   autorização de execução.
5. Conferência na aplicação: inspeção abre no roteiro novo, as 18 descrições e as 13 ações estão
   nos itens certos, fotos vinculadas, score por área recalculado.

---

## 8. Como me responder

Basta dizer, para cada um dos 6 itens da seção 5, "aceita" ou o que mudar. Se aceitar todos como
propostos, diga apenas **"aceito o mapa"** — com atenção especial ao **5.4**, que é o único em que
uma não conformidade crítica sua pode desaparecer do relatório.
