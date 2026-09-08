import {resolveInitializerUrl} from './embedUrl';

interface InitializerMessage {
    name: string;
    height: number;
}

const currentScript: HTMLScriptElement | null = document.currentScript as HTMLScriptElement | null;
if (currentScript === null || currentScript.src.length === 0) throw new Error('jME initializer embed requires a script URL.');

const initializerUrl: URL = resolveInitializerUrl(currentScript.src);
const frame: HTMLIFrameElement = document.createElement('iframe');
frame.src = initializerUrl.href;
frame.title = currentScript.dataset.title ?? 'jMonkeyEngine project initializer';
frame.loading = 'lazy';
frame.sandbox.add('allow-downloads', 'allow-forms', 'allow-scripts', 'allow-same-origin', 'allow-popups');
frame.referrerPolicy = 'strict-origin-when-cross-origin';
frame.style.width = '100%';
frame.style.minHeight = '900px';
frame.style.border = '0';

const target: HTMLElement = currentScript.dataset.target === undefined
    ? currentScript.parentElement ?? document.body
    : document.querySelector<HTMLElement>(currentScript.dataset.target) ?? document.body;
target.insertBefore(frame, currentScript.dataset.target === undefined ? currentScript : null);

window.addEventListener('message', (event: MessageEvent<unknown>): void => {
    if (event.source !== frame.contentWindow || event.origin !== initializerUrl.origin || typeof event.data !== 'string') return;
    let message: InitializerMessage;
    try {
        message = JSON.parse(event.data) as InitializerMessage;
    } catch {
        return;
    }
    if (message.name !== 'jme-initializer-resize' || !Number.isFinite(message.height)) return;
    const height: number = Math.max(480, Math.min(5000, Math.ceil(message.height)));
    frame.style.height = `${height}px`;
});
