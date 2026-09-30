/**
 * Rehype plugin to fix internal documentation links
 * Runs after remark processing to ensure /docs/ prefix is preserved
 */
function fixDocsLinksRehype() {
  return (tree) => {
    const {visit} = require('unist-util-visit');
    
    visit(tree, 'element', (node) => {
      if (node.tagName === 'a' && node.properties && node.properties.href) {
        const href = node.properties.href;
        
        // Skip external links, anchors, and links that already have /docs/
        if (
          href.startsWith('http://') || 
          href.startsWith('https://') || 
          href.startsWith('mailto:') ||
          href.startsWith('#') ||
          href.startsWith('/docs/')
        ) {
          return;
        }
        
        // If it's an absolute path starting with / but not /docs/, add /docs/ prefix
        if (href.startsWith('/')) {
          node.properties.href = '/docs' + href;
        }
      }
    });
  };
}

module.exports = fixDocsLinksRehype;
