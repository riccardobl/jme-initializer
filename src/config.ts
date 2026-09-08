export type DependencyConfiguration = 'api' | 'implementation' | 'runtimeOnly';

export interface PlatformDefinition {
    readonly id: string;
    readonly name: string;
    readonly launcher: string;
    readonly legacyOption: boolean;
}

export interface JavaVersionDefinition {
    readonly version: number;
    readonly name: string;
    readonly recommended: boolean;
    readonly platforms: readonly string[];
    readonly androidMinSdk?: number;
}

export interface RendererDefinition {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly summary: string;
    readonly recommended: boolean;
    readonly platforms: readonly string[];
    readonly requiresAnyPlatform: readonly string[];
    readonly settingsByPlatform: Readonly<Record<string, string>>;
}

export interface EngineModuleDefinition {
    readonly id: string;
    readonly name?: string;
    readonly description?: string;
    readonly target: string;
    readonly configuration: DependencyConfiguration;
    readonly platforms?: readonly string[];
    readonly profiles: readonly string[];
    readonly selectedByDefault: boolean;
}

export interface AllocatorDefinition {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly recommended: boolean;
    readonly platforms?: readonly string[];
    readonly module?: EngineModuleDefinition;
}

export interface IosLegacyDefinition {
    readonly name: string;
    readonly description: string;
    readonly engineModuleId: string;
    readonly group: string;
    readonly excludedModules: readonly string[];
    readonly modules: readonly string[];
}

/** Validated runtime configuration loaded from the repository's public config.json. */
export class InitializerConfig {
    public readonly libraryApiBase: string;
    public readonly templateArchiveUrl: URL;
    public readonly jmeVersion: string;
    public readonly libJgliosPluginVersion: string;
    public readonly nativeImagePluginVersion: string;
    public readonly foojayResolverVersion: string;
    public readonly androidGradlePluginVersion: string;
    public readonly platforms: readonly PlatformDefinition[];
    public readonly javaVersions: readonly JavaVersionDefinition[];
    public readonly renderers: readonly RendererDefinition[];
    public readonly requiredModules: readonly EngineModuleDefinition[];
    public readonly coreModules: readonly EngineModuleDefinition[];
    public readonly allocators: readonly AllocatorDefinition[];
    public readonly iosLegacy: IosLegacyDefinition;
    public readonly androidCompileSdk: number;
    public readonly androidTargetSdk: number;

