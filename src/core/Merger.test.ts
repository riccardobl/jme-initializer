import {describe, expect, test} from 'vitest';
import {MergeField} from './MergeField';
import {Merger} from './Merger';

const encoder: TextEncoder = new TextEncoder();
const decoder: TextDecoder = new TextDecoder();

function createMerger(profiles: readonly string[] = [], fragments: Record<string, string> = {}): Merger {
    return new Merger(new Map([
        [MergeField.GAME_NAME_FULL, 'My Game!!'],
        [MergeField.GAME_NAME, 'MyGame'],
        [MergeField.GAME_PACKAGE, 'my.excellent.company.mygame'],
        [MergeField.GAME_PACKAGE_FOLDER, 'my/excellent/company/mygame'],
        [MergeField.JME_VERSION, '1']
    ]), profiles, (name: string): string | null => fragments[name] ?? null);
}

describe('Merger Java port', () => {
    test('mergePath', () => {
        const merger: Merger = createMerger(['DESKTOP']);
        expect(merger.mergePath('src/main/java/[GAME_PACKAGE_FOLDER]/[GAME_NAME].java'))
            .toBe('src/main/java/my/excellent/company/mygame/MyGame.java');
        expect(merger.mergePath('path/something.java.jmetemplate')).toBe('path/something.java');
        expect(merger.mergePath('[DOT]gitignore')).toBe('.gitignore');
    });

    test('mergeText', () => {
        const result: string = decoder.decode(createMerger().mergeFileContents(encoder.encode(
            'This is a test string for [GAME_NAME_FULL]. Open [GAME_NAME].java to start work.\n' +
            'Also, the package is [GAME_PACKAGE], fyi\n')));
        expect(result).toBe('This is a test string for My Game!!. Open MyGame.java to start work.\n' +
            'Also, the package is my.excellent.company.mygame, fyi\n');
    });

    test('mergeText_ifStatements', () => {
        const template: string = '[IF=A][IF=B]A and B[/IF=B][/IF=A]\n\n' +
            '[IF=A]A multiline\nvalue[/IF=A]\n\n[IF=MISSING]hidden[/IF=MISSING]\n\n' +
            '[IF=PROFILE]profile[/IF=PROFILE]\n';
        expect(decoder.decode(createMerger(['A', 'B', 'PROFILE']).mergeFileContents(encoder.encode(template))))
            .toBe('A and B\n\nA multiline\nvalue\n\n\nprofile\n');
    });

    test('mergeText_ifStatementsWithOrs', () => {
        const template: string = '[IF=A|MISSING]A[/IF=A|MISSING]\n[IF=MISSING_A|MISSING_B]hidden[/IF=MISSING_A|MISSING_B]\nNormal\n';
        expect(decoder.decode(createMerger(['A']).mergeFileContents(encoder.encode(template)))).toBe('A\nNormal\n');
        expect(createMerger(['A']).pathShouldBeAllowed('path[IF=A_OR_B]')).toBe(true);
    });

    test('mergeText_notStatements', () => {
        const template: string = 'Normal\n[NOT=A]hidden[/NOT=A]\n[NOT=C]shown[/NOT=C]\n';
        expect(decoder.decode(createMerger(['A']).mergeFileContents(encoder.encode(template)))).toBe('Normal\nshown\n');
    });

    test('pathShouldBeAllowed', () => {
        const merger: Merger = createMerger(['A', 'B', 'PROFILE']);
        expect(merger.pathShouldBeAllowed('common/path')).toBe(true);
        expect(merger.pathShouldBeAllowed('path/[IF=A]/path')).toBe(true);
        expect(merger.pathShouldBeAllowed('path/[NOT=C]/path')).toBe(true);
        expect(merger.pathShouldBeAllowed('path/[NOT=A]/path')).toBe(false);
        expect(merger.pathShouldBeAllowed('path/[IF=A]/[IF=C]/path')).toBe(false);
    });

    test('mergePath_librariesAndProfiles', () => {
        const merger: Merger = createMerger(['A', 'B', 'PROFILE']);
        expect(merger.mergePath('/path/something[IF=A]/path/[IF=B]/path')).toBe('path/something/path/path');
        expect(merger.mergePath('[NOT=PROFILE][IF=DESKTOP]/path1/path2[NOT=TAMARIN]')).toBe('path1/path2');
    });

    test('sanitiseToPackage', () => {
        expect(Merger.sanitiseToPackage('mySuggestedPackage£$', 'Game')).toBe('mysuggestedpackage.game');
        expect(Merger.sanitiseToPackage('..Co..Uk..Company..', 'Game')).toBe('co.uk.company.game');
        expect(Merger.sanitiseToPackage('co.uk.company.game', 'My Game')).toBe('co.uk.company.game.mygame');
    });

    test('convertPackageToFolder', () => {
        expect(Merger.convertPackageToFolder('my.suggested.package')).toBe('my/suggested/package');
    });

    test('sanitiseToJavaClass', () => {
        expect(Merger.sanitiseToJavaClass('!!!{}@~:@:@')).toBe('MyGame');
        expect(Merger.sanitiseToJavaClass('%My Amazing Game!!')).toBe('MyAmazingGame');
        expect(Merger.sanitiseToJavaClass('AlreadyCamelCase')).toBe('AlreadyCamelCase');
        expect(Merger.sanitiseToJavaClass('lower case sentence')).toBe('LowerCaseSentence');
        expect(Merger.sanitiseToJavaClass('  Sentence  with   excessive space  ')).toBe('SentenceWithExcessiveSpace');
    });

    test('fragmentsMergedCorrectly', () => {
        const merger: Merger = createMerger(['A'], {
            'fragA.fragment': '[IF=A]If works[/IF=A]\n',
            'fragB.fragment': '[GAME_NAME_FULL]\n'
        });
        const template: string = '[FRAGMENT=fragA.fragment]\nboo\n[FRAGMENT=fragB.fragment]\n';
        expect(decoder.decode(merger.mergeFileContents(encoder.encode(template)))).toBe('If works\n\nboo\nMy Game!!\n');
    });

    test('missing fragments and unresolved fields fail closed', () => {
        expect(() => createMerger().mergeFileContents(encoder.encode('[FRAGMENT=missing.fragment]'))).toThrow('Missing fragment');
        expect(() => createMerger().mergeFileContents(encoder.encode('[UNKNOWN_FIELD]'))).toThrow('Unresolved template instruction');
    });

    test('testEliminateEmptyLines', () => {
        expect(Merger.eliminateEmptyLines('test\n\n  \ntest')).toBe('test\ntest');
    });
});
