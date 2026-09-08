import type {EngineModuleDefinition} from '../config';
import {ModuleGradle} from './ModuleGradle';
import {ProjectOptions} from './ProjectOptions';

/** Converts configured jME core-module choices into target-specific Gradle dependencies. */
export class EngineModuleGradle {
    private readonly options: ProjectOptions;
    private readonly modules: EngineModuleDefinition[];

    public constructor(options: ProjectOptions) {
        this.options = options;
        this.modules = [];
        for (const module of options.config.requiredModules) {
            if (module.platforms === undefined || module.platforms.some((platform: string): boolean => options.platforms.includes(platform))) {
                this.add(module);
            }
        }
        for (const identifier of options.coreModules) this.add(options.config.coreModule(identifier));
        const allocatorModule: EngineModuleDefinition | undefined = options.config.allocator(options.allocator).module;
        if (allocatorModule !== undefined) this.add(allocatorModule);
    }

    public dependencies(target: string): string {
        let result: string = '';
        for (const module of this.modules.filter((item: EngineModuleDefinition): boolean => item.target === target)) {
            const notation: string = `org.jmonkeyengine:${module.id}:${this.options.config.jmeVersion}`;
            if (this.options.iosLegacy && module.id === this.options.config.iosLegacy.engineModuleId) {
                result += `    ${module.configuration}(${ModuleGradle.quote(notation)}) {\n`;
                for (const excluded of this.options.config.iosLegacy.excludedModules) {
                    result += `        exclude(group = ${ModuleGradle.quote(this.options.config.iosLegacy.group)}, module = ${ModuleGradle.quote(excluded)})\n`;
                }
                result += '    }\n';
                for (const legacyModule of this.options.config.iosLegacy.modules) {
                    const legacyNotation: string = `${this.options.config.iosLegacy.group}:${legacyModule}:${this.options.config.libJgliosPluginVersion}`;
                    result += `    implementation(${ModuleGradle.quote(legacyNotation)})\n`;
                }
            } else {
                result += `    ${module.configuration}(${ModuleGradle.quote(notation)})\n`;
            }
        }
        return result;
    }

    private add(module: EngineModuleDefinition): void {
        if (!this.modules.some((item: EngineModuleDefinition): boolean => item.id === module.id)) this.modules.push(module);
    }
}