    public constructor(document: unknown, sourceUrl: URL) {
        const root: Record<string, unknown> = InitializerConfig.record(document, 'configuration');
        const versions: Record<string, unknown> = InitializerConfig.record(root.versions, 'versions');
        const android: Record<string, unknown> = InitializerConfig.record(root.android, 'android');

        this.libraryApiBase = InitializerConfig.httpUrl(root.libraryApiBase, sourceUrl, 'Library API', true).href;
        this.templateArchiveUrl = InitializerConfig.httpUrl(root.templateArchiveUrl, sourceUrl, 'template archive', false);
        this.jmeVersion = InitializerConfig.text(versions.jme, 'versions.jme');
        this.libJgliosPluginVersion = InitializerConfig.text(versions.libJgliosPlugin, 'versions.libJgliosPlugin');
        this.nativeImagePluginVersion = InitializerConfig.text(versions.nativeImagePlugin, 'versions.nativeImagePlugin');
        this.foojayResolverVersion = InitializerConfig.text(versions.foojayResolver, 'versions.foojayResolver');
        this.androidGradlePluginVersion = InitializerConfig.text(versions.androidGradlePlugin, 'versions.androidGradlePlugin');
        this.androidCompileSdk = InitializerConfig.integer(android.compileSdk, 'android.compileSdk', 21, 100);
        this.androidTargetSdk = InitializerConfig.integer(android.targetSdk, 'android.targetSdk', 21, 100);

        this.platforms = InitializerConfig.array(root.platforms, 'platforms').map((value: unknown, index: number): PlatformDefinition => {
            const item: Record<string, unknown> = InitializerConfig.record(value, `platforms[${index}]`);
            return {
                id: InitializerConfig.identifier(item.id, `platforms[${index}].id`),
                name: InitializerConfig.text(item.name, `platforms[${index}].name`),
                launcher: InitializerConfig.identifier(item.launcher, `platforms[${index}].launcher`),
                legacyOption: item.legacyOption === true
            };
        });
        InitializerConfig.unique(this.platforms.map((item: PlatformDefinition): string => item.id), 'platform IDs');
        const platformIds: Set<string> = new Set(this.platforms.map((item: PlatformDefinition): string => item.id));
        const moduleTargets: Set<string> = new Set(['app', ...this.platforms.map((item: PlatformDefinition): string => item.launcher)]);

        this.javaVersions = InitializerConfig.array(root.javaVersions, 'javaVersions').map((value: unknown, index: number): JavaVersionDefinition => {
            const item: Record<string, unknown> = InitializerConfig.record(value, `javaVersions[${index}]`);
            const platforms: string[] = InitializerConfig.references(item.platforms, `javaVersions[${index}].platforms`, platformIds);
            const androidMinSdk: number | undefined = item.androidMinSdk === undefined ? undefined
                : InitializerConfig.integer(item.androidMinSdk, `javaVersions[${index}].androidMinSdk`, 21, 100);
            return {
                version: InitializerConfig.integer(item.version, `javaVersions[${index}].version`, 8, 100),
                name: InitializerConfig.text(item.name, `javaVersions[${index}].name`),
                recommended: item.recommended === true,
                platforms,
                ...(androidMinSdk === undefined ? {} : {androidMinSdk})
            };
        });
        InitializerConfig.unique(this.javaVersions.map((item: JavaVersionDefinition): string => String(item.version)), 'Java versions');

        this.renderers = InitializerConfig.array(root.renderers, 'renderers').map((value: unknown, index: number): RendererDefinition => {
            const item: Record<string, unknown> = InitializerConfig.record(value, `renderers[${index}]`);
            const settings: Record<string, unknown> = InitializerConfig.record(item.settingsByPlatform, `renderers[${index}].settingsByPlatform`);
            const settingsByPlatform: Record<string, string> = {};
            for (const [platform, setting] of Object.entries(settings)) {
                if (!platformIds.has(platform)) throw new Error(`Unknown platform ${platform} in renderer settings.`);
                settingsByPlatform[platform] = InitializerConfig.javaConstant(setting, `renderers[${index}].settingsByPlatform.${platform}`);
            }
            return {
                id: InitializerConfig.identifier(item.id, `renderers[${index}].id`),
                name: InitializerConfig.text(item.name, `renderers[${index}].name`),
                description: InitializerConfig.text(item.description, `renderers[${index}].description`),
                summary: InitializerConfig.text(item.summary, `renderers[${index}].summary`),
                recommended: item.recommended === true,
                platforms: InitializerConfig.references(item.platforms, `renderers[${index}].platforms`, platformIds),
                requiresAnyPlatform: item.requiresAnyPlatform === undefined ? []
                    : InitializerConfig.references(item.requiresAnyPlatform, `renderers[${index}].requiresAnyPlatform`, platformIds),
                settingsByPlatform
            };
        });
        InitializerConfig.unique(this.renderers.map((item: RendererDefinition): string => item.id), 'renderer IDs');

        this.requiredModules = InitializerConfig.array(root.requiredModules, 'requiredModules')
            .map((value: unknown, index: number): EngineModuleDefinition =>
                InitializerConfig.module(value, `requiredModules[${index}]`, platformIds, moduleTargets, false));
        this.coreModules = InitializerConfig.array(root.coreModules, 'coreModules')
            .map((value: unknown, index: number): EngineModuleDefinition =>
                InitializerConfig.module(value, `coreModules[${index}]`, platformIds, moduleTargets, true));
        InitializerConfig.unique([...this.requiredModules, ...this.coreModules]
            .map((item: EngineModuleDefinition): string => item.id), 'engine module IDs');

        this.allocators = InitializerConfig.array(root.allocators, 'allocators').map((value: unknown, index: number): AllocatorDefinition => {
            const item: Record<string, unknown> = InitializerConfig.record(value, `allocators[${index}]`);
            return {
                id: InitializerConfig.identifier(item.id, `allocators[${index}].id`),
                name: InitializerConfig.text(item.name, `allocators[${index}].name`),
                description: InitializerConfig.text(item.description, `allocators[${index}].description`),
                recommended: item.recommended === true,
                ...(item.platforms === undefined ? {} : {platforms: InitializerConfig.references(item.platforms, `allocators[${index}].platforms`, platformIds)}),
                ...(item.module === undefined ? {} : {module: InitializerConfig.module(item.module, `allocators[${index}].module`, platformIds, moduleTargets, false)})
            };
        });
        InitializerConfig.unique(this.allocators.map((item: AllocatorDefinition): string => item.id), 'allocator IDs');

        const legacy: Record<string, unknown> = InitializerConfig.record(root.iosLegacy, 'iosLegacy');
        this.iosLegacy = {
            name: InitializerConfig.text(legacy.name, 'iosLegacy.name'),
            description: InitializerConfig.text(legacy.description, 'iosLegacy.description'),
            engineModuleId: InitializerConfig.identifier(legacy.engineModuleId, 'iosLegacy.engineModuleId'),
            group: InitializerConfig.identifier(legacy.group, 'iosLegacy.group'),
            excludedModules: InitializerConfig.identifiers(legacy.excludedModules, 'iosLegacy.excludedModules'),
            modules: InitializerConfig.identifiers(legacy.modules, 'iosLegacy.modules')
        };
        if (!this.requiredModules.some((module: EngineModuleDefinition): boolean =>
            module.id === this.iosLegacy.engineModuleId && module.target === 'ios')) {
            throw new Error('iosLegacy.engineModuleId must reference a required iOS module.');
        }

        InitializerConfig.exactlyOneRecommended(this.javaVersions, 'Java version');
        InitializerConfig.exactlyOneRecommended(this.renderers, 'renderer');
        InitializerConfig.exactlyOneRecommended(this.allocators, 'allocator');
        if (this.platforms.length === 0 || this.javaVersions.length === 0 || this.renderers.length === 0 || this.allocators.length === 0) {
            throw new Error('Configuration option lists cannot be empty.');
        }
    }

