import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installChunkRecovery } from './utils/chunkRecovery';

// Domínio único: redireciona o domínio padrão da Vercel para o oficial,
// para não existirem dois links ativos ao mesmo tempo.
const CANONICAL_HOST = 'inspecvisa.consultorasanitaria.com.br';
const LEGACY_HOSTS = ['inspec-visa-app-three.vercel.app'];
if (LEGACY_HOSTS.includes(window.location.hostname)) {
  window.location.replace(
    `https://${CANONICAL_HOST}${window.location.pathname}${window.location.search}${window.location.hash}`
  );
} else {
  installChunkRecovery();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
