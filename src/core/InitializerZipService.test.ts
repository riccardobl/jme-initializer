import {readFile} from 'node:fs/promises';
import JSZip from 'jszip';
import {afterEach, describe, expect, test, vi} from 'vitest';
import {InitializerZipService} from './InitializerZipService';
import {ProjectOptions} from './ProjectOptions';

describe('InitializerZipService', () => {
    afterEach(() => vi.unstubAllGlobals());

    test('merges the build archive into a complete desktop project in the browser', async () => {
        const archive: Buffer = await readFile(new URL('../../public/template.zip', import.meta.url));
        const body: ArrayBuffer = new Uint8Array(archive).buffer;
        vi.stubGlobal('fetch', vi.fn(async (): Promise<Response> => new Response(body)));
        const service: InitializerZipService = new InitializerZipService(new URL('https://start.example/template.zip'));
        const options: ProjectOptions = new ProjectOptions('Space Racer', 'org.example.game', ['windows', 'linux'], 21, 'GL32', []);
        const generated = await service.generate(options, []);
        const output: JSZip = await JSZip.loadAsync(await generated.blob.arrayBuffer());

        expect(Object.keys(output.files)).toContain('app/src/main/java/org/example/game/Main.java');
        expect(Object.keys(output.files)).toContain('platform-desktop/src/main/java/org/example/game/desktop/DesktopLauncher.java');
        expect(Object.keys(output.files).some(path => path.startsWith('platform-android'))).toBe(false);
        expect(await output.file('settings.gradle.kts')?.async('string')).toContain('include(":platform-desktop")');
        expect(await output.file('platform-desktop/src/main/java/org/example/game/desktop/DesktopLauncher.java')?.async('string'))
            .toContain('AppSettings.LWJGL_OPENGL32');
        expect(output.file('gradle/wrapper/gradle-wrapper.jar')).not.toBeNull();
        expect(output.file('gradlew')?.unixPermissions).toBe(0o100755);
        expect([...generated.files.keys()].some(path => path.includes('[') || path.includes(']'))).toBe(false);
    });
});
