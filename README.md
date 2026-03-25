# InspecVISA — App de Inspeção Sanitária

PWA offline-first para roteiros de inspeção sanitária de campo — C&C Consultoria Sanitária.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS
- Dexie.js (IndexedDB) — armazenamento offline
- jsPDF — geração de PDF no cliente
- Zustand — estado global
- vite-plugin-pwa — suporte offline / instalável

---

## Desenvolvimento local

**Pré-requisitos:** Node.js 22+

```bash
npm install
npm run dev
```

A aplicação estará disponível em `http://localhost:5173`.

```bash
# Build de produção
npm run build

# Preview do build
npm run preview
```

---

## Rodando com Podman (container)

**Pré-requisitos:** Podman instalado.

```bash
# Build da imagem
podman build -t inspecvisa .

# Rodar na porta 8080
podman run -p 8080:80 inspecvisa
```

A aplicação estará disponível em `http://localhost:8080`.

O `Containerfile` usa build multi-stage:
1. **Stage builder** — Node 22 Alpine compila o projeto com `npm run build`
2. **Stage final** — nginx Alpine serve os arquivos estáticos do `dist/`

---

## PWA / Offline

Após a primeira carga, o app funciona completamente offline. Fotos e inspeções são armazenadas localmente no IndexedDB do navegador. Para instalar como app nativo, use a opção "Adicionar à tela inicial" no navegador.
