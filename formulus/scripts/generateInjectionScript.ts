// Run with: npx ts-node generateInjectionScript.ts
import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
// Types are only used in JSDoc comments, not imported

// Core type definitions
interface JSDocTag {
  tagName: string;
  text: string;
}

interface MethodParameter {
  name: string;
  type: string;
  doc: string;
  optional?: boolean;
}

interface MethodInfo {
  name: string;
  parameters: MethodParameter[];
  returnType: string;
  doc: string;
}

function generateInjectionScript(interfaceFilePath: string): string {
  const program = ts.createProgram([interfaceFilePath], {
    target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.CommonJS,
  });

  const sourceFile = program.getSourceFile(interfaceFilePath);
  const typeChecker = program.getTypeChecker();
  const methods: MethodInfo[] = [];

  if (!sourceFile) {
    throw new Error(`Could not parse source file: ${interfaceFilePath}`);
  }

  // Add fallback methods if none are found
  const fallbackMethods: MethodInfo[] = [
    {
      name: 'getVersion',
      parameters: [],
      returnType: 'string',
      doc: '/** Get the current version of the Formulus API */',
    },
    {
      name: 'getAvailableForms',
      parameters: [],
      returnType: 'FormInfo[]',
      doc: '/** Get a list of all available forms */',
    },
    {
      name: 'openFormplayer',
      parameters: [
        {name: 'formId', type: 'string', doc: 'The ID of the form to open'},
        {
          name: 'params',
          type: 'Record<string, any>',
          doc: 'Additional parameters',
        },
      ],
      returnType: 'void',
      doc: '/** Open the form player with the specified form */',
    },
  ];

  // Find the FormulusInterface interface
  const processNode = (node: ts.Node) => {
    if (
      ts.isInterfaceDeclaration(node) &&
      node.name.text === 'FormulusInterface'
    ) {
      node.members.forEach(member => {
        if (ts.isMethodSignature(member)) {
          const methodName = member.name.getText();
          const signature = typeChecker.getSignatureFromDeclaration(member);
          const returnType = signature
            ? typeChecker.typeToString(signature.getReturnType())
            : 'void';

          const parameters: MethodParameter[] = [];

          if (member.parameters) {
            member.parameters.forEach(param => {
              const paramName = param.name.getText();
              const paramType = typeChecker.typeToString(
                typeChecker.getTypeAtLocation(param),
              );
              parameters.push({
                name: paramName,
                type: paramType,
                doc: `@param {${paramType}} ${paramName}`,
                optional:
                  !!param.questionToken || param.initializer !== undefined,
              });
            });
          }

          // Skip if method already exists
          if (!methods.some(m => m.name === methodName)) {
            const paramDocs =
              parameters.length > 0
                ? `\n${parameters
                    .map(
                      p =>
                        ` * @param {${p.type}} ${p.name}${
                          p.optional ? '?' : ''
                        } - Parameter`,
                    )
                    .join('\n')}`
                : '';

            methods.push({
              name: methodName,
              parameters,
              returnType,
              doc: `/**
               * ${methodName}${paramDocs}
               * @returns {${returnType}}
               */`,
            });
          }
        }
      });
    }
    ts.forEachChild(node, processNode);
  };

  ts.forEachChild(sourceFile, processNode);

  // If no methods were found, add fallback methods
  if (methods.length === 0) {
    methods.push(...fallbackMethods);
  } else {
    // Ensure all required methods are present
    const methodNames = new Set(methods.map(m => m.name));
    for (const fallback of fallbackMethods) {
      if (!methodNames.has(fallback.name)) {
        methods.push(fallback);
      }
    }
  }

  // Generate the injection script
  const methodImpls = methods
    .map((method: MethodInfo) => {
      const params = method.parameters.map(p => p.name).join(', ');
      const messageProps = method.parameters
        .map(p => `            ${p.name}: ${p.name}`)
        .join(',\n');

      // Special handling for methods that return values
      const isVoidReturn = method.returnType === 'void';

      // Add JSDoc comments
      let jsDoc = method.doc;
      if (!jsDoc) {
        const paramDocs = method.parameters
          .map(p => ` * @param {${p.type}} ${p.name} - ${p.doc || ''}`)
          .join('\n');
        jsDoc = `/**\n${paramDocs}\n * @returns {${method.returnType}}\n */`;
      }

      return `
        // ${method.name}: ${method.parameters
        .map(p => `${p.name}: ${p.type}`)
        .join(', ')} => ${method.returnType}
        ${method.name}: function(${params}) {
          ${isVoidReturn ? '' : 'return new Promise((resolve, reject) => {'}
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          ${
            !isVoidReturn
              ? `
          const callback = (event) => {
            try {
              let data;
              if (typeof event.data === 'string') {
                data = JSON.parse(event.data);
              } else if (typeof event.data === 'object' && event.data !== null) {
                data = event.data; // Already an object
              } else {
                // console.warn('${method.name} callback: Received response with unexpected data type:', typeof event.data, event.data);
                window.removeEventListener('message', callback); // Clean up listener
                reject(new Error('${method.name} callback: Received response with unexpected data type. Raw: ' + String(event.data)));
                return;
              }
              if (data.type === '${method.name}_response' && data.messageId === messageId) {
                window.removeEventListener('message', callback);
                if (data.error) {
                  reject(new Error(data.error));
                } else {
                  resolve(data.result);
                }
              }
            } catch (e) {
              console.error("'${method.name}' callback: Error processing response:" , e, "Raw event.data:", event.data);
              window.removeEventListener('message', callback); // Ensure listener is removed on error too
              reject(e);
            }
          };
          window.addEventListener('message', callback);
          `
              : ''
          }
          
          // Send the message to React Native
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: '${method.name}',
            ${!isVoidReturn ? 'messageId,' : ''}
            ${method.parameters.length > 0 ? messageProps : ''}
          }));
          
          ${isVoidReturn ? '' : '});'}
        },`;
    })
    .join('\n');

  // Add TypeScript type information
  const typeDeclarations = methods
    .map((method: MethodInfo) => {
      const params = method.parameters
        .map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type}`)
        .join(', ');
      return `    ${method.name}(${params}): ${method.returnType};`;
    })
    .join('\n');

  return `// Auto-generated from FormulusInterfaceDefinition.ts
// Do not edit directly - this file will be overwritten
// Last generated: ${new Date().toISOString()}

(function() {
  // Enhanced API availability detection and recovery
  function getFormulus() {
    // Check multiple locations where the API might exist
    return globalThis.formulus || window.formulus || (typeof formulus !== 'undefined' ? formulus : undefined);
  }

  function isFormulusAvailable() {
    const api = getFormulus();
    return api && typeof api === 'object' && typeof api.getVersion === 'function';
  }

  // Idempotent guard to avoid double-initialization when scripts are reinjected
  if ((globalThis as any).__formulusBridgeInitialized) {
    if (isFormulusAvailable()) {
      console.debug('Formulus bridge already initialized and functional. Skipping duplicate injection.');
      return;
    } else {
      console.warn('Formulus bridge flag is set but API is not functional. Proceeding with re-injection...');
    }
  }

  // If API already exists and is functional, skip injection
  if (isFormulusAvailable()) {
    console.debug('Formulus interface already exists and is functional. Skipping injection.');
    return;
  }

  // If API exists but is not functional, log warning and proceed with re-injection
  if (getFormulus()) {
    console.warn('Formulus interface exists but appears non-functional. Re-injecting...');
  }

  // Helper function to handle callbacks
  function handleCallback(callback, data) {
    try {
      if (typeof callback === 'function') {
        callback(data);
      }
    } catch (e) {
      console.error('Error in callback:', e);
    }
  }

  // Initialize callbacks
  const callbacks = {};
  
  // Global function to handle responses from React Native
  function handleMessage(event) {
    try {
      let data;
      if (typeof event.data === 'string') {
        data = JSON.parse(event.data);
      } else if (typeof event.data === 'object' && event.data !== null) {
        data = event.data; // Already an object
      } else {
        // console.warn('Global handleMessage: Received message with unexpected data type:', typeof event.data, event.data);
        return; // Or handle as an error, but for now, just return to avoid breaking others.
      }
      
      // Handle callbacks
      if (data.type === 'callback' && data.callbackId && callbacks[data.callbackId]) {
        handleCallback(callbacks[data.callbackId], data.data);
        delete callbacks[data.callbackId];
      }
      
      // Handle specific callbacks
      
      
      if (data.type === 'onFormulusReady' && globalThis.formulusCallbacks?.onFormulusReady) {
        handleCallback(globalThis.formulusCallbacks.onFormulusReady);
      }
    } catch (e) {
      console.error('Global handleMessage: Error processing message:', e, 'Raw event.data:', event.data);
    }
  }
  
  // Set up message listener
  document.addEventListener('message', handleMessage);
  window.addEventListener('message', handleMessage);

  // Initialize the formulus interface
  globalThis.formulus = {${methodImpls}
  };
  
  // Register the callback handler with the window object
  globalThis.formulusCallbacks = {};
  
  // Notify that the interface is ready
  console.log('Formulus interface initialized');
  (globalThis as any).__formulusBridgeInitialized = true;

  // Simple API availability check for internal use
  function requestApiReinjection() {
    console.log('Formulus: Requesting re-injection from host...');
    if (globalThis.ReactNativeWebView) {
      globalThis.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'requestApiReinjection',
        timestamp: Date.now()
      }));
    }
  }

  // Notify React Native that the interface is ready
  if (globalThis.ReactNativeWebView) {
    globalThis.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'onFormulusReady'
    }));
  }
  
  // Add TypeScript type information
  interface FormulusInterface {
    ${typeDeclarations}
  }
  
  // Make the API available globally in browser environments
  if (typeof window !== 'undefined') {
    window.formulus = globalThis.formulus as FormulusInterface;
  }
  
})();
`;
}

/**
 * Generates a JSDoc interface file based on the FormulusInterfaceDefinition
 */
function generateJSDocInterface(interfacePath: string): string {
  const program = ts.createProgram([interfacePath], {
    target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.CommonJS,
  });

  const sourceFile = program.getSourceFile(interfacePath);
  if (!sourceFile) {
    throw new Error(`Could not load source file: ${interfacePath}`);
  }

  // Extract method information
  const methods = extractMethods(sourceFile);

  // Start with the header
  let output = `/**
 * Formulus API Interface (JavaScript Version)
 * 
 * This file provides type information and documentation for the Formulus API
 * that's available in the WebView context as \`globalThis.formulus\`.
 * 
 * This file is auto-generated from FormulusInterfaceDefinition.ts
 * Last generated: ${new Date().toISOString()}
 * 
 * @example
 * // In your JavaScript file:
 * /// <reference path="./formulus-api.js" />
 * 
 * // Now you'll get autocompletion and type hints in IDEs that support JSDoc
 * globalThis.formulus.getVersion().then(version => {
 *   console.log('Formulus version:', version);
 * });
 */

