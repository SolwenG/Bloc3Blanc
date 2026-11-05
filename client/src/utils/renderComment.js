import DOMPurify from 'dompurify';
import { marked } from 'marked';

const ALLOWED_TAGS = [
    'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's', 'del',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a',
];

// Open links in a new tab without giving the target page access to this one
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer nofollow');
    }
});

// Markdown keeps HTML and plain text as is, so one pipeline handles the three formats
export const renderComment = (content) => DOMPurify.sanitize(
    marked.parse(content, { breaks: true }),
    { ALLOWED_TAGS, ALLOWED_ATTR: ['href', 'title'], ALLOW_DATA_ATTR: false }
);