    public static async load(url: URL): Promise<InitializerConfig> {
        const response: Response = await fetch(url, {cache: 'no-cache'});
        if (!response.ok) throw new Error(`Initializer configuration could not be loaded (${response.status}).`);
        return new InitializerConfig(await response.json(), url);
    }

    public platform(id: string): PlatformDefinition {
        const result: PlatformDefinition | undefined = this.platforms.find((item: PlatformDefinition): boolean => item.id === id);
        if (result === undefined) throw new Error(`Unknown platform ${id}.`);
        return result;
    }

    public javaVersion(version: number): JavaVersionDefinition {
        const result: JavaVersionDefinition | undefined = this.javaVersions.find((item: JavaVersionDefinition): boolean => item.version === version);
        if (result === undefined) throw new Error(`Unknown Java version ${version}.`);
        return result;
    }

    public renderer(id: string): RendererDefinition {
        const result: RendererDefinition | undefined = this.renderers.find((item: RendererDefinition): boolean => item.id === id);
        if (result === undefined) throw new Error(`Unknown renderer ${id}.`);
        return result;
    }

    public allocator(id: string): AllocatorDefinition {
        const result: AllocatorDefinition | undefined = this.allocators.find((item: AllocatorDefinition): boolean => item.id === id);
        if (result === undefined) throw new Error(`Unknown allocator ${id}.`);
        return result;
    }

    public coreModule(id: string): EngineModuleDefinition {
        const result: EngineModuleDefinition | undefined = this.coreModules.find((item: EngineModuleDefinition): boolean => item.id === id);
        if (result === undefined) throw new Error(`Unknown core module ${id}.`);
        return result;
    }

    public recommendedJavaVersion(): JavaVersionDefinition {
        return this.javaVersions.find((item: JavaVersionDefinition): boolean => item.recommended) as JavaVersionDefinition;
    }

    public recommendedRenderer(): RendererDefinition {
        return this.renderers.find((item: RendererDefinition): boolean => item.recommended) as RendererDefinition;
    }

    public recommendedAllocator(): AllocatorDefinition {
        return this.allocators.find((item: AllocatorDefinition): boolean => item.recommended) as AllocatorDefinition;
    }

