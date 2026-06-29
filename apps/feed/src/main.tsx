import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

document.documentElement.style.setProperty(
  '--feed-page-pattern-url',
  `url("${import.meta.env.BASE_URL}images/backgrounds/jeffwm-feed-lion-pattern-20260627.jpeg")`,
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
