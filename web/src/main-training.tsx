import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Training from './pages/Training.tsx';
import WorkspaceNav from './components/WorkspaceNav.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WorkspaceNav />
    <Training />
  </StrictMode>,
);
