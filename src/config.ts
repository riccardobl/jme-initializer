export interface InitializerEnvironment {
    readonly [name: string]: string | boolean | undefined;
    readonly VITE_LIBRARY_API_BASE?: string;
    readonly VITE_TEMPLATE_ARCHIVE_URL?: string;
}

export class InitializerConfig {
    public static readonly DEFAULT_LIBRARY_API_BASE: string = 'https://library.jmonkeyengine.org/';
    public static readonly DEFAULT_TEMPLATE_ARCHIVE_URL: string = './template.zip';

    public readonly libraryApiBase: string;
    public readonly templateArchiveUrl: URL;

    public constructor(environment: InitializerEnvironment, documentBase: string) {
        const configuredApiBase: string = InitializerConfig.valueOrDefault(
            environment.VITE_LIBRARY_API_BASE, InitializerConfig.DEFAULT_LIBRARY_API_BASE);
        const configuredTemplateUrl: string = InitializerConfig.valueOrDefault(
            environment.VITE_TEMPLATE_ARCHIVE_URL, InitializerConfig.DEFAULT_TEMPLATE_ARCHIVE_URL);
        this.libraryApiBase = InitializerConfig.validateApiBase(configuredApiBase);
        this.templateArchiveUrl = InitializerConfig.validateTemplateUrl(configuredTemplateUrl, documentBase);
    }

    private static valueOrDefault(value: string | undefined, defaultValue: string): string {
        return value === undefined || value.trim().length === 0 ? defaultValue : value.trim();
    }

    private static validateApiBase(value: string): string {
        const url: URL = new URL(value.replace(/\/*$/, '/'));
        InitializerConfig.validateHttpUrl(url, 'Library API');
        if (url.search.length > 0 || url.hash.length > 0) {
            throw new Error('The Library API URL cannot contain a query or fragment.');
        }
        return url.href;
    }

    private static validateTemplateUrl(value: string, documentBase: string): URL {
        const url: URL = new URL(value, documentBase);
        InitializerConfig.validateHttpUrl(url, 'template archive');
        return url;
    }

    private static validateHttpUrl(url: URL, label: string): void {
        if (!['http:', 'https:'].includes(url.protocol) || url.username.length > 0 || url.password.length > 0) {
            throw new Error(`The ${label} URL must use HTTP(S) without credentials.`);
        }
    }
}
