import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AnnotationEditor from './pages/AnnotationEditor.tsx';
import WorkspaceNav from './components/WorkspaceNav.tsx';
import { ToastProvider } from './components/Toast.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <WorkspaceNav />
      <AnnotationEditor />
    </ToastProvider>
  </StrictMode>,
);
