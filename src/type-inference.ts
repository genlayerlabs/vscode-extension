import * as vscode from 'vscode';
import * as ast from './simple-ast-parser';

// Type definitions for GenVM types and their methods
interface TypeMethod {
    name: string;
    signature: string;
    description: string;
    returnType?: string;
}

interface TypeProperty {
    name: string;
    type: string;
    description: string;
}

interface TypeDefinition {
    name: string;
    methods?: TypeMethod[];
    properties?: TypeProperty[];
    staticMethods?: TypeMethod[];
    staticProperties?: TypeProperty[];
}

// GenVM type definitions with their methods and properties
const GENVM_TYPES: Record<string, TypeDefinition> = {
    'Address': {
        name: 'Address',
        properties: [
            {
                name: 'as_bytes',
                type: 'bytes',
                description: 'Raw bytes of an address (most compact representation)'
            },
            {
                name: 'as_hex',
                type: 'str',
                description: 'Checksum hex string representation (0x...)'
            },
            {
                name: 'as_b64',
                type: 'str', 
                description: 'Base64 string representation (most compact string)'
            },
            {
                name: 'as_int',
                type: 'u160',
                description: 'Integer representation (unsigned little endian)'
            }
        ],
        methods: [
            {
                name: '__str__',
                signature: '() -> str',
                description: 'String representation (same as as_hex)',
                returnType: 'str'
            },
            {
                name: '__repr__',
                signature: '() -> str', 
                description: 'Repr representation',
                returnType: 'str'
            },
            {
                name: '__hash__',
                signature: '() -> int',
                description: 'Hash of the address',
                returnType: 'int'
            },
            {
                name: '__eq__',
                signature: '(other: Address) -> bool',
                description: 'Check equality with another address',
                returnType: 'bool'
            },
            {
                name: '__lt__',
                signature: '(other: Address) -> bool',
                description: 'Less than comparison',
                returnType: 'bool'
            },
            {
                name: '__le__',
                signature: '(other: Address) -> bool', 
                description: 'Less than or equal comparison',
                returnType: 'bool'
            },
            {
                name: '__gt__',
                signature: '(other: Address) -> bool',
                description: 'Greater than comparison', 
                returnType: 'bool'
            },
            {
                name: '__ge__',
                signature: '(other: Address) -> bool',
                description: 'Greater than or equal comparison',
                returnType: 'bool'
            }
        ],
        staticProperties: [
            {
                name: 'SIZE',
                type: 'int',
                description: 'Constant representing size of a GenLayer address (20 bytes)'
            }
        ]
    },
    'Lazy': {
        name: 'Lazy',
        methods: [
            {
                name: 'get',
                signature: '() -> T',
                description: 'Evaluate the lazy value and return result',
                returnType: 'T'
            }
        ]
    },
    'MessageType': {
        name: 'MessageType',
        properties: [
            {
                name: 'contract_address',
                type: 'Address',
                description: 'Address of current Intelligent Contract'
            },
            {
                name: 'sender_address', 
                type: 'Address',
                description: 'Address of this call initiator'
            },
            {
                name: 'origin_address',
                type: 'Address',
                description: 'Entire transaction initiator'
            },
            {
                name: 'value',
                type: 'u256',
                description: 'Transaction value'
            },
            {
                name: 'chain_id',
                type: 'u256',
                description: 'Current chain ID'
            }
        ]
    },
    'Response': {
        name: 'Response',
        properties: [
            {
                name: 'status',
                type: 'int',
                description: 'HTTP status code'
            },
            {
                name: 'headers',
                type: 'dict[str, bytes]',
                description: 'Response headers'
            },
            {
                name: 'body',
                type: 'bytes | None',
                description: 'Response body'
            }
        ]
    },
    'Image': {
        name: 'Image', 
        properties: [
            {
                name: 'raw',
                type: 'bytes',
                description: 'Raw image bytes'
            },
            {
                name: 'pil',
                type: 'PIL.Image.Image',
                description: 'PIL Image object'
            }
        ]
    },
    'DynArray': {
        name: 'DynArray',
        methods: [
            {
                name: 'append',
                signature: '(item: T) -> None',
                description: 'Add an item to the end of the array',
                returnType: 'None'
            },
            {
                name: 'insert',
                signature: '(index: int, item: T) -> None',
                description: 'Insert an item at a specific index',
                returnType: 'None'
            },
            {
                name: 'remove',
                signature: '(item: T) -> None', 
                description: 'Remove first occurrence of item',
                returnType: 'None'
            },
            {
                name: 'pop',
                signature: '(index: int = -1) -> T',
                description: 'Remove and return item at index',
                returnType: 'T'
            },
            {
                name: 'clear',
                signature: '() -> None',
                description: 'Remove all items from the array',
                returnType: 'None'
            },
            {
                name: '__len__',
                signature: '() -> int',
                description: 'Return the number of items',
                returnType: 'int'
            },
            {
                name: '__getitem__',
                signature: '(index: int) -> T',
                description: 'Get item at index',
                returnType: 'T'
            },
            {
                name: '__setitem__',
                signature: '(index: int, value: T) -> None',
                description: 'Set item at index',
                returnType: 'None'
            }
        ]
    },
    'TreeMap': {
        name: 'TreeMap',
        methods: [
            {
                name: 'get',
                signature: '(key: K, default: V = None) -> V | None',
                description: 'Get value for key, or default if not found',
                returnType: 'V'
            },
            {
                name: 'keys',
                signature: '() -> collections.abc.KeysView[K]',
                description: 'Return a view of the keys',
                returnType: 'collections.abc.KeysView'
            },
            {
                name: 'values',
                signature: '() -> collections.abc.ValuesView[V]',
                description: 'Return a view of the values',
                returnType: 'collections.abc.ValuesView'
            },
            {
                name: 'items',
                signature: '() -> collections.abc.ItemsView[K, V]',
                description: 'Return a view of the key-value pairs',
                returnType: 'collections.abc.ItemsView'
            },
            {
                name: 'clear',
                signature: '() -> None',
                description: 'Remove all key-value pairs',
                returnType: 'None'
            },
            {
                name: 'pop',
                signature: '(key: K, default: V = None) -> V',
                description: 'Remove and return value for key',
                returnType: 'V'
            },
            {
                name: '__len__',
                signature: '() -> int',
                description: 'Return the number of key-value pairs',
                returnType: 'int'
            },
            {
                name: '__getitem__',
                signature: '(key: K) -> V',
                description: 'Get value for key',
                returnType: 'V'
            },
            {
                name: '__setitem__',
                signature: '(key: K, value: V) -> None',
                description: 'Set value for key',
                returnType: 'None'
            },
            {
                name: '__contains__',
                signature: '(key: K) -> bool',
                description: 'Check if key exists in the map',
                returnType: 'bool'
            }
        ]
    },
    'Contract': {
        name: 'Contract',
        properties: [
            {
                name: 'balance',
                type: 'u256',
                description: 'Current balance of the contract in native tokens'
            },
            {
                name: 'address',
                type: 'Address',
                description: 'The contract\'s address on the blockchain'
            }
        ]
    }
};

