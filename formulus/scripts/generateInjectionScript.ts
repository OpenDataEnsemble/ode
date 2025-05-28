import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

console.log('Script started');
console.log('Current directory:', process.cwd());
console.log('__dirname:', __dirname);

interface ParameterInfo {
  name: string;
  type: string;
}

interface MethodInfo {
  name: string;
  parameters: ParameterInfo[];
  returnType: string;
}

function generateInjectionScript(interfaceFilePath: string): string {
  const program = ts.createProgram([interfaceFilePath], { 
    target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.CommonJS
  });
  
  const sourceFile = program.getSourceFile(interfaceFilePath);
  const typeChecker = program.getTypeChecker();
  const methods: MethodInfo[] = [];

  if (!sourceFile) {
    throw new Error(`Could not parse source file: ${interfaceFilePath}`);
  }

  // Find the FormulusInterface interface
  const processNode = (node: ts.Node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === 'FormulusInterface') {
      node.members.forEach((member) => {
        if (ts.isMethodSignature(member)) {
          const methodName = member.name.getText();
          const returnType = member.type?.getText() || 'void';
          
          const parameters: ParameterInfo[] = member.parameters.map((param) => {
            const paramName = param.name.getText();
            const paramType = typeChecker.typeToString(typeChecker.getTypeAtLocation(param));
            return { name: paramName, type: paramType };
          });

          // Skip if method already exists
          if (!methods.some(m => m.name === methodName)) {
            methods.push({ 
              name: methodName, 
              parameters, 
              returnType 
            });
          }
        }
      });
    }
    ts.forEachChild(node, processNode);
  };

  processNode(sourceFile);
  
  // If no methods were found, add a fallback to ensure we have the interface methods
  if (methods.length === 0) {
    console.warn('No methods found in FormulusInterface. Using fallback methods.');
    methods.push(
      { name: 'getVersion', parameters: [], returnType: 'string' },
      { name: 'getAvailableForms', parameters: [], returnType: 'FormInfo[]' },
      { name: 'openFormplayer', parameters: [
        { name: 'formId', type: 'string' },
        { name: 'params', type: 'Record<string, any>' },
        { name: 'savedData', type: 'Record<string, any>' }
      ], returnType: 'void' },
      { name: 'getObservations', parameters: [
        { name: 'formId', type: 'string' },
        { name: 'isDraft', type: 'boolean' },
        { name: 'includeDeleted', type: 'boolean' }
      ], returnType: 'FormObservation[]' },
      { name: 'initForm', parameters: [], returnType: 'void' },
      { name: 'savePartial', parameters: [
        { name: 'formId', type: 'string' },
        { name: 'data', type: 'Record<string, any>' }
      ], returnType: 'void' },
      { name: 'submitForm', parameters: [
        { name: 'formId', type: 'string' },
        { name: 'finalData', type: 'Record<string, any>' }
      ], returnType: 'void' },
      { name: 'requestCamera', parameters: [
        { name: 'fieldId', type: 'string' }
      ], returnType: 'void' },
      { name: 'requestLocation', parameters: [
        { name: 'fieldId', type: 'string' }
      ], returnType: 'void' },
      { name: 'requestFile', parameters: [
        { name: 'fieldId', type: 'string' }
      ], returnType: 'void' },
      { name: 'launchIntent', parameters: [
        { name: 'fieldId', type: 'string' },
        { name: 'intentSpec', type: 'Record<string, any>' }
      ], returnType: 'void' },
      { name: 'callSubform', parameters: [
        { name: 'fieldId', type: 'string' },
        { name: 'formId', type: 'string' },
        { name: 'options', type: 'Record<string, any>' }
      ], returnType: 'void' },
      { name: 'requestAudio', parameters: [
        { name: 'fieldId', type: 'string' }
      ], returnType: 'void' },
      { name: 'requestSignature', parameters: [
        { name: 'fieldId', type: 'string' }
      ], returnType: 'void' },
      { name: 'requestBiometric', parameters: [
        { name: 'fieldId', type: 'string' }
      ], returnType: 'void' },
      { name: 'requestConnectivityStatus', parameters: [], returnType: 'void' },
      { name: 'requestSyncStatus', parameters: [], returnType: 'void' },
      { name: 'runLocalModel', parameters: [
        { name: 'fieldId', type: 'string' },
        { name: 'modelId', type: 'string' },
        { name: 'input', type: 'Record<string, any>' }
      ], returnType: 'void' }
    );
  }

  // Generate the injection script
  const methodImpls = methods.map(method => {
    const params = method.parameters.map(p => p.name).join(', ');
    const messageProps = method.parameters
      .map(p => `            ${p.name}: ${p.name}`)
      .join(',\n');
    
    // Special handling for methods that return values
    const isVoidReturn = method.returnType === 'void';
    const callbackName = `__formulus_cb_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    return `
        // ${method.name}: ${method.parameters.map(p => `${p.name}: ${p.type}`).join(', ')} => ${method.returnType}
        ${method.name}: function(${params}) {
          ${isVoidReturn ? '' : 'return new Promise((resolve, reject) => {'}
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          ${!isVoidReturn ? `
          const callback = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === '${method.name}_response' && data.messageId === messageId) {
                window.removeEventListener('message', callback);
                if (data.error) {
                  reject(new Error(data.error));
                } else {
                  resolve(data.result);
                }
              }
            } catch (e) {
              console.error('Error handling response:', e);
              reject(e);
            }
          };
          window.addEventListener('message', callback);
          ` : ''}
          
          // Send the message to React Native
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: '${method.name}',
            ${!isVoidReturn ? 'messageId,' : ''}
            ${method.parameters.length > 0 ? messageProps : ''}
          }));
          
          ${isVoidReturn ? '' : '});'}
        },`;
  }).join('\n');

  return `// Auto-generated from FormulusInterfaceDefinition.ts
