import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App';
import {InitializerConfig} from './config';
import './styles.css';

const container: HTMLElement | null = document.getElementById('root');
if (container === null) throw new Error('Missing application root.');
const rootContainer: HTMLElement = container;

async function start(): Promise<void> {
    try {
        const configUrl: URL = new URL('config.json', document.baseURI);
        const configuration: InitializerConfig = await InitializerConfig.load(configUrl);
        createRoot(rootContainer).render(<React.StrictMode><App configuration={configuration}/></React.StrictMode>);
    } catch (failure: unknown) {
        const message: string = failure instanceof Error ? failure.message : 'Unexpected configuration error.';
        rootContainer.replaceChildren(Object.assign(document.createElement('p'), {className: 'startup-error', textContent: message}));
    }
}

void start();
