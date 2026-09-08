import type {CatalogPage, LibraryModule} from './types';
import {ProjectOptions} from './ProjectOptions';

/** Direct, request-scoped browser reads from the public Library API. */
export class CatalogClient {
    private static readonly MAX_PAGE_ITEMS: number = 12;
    private static readonly MAX_RESPONSE_BYTES: number = 1024 * 1024;
    private static readonly MAX_SELECTED_METADATA_BYTES: number = 4 * 1024 * 1024;
    private readonly base: URL;

    public constructor(base: string) {
        const configured: URL = new URL(base.replace(/\/*$/, '/') );
        if (!['http:', 'https:'].includes(configured.protocol) || configured.username.length > 0
            || configured.password.length > 0 || configured.search.length > 0 || configured.hash.length > 0) {
            throw new Error('The Library URL must be an HTTP(S) origin or path without credentials, query, or fragment.');
        }
        this.base = configured;
    }

    public async listed(page: number, query: string, tag: string, signal?: AbortSignal): Promise<CatalogPage> {
        if (!Number.isInteger(page) || page < 0 || page > 100000 || query.length > 100 || tag.length > 200) {
            throw new Error('Invalid catalog page or filter.');
        }
        const parameters: URLSearchParams = new URLSearchParams({
            states: 'LISTED', size: String(CatalogClient.MAX_PAGE_ITEMS), sort: 'name', direction: 'asc',
            page: String(page), q: query, tag
        });
        const result: unknown = await this.getJson(`api/extensions?${parameters}`, signal);
        if (!CatalogClient.isRecord(result) || !Array.isArray(result.items)
            || result.items.length > CatalogClient.MAX_PAGE_ITEMS || !Number.isInteger(result.totalPages)
            || (result.totalPages as number) < 0 || (result.totalPages as number) > 100000) {
            throw new Error('The Library backend returned an unexpected response.');
        }
        const items: LibraryModule[] = [];
        const identifiers: Set<number> = new Set();
        for (const value of result.items) {
            if (!CatalogClient.isRecord(value)) continue;
            const module: LibraryModule = value as LibraryModule;
            const identifier: number | undefined = module.githubRepositoryId;
            if (CatalogClient.isListed(module) && typeof identifier === 'number'
                && Number.isSafeInteger(identifier) && identifier > 0 && !identifiers.has(identifier)) {
                identifiers.add(identifier);
                items.push(module);
            }
        }
        return {items, page, totalPages: result.totalPages as number};
    }

    public async tags(signal?: AbortSignal): Promise<string[]> {
        const result: unknown = await this.getJson('api/extensions/tags?states=LISTED', signal);
        if (!Array.isArray(result) || result.length > 10000) throw new Error('The Library backend returned an unexpected response.');
        const tags: string[] = [];
        for (const value of result) {
            const name: unknown = CatalogClient.isRecord(value) ? value.name : value;
            if (typeof name === 'string' && name.length <= 200) tags.push(name);
        }
        return tags;
    }

    public async selected(options: ProjectOptions, signal?: AbortSignal): Promise<LibraryModule[]> {
        const modules: LibraryModule[] = [];
        let metadataBytes: number = 0;
        for (const identifier of options.modules) {
            const value: unknown = await this.getJson(`api/extensions/${identifier}`, signal);
            if (!CatalogClient.isRecord(value)) throw new Error('A selected module is no longer available. Refresh the catalog.');
            const module: LibraryModule = value as LibraryModule;
            if (!CatalogClient.isListed(module) || module.githubRepositoryId !== identifier) {
                throw new Error('A selected module is no longer listed. Refresh the catalog.');
            }
            if (!CatalogClient.compatible(module, options.platforms)) {
                throw new Error('A selected module does not support all selected platforms.');
            }
            metadataBytes += new TextEncoder().encode(JSON.stringify(module)).byteLength;
            if (metadataBytes > CatalogClient.MAX_SELECTED_METADATA_BYTES) {
                throw new Error('The selected module metadata is too large. Select fewer modules.');
            }
            modules.push(module);
        }
        return modules;
    }

    public static isListed(module: LibraryModule): boolean {
        return module.visibilityDecision === 'LISTED' && !['HIDDEN', 'BANNED'].includes(module.moderationState ?? '');
    }

    public static compatible(module: LibraryModule, selected: readonly string[]): boolean {
        const supported: Set<string> = new Set((module.platforms ?? []).map(platform => platform.operatingSystem ?? ''));
        for (const platform of selected) {
            const required: string[] = platform === 'desktop' ? ['WINDOWS', 'LINUX', 'MACOS'] : [platform.toUpperCase()];
            if (!required.every((name: string): boolean => supported.has(name))) return false;
        }
        return true;
    }

    private async getJson(path: string, signal?: AbortSignal): Promise<unknown> {
        const response: Response = await fetch(new URL(path, this.base), {
            signal, cache: 'no-store', headers: {'Accept': 'application/json'}
        });
        if (!response.ok) throw new Error('The Library backend is unavailable. Please retry shortly.');
        const length: number = Number(response.headers.get('content-length') ?? '0');
        if (Number.isFinite(length) && length > CatalogClient.MAX_RESPONSE_BYTES) {
            throw new Error('The Library response is too large.');
        }
        const body: string = await response.text();
        if (new TextEncoder().encode(body).byteLength > CatalogClient.MAX_RESPONSE_BYTES) {
            throw new Error('The Library response is too large.');
        }
        try {
            return JSON.parse(body) as unknown;
        } catch {
            throw new Error('The Library backend returned invalid JSON.');
        }
    }

    private static isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }
}
