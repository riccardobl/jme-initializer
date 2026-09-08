import JSZip, {type JSZipObject} from 'jszip';
import {MergeField} from './MergeField';
import {Merger} from './Merger';
import {ModuleGradle} from './ModuleGradle';
import {ProjectOptions} from './ProjectOptions';
import type {LibraryModule} from './types';

export interface GeneratedProject {
    readonly blob: Blob;
    readonly files: ReadonlyMap<string, Uint8Array>;
}

/** Loads the build-time template archive and creates a project wholly in-browser. */
export class InitializerZipService {
    private static readonly MAX_TEMPLATE_ENTRIES: number = 256;
    private static readonly MAX_TEMPLATE_BYTES: number = 16 * 1024 * 1024;
    private readonly templateUrl: URL;
    private templatePromise: Promise<ArrayBuffer> | null = null;

    public constructor(templateUrl: URL) {
        this.templateUrl = templateUrl;
    }

    public async generate(options: ProjectOptions, modules: readonly LibraryModule[]): Promise<GeneratedProject> {
        this.validateModules(options, modules);
        const template: JSZip = await JSZip.loadAsync(await this.loadTemplate(), {createFolders: false, checkCRC32: true});
        const templateEntries: JSZipObject[] = Object.values(template.files).filter((entry: JSZipObject): boolean => !entry.dir);
        if (templateEntries.length > InitializerZipService.MAX_TEMPLATE_ENTRIES) throw new Error('The project template has too many entries.');

        const moduleGradle: ModuleGradle = new ModuleGradle(modules);
        const mergeData: Map<MergeField, string> = this.createMergeData(options, modules, moduleGradle);
        const profiles: Set<string> = new Set(options.launcherModules().map((module: string): string => module.toUpperCase()));
        for (const platform of options.platforms) profiles.add(platform.toUpperCase());
        const fragments: Map<string, string> = new Map();
        const merger: Merger = new Merger(mergeData, profiles, (name: string): string | null => fragments.get(name) ?? null);
        const output: JSZip = new JSZip();
        const files: Map<string, Uint8Array> = new Map();
        let uncompressedBytes: number = 0;

        for (const entry of templateEntries.sort((left: JSZipObject, right: JSZipObject): number => left.name.localeCompare(right.name))) {
            this.validateTemplatePath(entry.name);
            const bytes: Uint8Array = await entry.async('uint8array');
            uncompressedBytes += bytes.byteLength;
            if (uncompressedBytes > InitializerZipService.MAX_TEMPLATE_BYTES) throw new Error('The project template is too large.');
            if (entry.name.startsWith('_fragments/')) {
                fragments.set(entry.name.slice('_fragments/'.length), new TextDecoder('utf-8', {fatal: true}).decode(bytes));
                continue;
            }
            if (!merger.pathShouldBeAllowed(entry.name)) continue;
            const path: string = merger.mergePath(entry.name);
            this.validateOutputPath(path);
            const result: Uint8Array = this.isText(entry.name) ? merger.mergeFileContents(bytes) : bytes;
            if (files.has(path)) throw new Error(`The project template produced duplicate path ${path}`);
            files.set(path, result);
            output.file(path, result, {binary: true, unixPermissions: path === 'gradlew' ? 0o100755 : 0o100644, date: new Date(0)});
        }

        for (const module of modules) {
            const identifier: number | undefined = module.githubRepositoryId;
            if (identifier === undefined) continue;
            const path: string = `gradle/library-snippets/${identifier}.txt`;
            const bytes: Uint8Array = new TextEncoder().encode(module.gradleSnippet ?? '');
            files.set(path, bytes);
            output.file(path, bytes, {binary: true, unixPermissions: 0o100644, date: new Date(0)});
        }

        const blob: Blob = await output.generateAsync({
            type: 'blob', platform: 'UNIX', compression: 'DEFLATE', compressionOptions: {level: 9}
        });
        return {blob, files};
    }

