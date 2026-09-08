import {describe, expect, test} from 'vitest';
import {InitializerConfig} from './config';

describe('InitializerConfig', () => {
    test('uses hardcoded defaults when environment values are absent', () => {
        const config: InitializerConfig = new InitializerConfig({}, 'https://initializer.example/project/');

        expect(config.libraryApiBase).toBe('https://library.jmonkeyengine.org/');
        expect(config.templateArchiveUrl.href).toBe('https://initializer.example/project/template.zip');
    });

    test('reads build-time environment values', () => {
        const config: InitializerConfig = new InitializerConfig({
            VITE_LIBRARY_API_BASE: 'http://localhost:8080/root',
            VITE_TEMPLATE_ARCHIVE_URL: './custom-template.zip'
        }, 'http://localhost:5173/initializer/');

        expect(config.libraryApiBase).toBe('http://localhost:8080/root/');
        expect(config.templateArchiveUrl.href).toBe('http://localhost:5173/initializer/custom-template.zip');
    });

    test('rejects unsafe URLs', () => {
        expect(() => new InitializerConfig({VITE_LIBRARY_API_BASE: 'javascript:alert(1)'}, 'https://initializer.example/'))
            .toThrow('Library API');
        expect(() => new InitializerConfig({VITE_TEMPLATE_ARCHIVE_URL: 'data:text/plain,test'}, 'https://initializer.example/'))
            .toThrow('template archive');
    });
});