    private static module(value: unknown, label: string, platformIds: ReadonlySet<string>, moduleTargets: ReadonlySet<string>,
                          requireDisplay: boolean): EngineModuleDefinition {
        const item: Record<string, unknown> = InitializerConfig.record(value, label);
        const name: string | undefined = item.name === undefined ? undefined : InitializerConfig.text(item.name, `${label}.name`);
        const description: string | undefined = item.description === undefined ? undefined : InitializerConfig.text(item.description, `${label}.description`);
        if (requireDisplay && (name === undefined || description === undefined)) throw new Error(`${label} requires a name and description.`);
        const configuration: string = item.configuration === undefined ? 'implementation' : InitializerConfig.text(item.configuration, `${label}.configuration`);
        if (!['api', 'implementation', 'runtimeOnly'].includes(configuration)) throw new Error(`${label}.configuration is invalid.`);
        const target: string = item.target === undefined ? 'app' : InitializerConfig.identifier(item.target, `${label}.target`);
        if (!moduleTargets.has(target)) throw new Error(`${label}.target references an unknown launcher.`);
        return {
            id: InitializerConfig.identifier(item.id, `${label}.id`),
            ...(name === undefined ? {} : {name}),
            ...(description === undefined ? {} : {description}),
            target,
            configuration: configuration as DependencyConfiguration,
            ...(item.platforms === undefined ? {} : {platforms: InitializerConfig.references(item.platforms, `${label}.platforms`, platformIds)}),
            profiles: item.profiles === undefined ? [] : InitializerConfig.identifiers(item.profiles, `${label}.profiles`),
            selectedByDefault: item.selectedByDefault === true
        };
    }

    private static httpUrl(value: unknown, sourceUrl: URL, label: string, directory: boolean): URL {
        let raw: string = InitializerConfig.text(value, label);
        if (directory) raw = raw.replace(/\/*$/, '/');
        const url: URL = new URL(raw, sourceUrl);
        if (!['http:', 'https:'].includes(url.protocol) || url.username.length > 0 || url.password.length > 0
            || url.hash.length > 0 || (directory && url.search.length > 0)) {
            throw new Error(`The ${label} URL must use HTTP(S) without credentials${directory ? ', query or fragment' : ' or fragment'}.`);
        }
        return url;
    }

    private static record(value: unknown, label: string): Record<string, unknown> {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${label} must be an object.`);
        return value as Record<string, unknown>;
    }

    private static array(value: unknown, label: string): unknown[] {
        if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
        return value;
    }

    private static text(value: unknown, label: string): string {
        if (typeof value !== 'string' || value.trim().length === 0 || value.length > 2048 || /[\u0000-\u001f\u007f]/.test(value)) {
            throw new Error(`${label} must be non-empty text.`);
        }
        return value.trim();
    }

    private static identifier(value: unknown, label: string): string {
        const result: string = InitializerConfig.text(value, label);
        if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(result)) throw new Error(`${label} must be an identifier.`);
        return result;
    }

    private static javaConstant(value: unknown, label: string): string {
        const result: string = InitializerConfig.text(value, label);
        if (!/^[A-Z][A-Z0-9_]{0,127}$/.test(result)) throw new Error(`${label} must be an AppSettings constant.`);
        return result;
    }

    private static integer(value: unknown, label: string, minimum: number, maximum: number): number {
        if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
            throw new Error(`${label} must be an integer between ${minimum} and ${maximum}.`);
        }
        return value as number;
    }

    private static identifiers(value: unknown, label: string): string[] {
        const result: string[] = InitializerConfig.array(value, label)
            .map((item: unknown, index: number): string => InitializerConfig.identifier(item, `${label}[${index}]`));
        InitializerConfig.unique(result, label);
        return result;
    }

    private static references(value: unknown, label: string, choices: ReadonlySet<string>): string[] {
        const result: string[] = InitializerConfig.identifiers(value, label);
        if (result.length === 0 || result.some((item: string): boolean => !choices.has(item))) {
            throw new Error(`${label} contains an unknown platform.`);
        }
        return result;
    }

    private static unique(values: readonly string[], label: string): void {
        if (new Set(values).size !== values.length) throw new Error(`${label} must be unique.`);
    }

    private static exactlyOneRecommended(values: readonly {recommended: boolean}[], label: string): void {
        if (values.filter((item: {recommended: boolean}): boolean => item.recommended).length !== 1) {
            throw new Error(`Exactly one ${label} must be recommended.`);
        }
    }
}
