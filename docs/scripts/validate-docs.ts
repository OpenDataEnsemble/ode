#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';

interface ValidationResult {
  errors: string[];
  warnings: string[];
}

function getAllDocFiles(): string[] {
  const docsDir = path.join(process.cwd(), 'docs');
  const files: string[] = [];
  
  if (!fs.existsSync(docsDir)) {
    return files;
  }
  
  function walkDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const relativePath = path.relative(docsDir, fullPath)
          .replace(/\\/g, '/')
          .replace(/\.md$/, '');
        files.push(relativePath);
      }
    }
  }
  
  walkDir(docsDir);
  return files;
}

function docFileExists(docId: string, docFiles: string[]): boolean {
  if (docFiles.includes(docId)) return true;
  if (docFiles.includes(`${docId}/index`)) return true;
  
  // Check if there's a file with the same name as the directory (e.g., formulus/formulus.md)
  const dirName = path.basename(docId);
  if (docFiles.includes(`${docId}/${dirName}`)) return true;
  
  const categoryPath = path.join(process.cwd(), 'docs', docId, '_category_.json');
  if (fs.existsSync(categoryPath)) return true;
  
  const parentDir = path.dirname(path.join(process.cwd(), 'docs', docId));
  if (fs.existsSync(parentDir) && fs.statSync(parentDir).isDirectory()) {
    const categoryJson = path.join(parentDir, '_category_.json');
    if (fs.existsSync(categoryJson)) return true;
  }
  
  return false;
}

function extractDocIdsFromConfig(): string[] {
  const configPath = path.join(process.cwd(), 'docusaurus.config.ts');
  if (!fs.existsSync(configPath)) return [];
  
  const content = fs.readFileSync(configPath, 'utf-8');
  const docIds: string[] = [];
  const docIdRegex = /docId:\s*['"]([^'"]+)['"]/g;
  let match;
  
  while ((match = docIdRegex.exec(content)) !== null) {
    docIds.push(match[1]);
  }
  
  return docIds;
}

function extractDocPathsFromConfig(): string[] {
  const configPath = path.join(process.cwd(), 'docusaurus.config.ts');
  if (!fs.existsSync(configPath)) return [];
  
  const content = fs.readFileSync(configPath, 'utf-8');
  const paths: string[] = [];
  const toPathRegex = /to:\s*['"](\/docs\/[^'"]+)['"]/g;
  let match;
  
  while ((match = toPathRegex.exec(content)) !== null) {
    paths.push(match[1]);
  }
  
  return paths;
}

function validateConfigDocIds(docFiles: string[], result: ValidationResult): void {
  for (const docId of extractDocIdsFromConfig()) {
    if (!docFileExists(docId, docFiles)) {
      result.errors.push(`docId "${docId}" in docusaurus.config.ts does not exist`);
    }
  }
}

function validateConfigPaths(docFiles: string[], result: ValidationResult): void {
  for (const docPath of extractDocPathsFromConfig()) {
    if (docPath.startsWith('/api')) continue;
    
    const relativePath = docPath.replace(/^\/docs\//, '').replace(/\/$/, '');
    if (!docFileExists(relativePath, docFiles) && !docFileExists(`${relativePath}/index`, docFiles)) {
      result.warnings.push(`Path "${docPath}" in docusaurus.config.ts may not exist (verify manually)`);
    }
  }
}

function validateMarkdownLinks(docFiles: string[], result: ValidationResult): void {
  const docsDir = path.join(process.cwd(), 'docs');
  if (!fs.existsSync(docsDir)) return;
  
  function walkDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const relativePath = path.relative(docsDir, fullPath).replace(/\\/g, '/');
        const linkRegex = /\[([^\]]+)\]\((\/docs\/[^\)]+)\)/g;
        let match;
        
        while ((match = linkRegex.exec(content)) !== null) {
          const linkPath = match[2];
          const linkText = match[1];
          
          if (linkPath.startsWith('http') || linkPath.startsWith('/api')) continue;
          
          const docPath = linkPath.replace(/^\/docs\//, '').replace(/\/$/, '');
          if (!docFileExists(docPath, docFiles) && !docFileExists(`${docPath}/index`, docFiles)) {
            result.warnings.push(`${relativePath}: Link "${linkText}" points to "${linkPath}" which may not exist`);
          }
        }
      }
    }
  }
  
  walkDir(docsDir);
}

function printResults(result: ValidationResult): void {
  if (result.warnings.length > 0) {
    console.log('⚠️  Warnings:');
    result.warnings.forEach(w => console.log(`   ${w}`));
    console.log('');
  }
  
  if (result.errors.length > 0) {
    console.log('❌ Errors found:');
    result.errors.forEach(e => console.log(`   ${e}`));
    console.log('\n💡 Fix the errors above before pushing.');
    console.log('💡 Run "npm run build" for full validation.\n');
    return;
  }
  
  if (result.warnings.length === 0) {
    console.log('✅ All validation checks passed!');
  } else {
    console.log('✅ No critical errors found.');
    console.log('⚠️  Review warnings above.');
  }
  console.log('💡 Run "npm run build" for full validation.\n');
}

function main(): void {
  console.log('🔍 Running fast documentation validation...\n');
  
  const result: ValidationResult = { errors: [], warnings: [] };
  const docsDir = path.join(process.cwd(), 'docs');
  
  if (!fs.existsSync(docsDir)) {
    result.errors.push('docs/ directory not found');
    printResults(result);
    process.exit(1);
  }
  
  const docFiles = getAllDocFiles();
  console.log(`📄 Found ${docFiles.length} documentation files\n`);
  
  validateConfigDocIds(docFiles, result);
  validateConfigPaths(docFiles, result);
  validateMarkdownLinks(docFiles, result);
  
  printResults(result);
  
  if (result.errors.length > 0) {
    process.exit(1);
  }
}

main();
