import {describe, expect, test} from 'vitest';
import {GameIcon} from './GameIcon';

describe('GameIcon', () => {
    test('accepts supported browser image uploads within the limit', () => {
        expect(() => GameIcon.validateUpload({type: 'image/png', size: 1024})).not.toThrow();
        expect(() => GameIcon.validateUpload({type: 'image/jpeg', size: 1024})).not.toThrow();
        expect(() => GameIcon.validateUpload({type: 'image/webp', size: 1024})).not.toThrow();
    });

    test('rejects unsupported and oversized uploads before decoding', () => {
        expect(() => GameIcon.validateUpload({type: 'image/svg+xml', size: 1024})).toThrow('PNG, JPEG or WebP');
        expect(() => GameIcon.validateUpload({type: 'image/png', size: 13 * 1024 * 1024})).toThrow('12 MB');
    });
});
