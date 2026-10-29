import { createRoot } from 'react-dom/client';
import './style.css';
import { App } from './App';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing #root mount element');

createRoot(rootElement).render(<App />);
