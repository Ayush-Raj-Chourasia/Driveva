import { Buffer } from 'buffer';
import process from 'process';
window.Buffer = window.Buffer || Buffer;
window.process = window.process || process;
if (typeof global === 'undefined') {
  (window as any).global = window;
}
if (typeof (window as any).globalThis === 'undefined') {
  (window as any).globalThis = window;
}
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
