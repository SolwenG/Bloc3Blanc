// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderComment } from './renderComment';

const parse = (content) => {
    const container = document.createElement('div');
    container.innerHTML = renderComment(content);
    return container;
};

describe('formats acceptés', () => {
    it('F01 - garde le texte simple et ses sauts de ligne', () => {
        const result = parse('Ligne 1\nLigne 2');
        expect(result.textContent).toContain('Ligne 1');
        expect(result.querySelectorAll('br')).toHaveLength(1);
    });

    it('F02 - interprète le Markdown', () => {
        const result = parse('**gras** et `code`\n\n- un\n- deux\n\n> citation');
        expect(result.querySelector('strong').textContent).toBe('gras');
        expect(result.querySelector('code').textContent).toBe('code');
        expect(result.querySelectorAll('li')).toHaveLength(2);
        expect(result.querySelector('blockquote')).not.toBeNull();
    });

    it('F03 - garde le HTML de mise en forme', () => {
        const result = parse('<b>gras</b> <em>italique</em>');
        expect(result.querySelector('b').textContent).toBe('gras');
        expect(result.querySelector('em').textContent).toBe('italique');
    });

    it('F04 - sécurise les liens', () => {
        const link = parse('[lien](https://exemple.test)').querySelector('a');
        expect(link.getAttribute('href')).toBe('https://exemple.test');
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toBe('noopener noreferrer nofollow');
    });
});

describe('protection XSS', () => {
    const forbiddenElements = 'script, img, svg, iframe, style, form, input, button, math, object, embed, link, meta';

    it.each([
        ['X01 - balise script', '<script>alert(1)</script>texte'],
        ['X02 - image avec onerror', '<img src=x onerror="alert(1)">'],
        ['X03 - svg avec onload', '<svg onload="alert(1)"></svg>'],
        ['X04 - iframe', '<iframe srcdoc="<script>alert(1)</script>"></iframe>'],
        ['X05 - formulaire', '<form action="https://evil.test"><input name="p"><button>go</button></form>'],
        ['X06 - style', '<style>body{display:none}</style>'],
        ['X07 - mXSS', '<math><mtext><table><mglyph><style><img src=x onerror="alert(1)">'],
        ['X08 - image Markdown', '![pixel](https://evil.test/track.png)'],
    ])('%s est retiré', (_, payload) => {
        expect(parse(payload).querySelector(forbiddenElements)).toBeNull();
    });

    it.each([
        ['X09 - lien Markdown javascript', '[clic](javascript:alert(1))'],
        ['X10 - lien HTML javascript', '<a href="javascript:alert(1)">clic</a>'],
        ['X11 - lien javascript masqué', '<a href="jav&#x09;ascript:alert(1)">clic</a>'],
        ['X12 - lien data', '<a href="data:text/html,<script>alert(1)</script>">clic</a>'],
    ])('%s ne garde pas son adresse', (_, payload) => {
        const link = parse(payload).querySelector('a');
        expect(link?.getAttribute('href') ?? null).toBeNull();
    });

    it('X13 - retire les attributs on*, style et data-*', () => {
        const paragraph = parse('<p onclick="alert(1)" style="position:fixed" data-x="1">texte</p>').querySelector('p');
        expect(paragraph.getAttributeNames()).toEqual([]);
    });
});
