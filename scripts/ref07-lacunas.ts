// REF-07 — quais normas citadas pelos roteiros ainda não têm verbete na biblioteca.
//
// Por que: desde o REF-07 a página de referências do relatório só cita norma com
// verbete curado — é o verbete que traz autoria, ementa, link e vigência conferida.
// Norma sem verbete não é citada, então esta lista é exatamente o que falta cadastrar
// para o relatório voltar a mostrá-la.
//
// Uso:  npx tsx scripts/ref07-lacunas.ts
//
// Diferente do scripts/ref01-build-inventory.ts, que cruza dumps de produção, este
// roda só sobre src/data — não precisa de rede nem de credencial.

import { LEGISLATION_LIBRARY } from '../src/data/legislationLibrary';
import { canonicalLegislationKey, extractBaseLegislation } from '../src/utils/legislationRefs';
import { templates } from '../src/data/templates';
import { supplementRegistry } from '../src/data/supplementRegistry';

// Os suplementos regionais (RJ, GO, BH) não fazem parte de `templates` — é neles que
// mora quase toda a citação estadual/municipal, então precisam entrar na varredura.
const sources = [
  ...templates.map(t => ({ name: t.name, sections: t.sections })),
  ...supplementRegistry.map(entry => ({
    name: `${entry.supplement.name ?? 'Suplemento'}${entry.nameSuffix}`,
    // O suplemento não tem `sections`: os itens dele moram nas adições às seções federais
    // (`sectionAdditions`) e nas seções novas. Ler `.sections`, que não existe, fazia esta
    // varredura devolver ZERO para todo suplemento — justamente os atos estaduais e
    // municipais que o comentário acima diz serem o motivo de incluí-los. Só apareceu
    // quando `scripts/` entrou no `tsc -b` (DEBT-02).
    sections: [
      ...entry.supplement.sectionAdditions.map(adicao => ({ items: adicao.items })),
      ...(entry.supplement.newSections ?? []),
    ],
  })),
];

const catalogued = new Set(LEGISLATION_LIBRARY.map(e => canonicalLegislationKey(e.name)));

/** grafia citada → em quantos itens aparece, e em que roteiros. */
const gaps = new Map<string, { count: number; templates: Set<string> }>();

for (const template of sources) {
  for (const section of template.sections) {
    for (const item of section.items) {
      if (!item.legislation) continue;
      for (const base of extractBaseLegislation(item.legislation)) {
        if (catalogued.has(canonicalLegislationKey(base))) continue;
        const entry = gaps.get(base) || { count: 0, templates: new Set<string>() };
        entry.count++;
        entry.templates.add(template.name);
        gaps.set(base, entry);
      }
    }
  }
}

const ordered = [...gaps.entries()].sort((a, b) => b[1].count - a[1].count);
for (const [name, { count, templates }] of ordered) {
  console.log(`${String(count).padStart(4)} itens  ${name}`);
  console.log(`            ${[...templates].join(' · ')}`);
}
console.log(
  `\n${LEGISLATION_LIBRARY.length} verbetes na biblioteca · ` +
  `${ordered.length} citações sem verbete · ` +
  `${ordered.reduce((n, [, g]) => n + g.count, 0)} itens afetados`
);
