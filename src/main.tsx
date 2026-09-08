import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App';
import './styles.css';

const container: HTMLElement | null = document.getElementById('root');
if (container === null) throw new Error('Missing application root.');
createRoot(container).render(<React.StrictMode><App/></React.StrictMode>);
