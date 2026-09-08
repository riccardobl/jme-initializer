import {afterEach, describe, expect, test, vi} from 'vitest';
import {CatalogClient} from './CatalogClient';
import {ProjectOptions} from './ProjectOptions';

describe('CatalogClient', () => {
    afterEach(() => vi.unstubAllGlobals());

    test('reads the public Library API directly without caching', async () => {
        let requested: URL | null = null;
        let requestInit: RequestInit | undefined;
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            requested = input as URL;
            requestInit = init;
            return new Response(JSON.stringify({
            items: [{githubRepositoryId: 42, visibilityDecision: 'LISTED', moderationState: 'ACCEPTED'}],
            totalPages: 3
            }), {status: 200, headers: {'Content-Type': 'application/json'}});
        });
        vi.stubGlobal('fetch', fetchMock);
        const client: CatalogClient = new CatalogClient('https://library.example/base/');
        const page = await client.listed(1, 'physics engine', 'physics');

        expect(page.items.map(module => module.githubRepositoryId)).toEqual([42]);
        expect(page.totalPages).toBe(3);
        expect((requested as URL | null)?.href).toBe('https://library.example/base/api/extensions?states=LISTED&size=12&sort=name&direction=asc&page=1&q=physics+engine&tag=physics');
        expect(requestInit).toMatchObject({cache: 'no-store'});
    });

    test('refetches selected metadata and rejects entries that are no longer listed', async () => {
        vi.stubGlobal('fetch', vi.fn(async (): Promise<Response> => new Response(JSON.stringify({
            githubRepositoryId: 42, visibilityDecision: 'HIDDEN', moderationState: 'HIDDEN'
        }))));
        const client: CatalogClient = new CatalogClient('https://library.example/');
        const options: ProjectOptions = new ProjectOptions('Game', 'com.game', ['windows'], 11, 'GLES3', [42]);
        await expect(client.selected(options)).rejects.toThrow('no longer listed');
    });

    test('requires every selected operating system', () => {
        const module = {platforms: [{operatingSystem: 'WINDOWS'}, {operatingSystem: 'LINUX'}]};
        expect(CatalogClient.compatible(module, ['windows', 'linux'])).toBe(true);
        expect(CatalogClient.compatible(module, ['windows', 'macos'])).toBe(false);
    });
});