// Type definitions for Formulus API

/** @typedef {Object} FormInfo */
/** @typedef {Object} FormObservation */
/** @typedef {Object} AttachmentData */

/**
 * Formulus API interface
 * @namespace formulus
 */
const FormulusAPI = {
`;

  // Generate method stubs with JSDoc
  methods.forEach(method => {
    // Add the JSDoc comment and method signature
    output += `  ${method.doc}
  ${method.name}: function(${method.parameters
      .map(p => p.name)
      .join(', ')}) {},\n\n`;
  });

  // Close the object and add exports
  output += `};

// Make the API available globally in browser environments
if (typeof window !== 'undefined') {
  window.formulus = FormulusAPI;
}

// Export for CommonJS/Node.js environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FormulusAPI;
}
`;

  return output;
}

/**
 * Extracts method information from the FormulusInterface
 */
function extractMethods(sourceFile: ts.SourceFile): MethodInfo[] {
  const methods: MethodInfo[] = [];

  const visit = (node: ts.Node) => {
    if (
      ts.isInterfaceDeclaration(node) &&
      node.name.text === 'FormulusInterface'
    ) {
      for (const member of node.members) {
        if (ts.isMethodSignature(member)) {
          const methodName = member.name.getText(sourceFile);
          // Extract parameters
          const parameters = member.parameters.map(param => ({
            name: param.name.getText(sourceFile),
            type: param.type?.getText(sourceFile) || 'any',
            doc: '', // Will be filled from JSDoc if available
          }));

          // Get return type
          const returnType = member.type?.getText(sourceFile) || 'void';

          // Get JSDoc comment text if it exists
          const jsDocRanges = ts.getLeadingCommentRanges(
            sourceFile.text,
            member.getFullStart(),
          );

          let doc = `/** ${methodName} */`; // Default doc if none found

          if (jsDocRanges && jsDocRanges.length > 0) {
            const jsDocText = jsDocRanges[0];
            // Get the raw JSDoc text
            const rawJsDoc = sourceFile.text.substring(
              jsDocText.pos,
              jsDocText.end,
            );

            // Parse the JSDoc to extract the description and tags
            const lines = rawJsDoc
              .split('\n')
              .map(line => line.trim().replace(/^\* ?/, '').trim())
              .filter(line => line !== '/**' && line !== '*/');

            const description: string[] = [];
            const tags: JSDocTag[] = [];

            for (const line of lines) {
              if (line.startsWith('@')) {
                const [tagName, ...rest] = line.slice(1).split(' ');
                tags.push({
                  tagName,
                  text: rest.join(' ').trim(),
                });
              } else if (line) {
                description.push(line);
              }
            }

            // Build the JSDoc comment
            doc = '/**\n';
            if (description.length > 0) {
              doc += ` * ${description.join('\n * ')}\n`;
            }

            // Add parameter tags
            for (const tag of tags) {
              if (tag.tagName === 'param') {
                const paramMatch = tag.text.match(
                  /^\{([^}]+)\}\s+([^\s-]+)(?:\s+-\s+(.*))?/,
                );
                if (paramMatch) {
                  const [_, type, name, desc = ''] = paramMatch;
                  const param = parameters.find(p => p.name === name);
                  if (param) {
                    param.doc = desc;
                    doc += ` * @param {${type}} ${name} - ${desc}\n`;
                  }
                }
              } else if (tag.tagName === 'returns') {
                const returnMatch = tag.text.match(/^\{([^}]+)\}(?:\s+(.*))?/);
                if (returnMatch) {
                  const [_, type, desc = ''] = returnMatch;
                  doc += ` * @returns {${type}} ${desc}\n`;
                } else {
                  doc += ` * @returns {${returnType}} ${tag.text}\n`;
                }
              } else {
                doc += ` * @${tag.tagName} ${tag.text}\n`;
              }
            }

            doc += ' */';
          }
          // Add the method to our list
          methods.push({
            name: methodName,
            parameters: parameters.map(p => ({
              name: p.name,
              type: p.type,
              doc: p.doc || '', // Ensure doc is always a string
            })),
            returnType,
            doc: doc || '', // Ensure doc is always a string
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return methods;
}

// Main execution
if (require.main === module) {
  try {
    console.log('Running as main module');

    // Get the project root directory (one level up from scripts directory)
    const projectRoot = path.resolve(__dirname, '..');
    const interfacePath = path.join(
      projectRoot,
      'src',
      'webview',
      'FormulusInterfaceDefinition.ts',
    );
    const injectionScriptPath = path.join(
      projectRoot,
      'assets',
      'webview',
      'FormulusInjectionScript.js',
    );
    const jsDocPath = path.join(
      projectRoot,
      'assets',
      'webview',
      'formulus-api.js',
    );

    console.log('Project root:', projectRoot);
    console.log('Interface path:', interfacePath);
    console.log('Injection script path:', injectionScriptPath);
    console.log('JSDoc interface path:', jsDocPath);

    // Check if interface file exists
    if (!fs.existsSync(interfacePath)) {
      console.error('Error: Interface file not found');
      console.error('Searched at:', interfacePath);
      process.exit(1);
    }

    // Create output directory if it doesn't exist
    const outputDir = path.dirname(injectionScriptPath);
    if (!fs.existsSync(outputDir)) {
      console.log(`Creating directory: ${outputDir}`);
      fs.mkdirSync(outputDir, {recursive: true});
    }

    // Generate and write the injection script
    console.log('Generating injection script...');
    let injectionScript = generateInjectionScript(interfacePath);

    // Remove TypeScript interface declarations and type assertions
    injectionScript = injectionScript
      .replace(/interface\s+\w+\s*{[^}]*}/gs, '') // Remove interface blocks
      .replace(/\s+as\s+\w+/g, ''); // Remove type assertions

    fs.writeFileSync(injectionScriptPath, injectionScript);
    console.log(
      `✅ Successfully generated injection script at ${injectionScriptPath}`,
    );

    // Generate and write the JSDoc interface
    console.log('Generating JSDoc interface...');
    const jsDocInterface = generateJSDocInterface(interfacePath);
    fs.writeFileSync(jsDocPath, jsDocInterface);
    console.log(`✅ Successfully generated JSDoc interface at ${jsDocPath}`);
  } catch (error) {
    console.error('Error generating injection script:');
    if (error instanceof Error) {
      console.error(error.message);
      if (error.stack) {
        console.error(error.stack);
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}