// Variable assignment patterns to track types
interface VariableAssignment {
    name: string;
    type: string;
    line: number;
    scope: 'global' | 'function' | 'class';
}

export class TypeInferenceEngine {
    private variableTypes: Map<string, VariableAssignment[]> = new Map();
    
    /**
     * Analyze a document and build type information for variables
     */
    public analyzeDocument(document: vscode.TextDocument): void {
        this.variableTypes.clear();
        
        const text = document.getText();
        const lines = text.split('\n');
        
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            this.analyzeLine(line, lineIndex, 'global');
        }
    }
    
    /**
     * Analyze a single line for variable assignments
     */
    private analyzeLine(line: string, lineNumber: number, scope: 'global' | 'function' | 'class'): void {
        // Pattern 1: Direct constructor call - var = Type(...)
        const directConstructorMatch = line.match(/(\w+)\s*=\s*(\w+)\s*\(/);
        if (directConstructorMatch) {
            const [, varName, typeName] = directConstructorMatch;
            if (GENVM_TYPES[typeName]) {
                this.addVariableType(varName, typeName, lineNumber, scope);
            }
            return;
        }
        
        // Pattern 2: gl.message.property assignments
        const messagePropertyMatch = line.match(/(\w+)\s*=\s*gl\.message\.(\w+)/);
        if (messagePropertyMatch) {
            const [, varName, propName] = messagePropertyMatch;
            const messageType = GENVM_TYPES['MessageType'];
            const property = messageType.properties?.find(p => p.name === propName);
            if (property) {
                this.addVariableType(varName, property.type, lineNumber, scope);
            }
            return;
        }
        
        // Pattern 3: Method calls that return specific types
        const methodCallMatch = line.match(/(\w+)\s*=\s*(\w+)\.(\w+)\([^)]*\)/);
        if (methodCallMatch) {
            const [, varName, objectName, methodName] = methodCallMatch;
            const objectType = this.getVariableType(objectName, lineNumber);
            if (objectType) {
                const typeDef = GENVM_TYPES[objectType];
                const method = typeDef?.methods?.find(m => m.name === methodName);
                if (method && method.returnType) {
                    this.addVariableType(varName, method.returnType, lineNumber, scope);
                }
            }
            return;
        }
        
        // Pattern 4: Property access assignments
        const propertyAccessMatch = line.match(/(\w+)\s*=\s*(\w+)\.(\w+)(?!\()/);
        if (propertyAccessMatch) {
            const [, varName, objectName, propName] = propertyAccessMatch;
            const objectType = this.getVariableType(objectName, lineNumber);
            if (objectType) {
                const typeDef = GENVM_TYPES[objectType];
                const property = typeDef?.properties?.find(p => p.name === propName);
                if (property) {
                    this.addVariableType(varName, property.type, lineNumber, scope);
                }
            }
            return;
        }
        
        // Pattern 5: gl.* method calls that return specific types
        const glMethodMatch = line.match(/(\w+)\s*=\s*gl\.([^(]+)\([^)]*\)(?:\.get\(\))?/);
        if (glMethodMatch) {
            const [, varName, methodPath] = glMethodMatch;
            const returnType = this.inferGlMethodReturnType(methodPath);
            if (returnType) {
                this.addVariableType(varName, returnType, lineNumber, scope);
            }
        }
    }
    
    /**
     * Add a variable type mapping
     */
    private addVariableType(name: string, type: string, line: number, scope: 'global' | 'function' | 'class'): void {
        if (!this.variableTypes.has(name)) {
            this.variableTypes.set(name, []);
        }
        
        const assignments = this.variableTypes.get(name)!;
        assignments.push({ name, type, line, scope });
        
        // Sort by line number (most recent first for scope resolution)
        assignments.sort((a, b) => b.line - a.line);
    }
    
    /**
     * Get the inferred type of a variable at a given line
     */
    public getVariableType(variableName: string, currentLine: number): string | null {
        const assignments = this.variableTypes.get(variableName);
        if (!assignments) return null;
        
        // Find the most recent assignment before the current line
        for (const assignment of assignments) {
            if (assignment.line < currentLine) {
                return assignment.type;
            }
        }
        
        return null;
    }
    
    /**
     * Get completion items for a variable's methods and properties
     */
    public getCompletionsForVariable(variableName: string, currentLine: number): vscode.CompletionItem[] {
        const type = this.getVariableType(variableName, currentLine);
        if (!type || !GENVM_TYPES[type]) {
            return [];
        }
        
        return this.getCompletionsForType(type);
    }
    
    /**
     * Get completion items for a specific type
     */
    public getCompletionsForType(typeName: string): vscode.CompletionItem[] {
        const typeDef = GENVM_TYPES[typeName];
        if (!typeDef) return [];
        
        const items: vscode.CompletionItem[] = [];
        
        // Add properties
        if (typeDef.properties) {
            for (const prop of typeDef.properties) {
                const item = new vscode.CompletionItem(prop.name, vscode.CompletionItemKind.Property);
                item.detail = `${prop.name}: ${prop.type}`;
                item.documentation = new vscode.MarkdownString(prop.description);
                items.push(item);
            }
        }
        
        // Add methods (excluding dunder methods for cleaner UI)
        if (typeDef.methods) {
            for (const method of typeDef.methods) {
                if (!method.name.startsWith('__') || method.name === '__str__' || method.name === '__repr__') {
                    const item = new vscode.CompletionItem(method.name, vscode.CompletionItemKind.Method);
                    item.detail = method.signature;
                    item.documentation = new vscode.MarkdownString(method.description);
                    
                    // Add snippet for method call
                    const params = this.extractParametersFromSignature(method.signature);
                    item.insertText = new vscode.SnippetString(`${method.name}(${params})`);
                    
                    items.push(item);
                }
            }
        }
        
        return items;
    }
    
    /**
     * Infer return type of gl.* method calls
     */
    private inferGlMethodReturnType(methodPath: string): string | null {
        // Map gl method paths to their return types
        const glReturnTypes: Record<string, string> = {
            'message.contract_address': 'Address',
            'message.sender_address': 'Address', 
            'message.origin_address': 'Address',
            'message.value': 'u256',
            'message.chain_id': 'u256',
            'get_contract_at': 'ContractProxy',
            'nondet.web.get': 'Response',
            'nondet.web.post': 'Response',
            'nondet.web.request': 'Response',
            'nondet.web.render': 'Image', // or str depending on mode, but Image is common
        };
        
        return glReturnTypes[methodPath] || null;
    }
    
    /**
     * Extract parameter snippet from method signature
     */
    private extractParametersFromSignature(signature: string): string {
        const match = signature.match(/\(([^)]*)\)/);
        if (!match || !match[1].trim()) return '';
        
        const params = match[1].split(',').map(p => p.trim());
        let snippetIndex = 1;
        
        return params
            .filter(p => p !== '')
            .map(param => {
                const paramName = param.split(':')[0].trim();
                if (paramName === 'self') return '';
                return `\${${snippetIndex++}:${paramName}}`;
            })
            .filter(p => p !== '')
            .join(', ');
    }
    
    /**
     * Check if a line contains a variable access pattern
     */
    public isVariableAccess(line: string, position: number): { variable: string, accessType: 'property' | 'method' } | null {
        const beforeCursor = line.substring(0, position);
        
        // Check for variable.property or variable.method pattern
        const accessMatch = beforeCursor.match(/(\w+)\.(\w*)$/);
        if (accessMatch) {
            const [, variableName, partialAccess] = accessMatch;
            
            // Determine if this is likely a method call (looking ahead for '(')
            const afterCursor = line.substring(position);
            const isMethod = afterCursor.startsWith('(') || partialAccess.endsWith('(');
            
            return {
                variable: variableName,
                accessType: isMethod ? 'method' : 'property'
            };
        }
        
        return null;
    }
}