// Do not edit directly - this file will be overwritten
// Last generated: ${new Date().toISOString()}

(function() {
  if (typeof globalThis.formulus !== 'undefined') {
    console.warn('Formulus interface already exists. Skipping injection.');
    return;
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
      const data = JSON.parse(event.data);
      
      // Handle callbacks
      if (data.type === 'callback' && data.callbackId && callbacks[data.callbackId]) {
        handleCallback(callbacks[data.callbackId], data.data);
        delete callbacks[data.callbackId];
      }
      
      // Handle specific callbacks like onAttachmentReady, etc.
      if (data.type === 'onAttachmentReady' && globalThis.formulusCallbacks?.onAttachmentReady) {
        handleCallback(globalThis.formulusCallbacks.onAttachmentReady, data.data);
      }
      
      if (data.type === 'onSavePartialComplete' && globalThis.formulusCallbacks?.onSavePartialComplete) {
        handleCallback(globalThis.formulusCallbacks.onSavePartialComplete, data.success, data.formId);
      }
      
      if (data.type === 'onFormulusReady' && globalThis.formulusCallbacks?.onFormulusReady) {
        handleCallback(globalThis.formulusCallbacks.onFormulusReady);
      }
    } catch (e) {
      console.error('Error handling message:', e);
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
  
  // Notify React Native that the interface is ready
  if (globalThis.ReactNativeWebView) {
    globalThis.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'onFormulusReady'
    }));
  }
})();`;
}

// Main execution
if (require.main === module) {
  try {
    console.log('Running as main module');
    
    // Get the project root directory (one level up from scripts directory)
    const projectRoot = path.resolve(__dirname, '..');
    const interfacePath = path.join(projectRoot, 'src', 'webview', 'FormulusInterfaceDefinition.ts');
    const outputPath = path.join(projectRoot, 'src', 'webview', 'FormulusInjectionScript.generated.ts');
    
    console.log('Project root:', projectRoot);
    console.log('Interface path:', interfacePath);
    console.log('Output path:', outputPath);
    
    // Check if interface file exists
    if (!fs.existsSync(interfacePath)) {
      console.error('Error: Interface file not found');
      console.error('Searched at:', interfacePath);
      process.exit(1);
    }
    
    console.log('Generating injection script...');
    const script = generateInjectionScript(interfacePath);
    
    // Create directory if it doesn't exist
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
    
    console.log(`Writing to ${outputPath}...`);
    fs.writeFileSync(outputPath, script);
    console.log(`✅ Successfully generated injection script at ${outputPath}`);
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
