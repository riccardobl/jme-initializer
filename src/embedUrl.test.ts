import {expect, test} from 'vitest';
import {resolveInitializerUrl} from './embedUrl';

test('embed URL follows its script across custom domains and GitHub repository paths', () => {
    expect(resolveInitializerUrl('https://start.jmonkeyengine.org/embed.js').href)
        .toBe('https://start.jmonkeyengine.org/?embed=1');
    expect(resolveInitializerUrl('https://riccardobl.github.io/jme-initializer/embed.js').href)
        .toBe('https://riccardobl.github.io/jme-initializer/?embed=1');
});
