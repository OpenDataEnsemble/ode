/**
 * Remark plugin to fix internal documentation links
 * When routeBasePath is '/docs', Docusaurus strips /docs/ from absolute paths
 * This plugin ensures links are correctly formatted for Docusaurus
 */
function fixDocsLinks() {
  return (tree) => {
    const {visit} = require('unist-util-visit');
    visit(tree, 'link', (node) => {
      // Skip external links
      if (node.url.startsWith('http://') || node.url.startsWith('https://') || node.url.startsWith('mailto:')) {
        return;
      }
      
      // Skip anchor links
      if (node.url.startsWith('#')) {
        return;
      }
      
      // Skip @site aliases (they're handled by Docusaurus)
      if (node.url.startsWith('@site/')) {
        return;
      }
      
      // If the link is an absolute path starting with / but not /docs/, 
      // it's a broken internal link - add /docs/ prefix
      if (node.url.startsWith('/') && !node.url.startsWith('/docs/')) {
        node.url = '/docs' + node.url;
      }
    });
  };
}

module.exports = fixDocsLinks;
