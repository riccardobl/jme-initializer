import {readFile} from 'node:fs/promises';
import JSZip from 'jszip';
import {afterEach, beforeAll, describe, expect, test, vi} from 'vitest';
import {InitializerConfig} from '../config';
import {InitializerZipService} from './InitializerZipService';
import {ProjectOptions} from './ProjectOptions';

let config: InitializerConfig;

describe('InitializerZipService', () => {
    beforeAll(async () => {
        const document: unknown = JSON.parse(await readFile(new URL('../../public/config.json', import.meta.url), 'utf8'));
        config = new InitializerConfig(document, new URL('https://initializer.example/config.json'));
    });
    afterEach(() => vi.unstubAllGlobals());

    test('merges the build archive into a complete desktop project in the browser', async () => {
        const archive: Buffer = await readFile(new URL('../../public/template.zip', import.meta.url));
        const body: ArrayBuffer = new Uint8Array(archive).buffer;
        vi.stubGlobal('fetch', vi.fn(async (): Promise<Response> => new Response(body)));
        const service: InitializerZipService = new InitializerZipService(new URL('https://start.example/template.zip'));
        const options: ProjectOptions = new ProjectOptions(config, 'Space Racer', 'org.example.game', ['windows', 'linux'], 21,
            'GL32', [], ['jme3-awt-dialogs'], 'safer', false);
        const customIcon: Uint8Array = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
        const generated = await service.generate(options, [], customIcon);
        const output: JSZip = await JSZip.loadAsync(await generated.blob.arrayBuffer());

        expect(Object.keys(output.files)).toContain('app/src/main/java/org/example/game/Main.java');
        expect(Object.keys(output.files)).toContain('platform-desktop/src/main/java/org/example/game/desktop/DesktopLauncher.java');
        expect(Object.keys(output.files).some(path => path.startsWith('platform-android'))).toBe(false);
        expect(await output.file('settings.gradle.kts')?.async('string')).toContain('include(":platform-desktop")');
        expect(await output.file('platform-desktop/src/main/java/org/example/game/desktop/DesktopLauncher.java')?.async('string'))
            .toContain('settings.setRenderer(AppSettings.LWJGL_OPENGL32)');
        expect(await output.file('platform-desktop/src/main/java/org/example/game/desktop/DesktopLauncher.java')?.async('string'))
            .toContain('game.setShowSettings(true)');
        expect(await output.file('app/build.gradle.kts')?.async('string')).toContain('jme3-saferallocator:3.10.0-beta2');
        expect(await output.file('icon.png')?.async('uint8array')).toEqual(customIcon);
        expect(output.file('gradle/wrapper/gradle-wrapper.jar')).not.toBeNull();
        expect(output.file('gradlew')?.unixPermissions).toBe(0o100755);
        expect([...generated.files.keys()].some(path => path.includes('[') || path.includes(']'))).toBe(false);
    });

    test('generates build-time Android icons and the documented legacy iOS dependency replacement', async () => {
        const archive: Buffer = await readFile(new URL('../../public/template.zip', import.meta.url));
        vi.stubGlobal('fetch', vi.fn(async (): Promise<Response> => new Response(new Uint8Array(archive).buffer)));
        const service: InitializerZipService = new InitializerZipService(new URL('https://start.example/template.zip'));
        const options: ProjectOptions = new ProjectOptions(config, 'Mobile Game', 'org.example.mobile', ['windows', 'android', 'ios'],
            21, 'GL45', [], ['jme3-effects'], 'platform', true);
        const generated = await service.generate(options, []);
        const output: JSZip = await JSZip.loadAsync(await generated.blob.arrayBuffer());
        const androidGradle: string = await output.file('platform-android/build.gradle.kts')?.async('string') ?? '';
        const manifest: string = await output.file('platform-android/src/main/AndroidManifest.xml')?.async('string') ?? '';
        const iosGradle: string = await output.file('platform-ios/build.gradle.kts')?.async('string') ?? '';
        const desktopLauncher: string = await output.file('platform-desktop/src/main/java/org/example/mobile/desktop/DesktopLauncher.java')?.async('string') ?? '';
        const appGradle: string = await output.file('app/build.gradle.kts')?.async('string') ?? '';
        const icon: Uint8Array = await output.file('icon.png')?.async('uint8array') ?? new Uint8Array();

        expect(androidGradle).toContain('gradle/libs/android-icon-gen.gradle');
        expect(androidGradle).toContain('dependsOn(generateAndroidLauncherIcons)');
        expect(output.file('gradle/libs/android-icon-gen.gradle')).not.toBeNull();
        expect(manifest).toContain('android:icon="@mipmap/ic_launcher"');
        expect(manifest).toContain('android:roundIcon="@mipmap/ic_launcher_round"');
        expect(iosGradle).toContain('id("org.ngengine.libjglios") version "0.10"');
        expect(iosGradle).toContain('id("org.jmonkeyengine.nativeimage") version "3.10.0-beta2"');
        expect(iosGradle).toContain('appIcon.set(rootProject.file("icon.png"))');
        expect((iosGradle.match(/exclude\(group = "org\.ngengine"/g) ?? [])).toHaveLength(5);
        expect(iosGradle).toContain('org.ngengine:libjglios-legacy-core-ios:0.10');
        expect(iosGradle).toContain('org.ngengine:libjglios-legacy-gles-ios:0.10');
        expect(iosGradle).toContain('org.ngengine:libjglios-sdl3-ios:0.10');
        expect(iosGradle).toContain('org.ngengine:libjglios-openal-ios:0.10');
        expect(appGradle).toContain('jme3-effects:3.10.0-beta2');
        expect(appGradle).not.toContain('jme3-saferallocator');
        expect(desktopLauncher).not.toContain('setResolution');
        expect(desktopLauncher).not.toContain('setVSync');
        expect(desktopLauncher).toContain('settings.setRenderer(AppSettings.LWJGL_OPENGL45)');
        expect(new DataView(icon.buffer, icon.byteOffset, icon.byteLength).getUint32(16)).toBe(1024);
        expect(new DataView(icon.buffer, icon.byteOffset, icon.byteLength).getUint32(20)).toBe(1024);
    });
});