    public async preview(options: ProjectOptions, modules: readonly LibraryModule[]): Promise<Map<string, string>> {
        const generated: GeneratedProject = await this.generate(options, modules);
        const preview: Map<string, string> = new Map();
        for (const [path, bytes] of generated.files.entries()) {
            if (path.endsWith('.gradle.kts') || path.endsWith('.properties')) {
                preview.set(path, new TextDecoder().decode(bytes));
            }
        }
        return preview;
    }

    private async loadTemplate(): Promise<ArrayBuffer> {
        if (this.templatePromise === null) {
            this.templatePromise = fetch(this.templateUrl, {cache: 'no-cache'}).then(async (response: Response): Promise<ArrayBuffer> => {
                if (!response.ok) throw new Error('The project template could not be loaded.');
                return response.arrayBuffer();
            }).catch((failure: unknown): never => {
                this.templatePromise = null;
                throw failure;
            });
        }
        return this.templatePromise;
    }

    private createMergeData(options: ProjectOptions, modules: readonly LibraryModule[], moduleGradle: ModuleGradle): Map<MergeField, string> {
        const desktopTargets: string = options.platforms.filter((value: string): boolean => ['windows', 'linux', 'macos'].includes(value))
            .map((value: string): string => ModuleGradle.quote(value)).join(', ');
        const moduleLinks: string = modules.map((module: LibraryModule): string =>
            `- https://jmonkeyengine.org/library/?module=${module.githubRepositoryId ?? ''}`).join('\n');
        return new Map<MergeField, string>([
            [MergeField.GAME_NAME_FULL, options.gameName],
            [MergeField.GAME_NAME, Merger.sanitiseToJavaClass(options.gameName)],
            [MergeField.GAME_PACKAGE, options.packageName],
            [MergeField.GAME_PACKAGE_FOLDER, Merger.convertPackageToFolder(options.packageName)],
            [MergeField.JME_VERSION, ProjectOptions.JME_VERSION],
            [MergeField.JAVA_VERSION, String(options.javaVersion)],
            [MergeField.ANDROID_MIN_SDK, String(options.androidMinSdk())],
            [MergeField.RENDERER, options.renderer === 'GLES3' ? 'ANGLE_GLES3' : `LWJGL_OPEN${options.renderer}`],
            [MergeField.DESKTOP_TARGETS, desktopTargets],
            [MergeField.PLATFORMS, options.launcherModules().map((value: string): string => `include(":platform-${value}")`).join('\n')],
            [MergeField.REPOSITORIES, moduleGradle.repositories()],
            [MergeField.DEPENDENCIES, moduleGradle.dependencies()],
            [MergeField.MODULE_LINKS, moduleLinks]
        ]);
    }

    private validateTemplatePath(path: string): void {
        if (path.startsWith('/') || path.includes('\\') || path.includes('\0') || path.split('/').includes('..')) {
            throw new Error(`Unsafe template path ${path}`);
        }
    }

    private validateModules(options: ProjectOptions, modules: readonly LibraryModule[]): void {
        const expected: Set<number> = new Set(options.modules);
        const actual: Set<number> = new Set();
        for (const module of modules) {
            const identifier: number | undefined = module.githubRepositoryId;
            if (identifier === undefined || !Number.isSafeInteger(identifier) || identifier <= 0
                || !expected.has(identifier) || actual.has(identifier)) {
                throw new Error('Selected module metadata does not match the project options.');
            }
            actual.add(identifier);
        }
        if (actual.size !== expected.size) throw new Error('Selected module metadata does not match the project options.');
    }

    private validateOutputPath(path: string): void {
        this.validateTemplatePath(path);
        if (path.length === 0 || path.length > 512 || path.includes('[') || path.includes(']')) {
            throw new Error(`Invalid generated path ${path}`);
        }
    }

    private isText(path: string): boolean {
        return !path.endsWith('.jar') && !path.endsWith('.png') && !path.endsWith('.jpg')
            && !path.endsWith('.jpeg') && !path.endsWith('.webp') && !path.endsWith('.gif');
    }
}
