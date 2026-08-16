---
name: biblioteca-design
description: Nossa coleção própria de sistemas de design (paletas, tipografia, espaçamento e voz) copiados do catálogo do DesignMD para disco, mais o passo a passo de coleta de cada sessão. Use ao escolher direção visual para landing page, página de produto ou marca nova da TreinaVISA, ao procurar referência de paleta ou tipografia, e sempre que for coletar mais sistemas para a biblioteca.
---

# Biblioteca de sistemas de design

Coleção própria, em disco, para não depender do catálogo de terceiros na hora de
desenhar. Serve às **landing pages e produtos futuros** — não ao InspecVISA, cuja
identidade sai do Manual de Marca TreinaVISA 2.0 e está em `design-inspecvisa`.

```
.claude/skills/biblioteca-design/sistemas/
  INDICE.md      ← comece aqui: sistema, slug, cores, tipografia, tamanho
  <slug>.md      ← o DESIGN.md completo de cada um
```

Meta: os ~1.675 do catálogo. **Um pouco a cada sessão** — ver a rotina abaixo.

## ⚠️ A coleta não pode ser feita por script

Descoberto em 16/08/2026, e custou caro: a borda do `designmd.co` (WAF da Vercel,
identificador `gru1::`) devolve **403 Forbidden** para qualquer cliente que não seja
navegador — inclusive com o token válido, inclusive no `initialize`. Pior: depois de
algumas requisições por `curl` e de duas sondagens em `sitemap.xml` e `robots.txt`,
**o bloqueio pegou também o MCP dentro do Claude Code**, que estava funcionando.

Consequências práticas:

1. **Nunca** chamar `designmd.co` por `curl`, `fetch` de script, ou qualquer coisa que
   não seja o MCP. Não vale a pena "testar rapidinho".
2. **Nunca** pedir `robots.txt`, `sitemap.xml` ou varrer caminhos do site deles.
3. Se aparecer `403` com `gru1::`, **parar imediatamente**. Insistir aprofunda o bloqueio.
   Esperar (é temporário) e voltar só pelo MCP.
4. Por isso a coleta é feita pelo MCP, dentro de uma sessão, e o volume por sessão é
   limitado pelo **contexto da conversa**, não pela cota deles (Builder = 600/10 min).

## Rotina de coleta — uma sessão de cada vez

1. Confirmar que o MCP está de pé: uma chamada de `recommend_blocks`. Se der `403`,
   o bloqueio ainda está ativo — parar e tentar outro dia.
2. Abrir `sistemas/INDICE.md` e ver o que já existe, para não repetir.
3. Escolher um **recorte** e ir por ele — categoria inteira é o corte mais útil, porque
   mantém a coleção equilibrada em vez de 300 fintechs e nenhuma de saúde.
   As 25 categorias e seus tamanhos estão em `catalogo-designmd`.
4. `search_designs(query, category, limit: 20)` para levantar slugs. A busca devolve no
   máximo 20 por vez e **não tem paginação** — variar a consulta (termos de estética,
   cor, humor) e deduplicar contra o índice.
5. `get_design(slug)` para cada slug novo, e salvar o retorno como
   `sistemas/<slug>.md`. Acrescentar no topo do arquivo uma linha `categoria: <Categoria>`,
   que é o que o indexador lê.
6. `node scripts/biblioteca/indexar-designs.mjs` no fim, para atualizar o índice.
7. Commitar. A biblioteca é do repositório, não de uma máquina.

**Quanto por sessão:** o limite real é o contexto. Cada DESIGN.md tem alguns KB e passa
pela conversa antes de virar arquivo. Na prática, algumas dezenas por sessão. Não tentar
fazer os 1.675 de uma vez — a conversa estoura muito antes da cota deles.

## Regras que continuam valendo

- **Telemetria:** as buscas vão para o servidor deles. Nunca mandar nome de cliente, dado
  de produção ou trecho do nosso código nas consultas — só descrição genérica de estética.
- **Trade dress:** o catálogo indexa marcas reais. Serve para calibrar estrutura, paleta e
  qualidade — **nunca** para clonar identidade de marca alheia numa página nossa.
- **A identidade da TreinaVISA não sai daqui.** Paleta e tipografia dos nossos produtos vêm
  do Manual 2.0. Esta biblioteca é repertório para marcas e produtos **novos**.

## Relacionados

- `catalogo-designmd` — as ferramentas do MCP, as categorias e os padrões de componente.
- `reactbits` — 166 componentes de efeito visual, já completos em disco.
- `design-inspecvisa` — a identidade dos nossos produtos atuais.
