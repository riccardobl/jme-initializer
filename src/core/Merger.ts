import {getMergeFieldInText, MergeField} from './MergeField';

export type FragmentSupplier = (name: string) => string | null;

/**
 * Java-like TypeScript port of Richard Tingle's original Merger.
 *
 * It keeps the original merge-field, path-condition, text-condition,
 * fragment, .jmetemplate and [DOT] semantics. The implementation is explicit
 * on purpose: the TypeScript should remain easy to compare with the Java.
 */
export class Merger {
    private readonly mergeIfConditionPattern: RegExp = /\[IF=([^\]]*)]/g;
    private readonly mergeNotConditionPattern: RegExp = /\[NOT=([^\]]*)]/g;
    private readonly fragmentPattern: RegExp = /\[FRAGMENT=([a-zA-Z0-9./]*)]/g;
    private readonly mergeData: Map<MergeField, string>;
    private readonly libraryKeysAndProfilesInUse: Set<string>;
    private readonly fragmentSupplier: FragmentSupplier;

    public constructor(mergeData: Map<MergeField, string>, profiles: Iterable<string>,
                       fragmentSupplier: FragmentSupplier = () => null) {
        this.mergeData = new Map(mergeData);
        this.libraryKeysAndProfilesInUse = new Set(profiles);
        this.fragmentSupplier = fragmentSupplier;
    }

    public pathShouldBeAllowed(pathTemplate: string): boolean {
        for (const condition of this.findConditions(pathTemplate, this.mergeIfConditionPattern)) {
            if (!this.libraryConditionStringPasses(condition)) return false;
        }
        for (const condition of this.findConditions(pathTemplate, this.mergeNotConditionPattern)) {
            if (this.libraryConditionStringPasses(condition)) return false;
        }
        return true;
    }

    public mergePath(pathTemplate: string): string {
        let path: string = pathTemplate;
        for (const [field, value] of this.mergeData.entries()) {
            path = path.split(getMergeFieldInText(field)).join(value);
        }
        path = path.replace(/\[IF=([^=]*)]/g, '');
        path = path.replace(/\[NOT=([^=]*)]/g, '');
        path = path.replace(/\/{2,}/g, '/');
        path = path.replace('.jmetemplate', '');
        path = path.replace(/^\//, '');
        path = path.replaceAll('[DOT]', '.');
        return path;
    }

    /** Treats the byte array as a UTF-8 string and merges it, like the Java method. */
    public mergeFileContents(fileContents: Uint8Array): Uint8Array {
        const decoder: TextDecoder = new TextDecoder('utf-8', {fatal: true});
        const encoder: TextEncoder = new TextEncoder();
        let fileContentsAsString: string = decoder.decode(fileContents);

        let fragmentMatch: RegExpExecArray | null = this.firstMatch(this.fragmentPattern, fileContentsAsString);
        while (fragmentMatch !== null) {
            const fragmentFile: string = fragmentMatch[1] ?? '';
            const fragmentContent: string | null = this.fragmentSupplier(fragmentFile);
            if (fragmentContent === null) throw new Error(`Missing fragment ${fragmentFile}`);
            fileContentsAsString = fileContentsAsString.split(fragmentMatch[0]).join(fragmentContent);
            fragmentMatch = this.firstMatch(this.fragmentPattern, fileContentsAsString);
        }

        for (const [field, value] of this.mergeData.entries()) {
            const mergeKey: string = getMergeFieldInText(field);
            fileContentsAsString = fileContentsAsString.split(/\r?\n/).map((line: string): string => {
                if (!line.includes(mergeKey)) return line;
                if (this.countMatches(line, mergeKey) !== 1) return line.split(mergeKey).join(value);
                const indentation: number = line.indexOf(mergeKey);
                const indentationString: string = ' '.repeat(indentation);
                const indentedMergeData: string = value.split(/\r?\n/)
                    .map((mergeLine: string): string => indentationString + mergeLine).join('\n');
                return line.replace(indentationString + mergeKey, indentedMergeData).replace(mergeKey, value);
            }).join('\n');
        }

        for (const validProfile of this.libraryKeysAndProfilesInUse) {
            fileContentsAsString = fileContentsAsString.split(`[IF=${validProfile}]`).join('');
            fileContentsAsString = fileContentsAsString.split(`[/IF=${validProfile}]`).join('');
        }
        fileContentsAsString = this.processIfStatements(fileContentsAsString);
        this.assertNoUnresolvedTemplateInstructions(fileContentsAsString);
        return encoder.encode(fileContentsAsString.replace(/\n*$/, '') + '\n');
    }

    private processIfStatements(fileContentsAsString: string): string {
        const foundIfConditions: Set<string> = new Set(this.findConditions(fileContentsAsString, this.mergeIfConditionPattern));
        const foundNotConditions: Set<string> = new Set(this.findConditions(fileContentsAsString, this.mergeNotConditionPattern));
        const failingIfConditions: Set<string> = new Set();
        const failingNotConditions: Set<string> = new Set();

        for (const condition of foundIfConditions) {
            if (this.libraryConditionStringPasses(condition)) {
                fileContentsAsString = fileContentsAsString.split(`[IF=${condition}]`).join('');
                fileContentsAsString = fileContentsAsString.split(`[/IF=${condition}]`).join('');
            } else {
                failingIfConditions.add(condition);
            }
        }
        for (const condition of foundNotConditions) {
            if (!this.libraryConditionStringPasses(condition)) {
                fileContentsAsString = fileContentsAsString.split(`[NOT=${condition}]`).join('');
                fileContentsAsString = fileContentsAsString.split(`[/NOT=${condition}]`).join('');
            } else {
                failingNotConditions.add(condition);
            }
        }

        for (let pass: number = 0; pass < 2; pass++) {
            for (const condition of failingIfConditions) {
                const quoted: string = this.quoteRegExp(condition);
                fileContentsAsString = fileContentsAsString.replace(
                    new RegExp(`\\[IF=${quoted}]((?!IF=).)*?\\[/IF=${quoted}]`, 'gs'), '_eliminated_');
            }
            for (const condition of failingNotConditions) {
                const quoted: string = this.quoteRegExp(condition);
                fileContentsAsString = fileContentsAsString.replace(
                    new RegExp(`\\[NOT=${quoted}]((?!NOT=).)*?\\[/NOT=${quoted}]`, 'gs'), '_eliminated_');
            }
            fileContentsAsString = fileContentsAsString.replace(/\r?\n *_eliminated_ *\r?\n/g, '\n');
            fileContentsAsString = fileContentsAsString.replaceAll('_eliminated_', '');
        }
        return fileContentsAsString;
    }

    private libraryConditionStringPasses(condition: string): boolean {
        const alternatives: string[] = condition.replaceAll('_OR_', '|').split('|');
        for (const alternative of alternatives) {
            if (this.libraryKeysAndProfilesInUse.has(alternative)) return true;
        }
        return false;
    }

    private findConditions(input: string, pattern: RegExp): string[] {
        const values: string[] = [];
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(input)) !== null) values.push(match[1] ?? '');
        pattern.lastIndex = 0;
        return values;
    }

    private firstMatch(pattern: RegExp, input: string): RegExpExecArray | null {
        pattern.lastIndex = 0;
        const match: RegExpExecArray | null = pattern.exec(input);
        pattern.lastIndex = 0;
        return match;
    }

    private countMatches(input: string, match: string): number {
        return input.split(match).length - 1;
    }

    private quoteRegExp(input: string): string {
        return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    private assertNoUnresolvedTemplateInstructions(input: string): void {
        const unresolved: RegExpMatchArray | null = input.match(/\[(?:\/?(?:IF|NOT)=[^\]]+|FRAGMENT=[^\]]+|[A-Z][A-Z0-9_]+)]/);
        if (unresolved !== null) throw new Error(`Unresolved template instruction ${unresolved[0]}`);
    }

    public static sanitiseToPackage(proposedPackage: string, proposedGameName: string): string {
        let gamePackage: string = proposedPackage;
        const sanitisedGameName: string = Merger.sanitiseToJavaClass(proposedGameName).toLowerCase();
        if (!gamePackage.toLowerCase().includes(sanitisedGameName)) gamePackage += `.${sanitisedGameName}`;
        gamePackage = gamePackage.toLowerCase().replaceAll(' ', '.');
        gamePackage = gamePackage.replace(/\.{2,}/g, '.').replace(/\.$/, '').replace(/^\./, '');
        return gamePackage.replace(/[^a-z.]/g, '');
    }

    public static convertPackageToFolder(fullPackage: string): string {
        return fullPackage.replaceAll('.', '/');
    }

    public static sanitiseToJavaClass(proposedName: string): string {
        let value: string = proposedName.replace(/[^a-zA-Z ]/g, '');
        if (value.trim().length === 0) value = 'MyGame';
        if (value.includes(' ') || /^[a-z]/.test(value)) {
            value = value.trim().split(/[ _]+/).filter(Boolean)
                .map((word: string): string => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join('');
        }
        return value;
    }

    public static eliminateEmptyLines(input: string): string {
        return input.split(/\r?\n/).filter((line: string): boolean => line.trim().length > 0).join('\n');
    }
}
