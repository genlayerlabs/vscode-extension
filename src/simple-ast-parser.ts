/**
 * Simple AST parsing utilities for Python-like syntax
 * This is a lightweight parser for basic variable assignment detection
 */

export interface Assignment {
    variable: string;
    value: string;
    line: number;
    type: 'direct' | 'method_call' | 'property_access' | 'constructor';
}

export interface FunctionCall {
    name: string;
    args: string[];
    line: number;
}

/**
 * Extract variable assignments from a line of code
 */
export function parseAssignment(line: string, lineNumber: number): Assignment | null {
    // Remove comments and whitespace
    const cleanLine = line.split('#')[0].trim();
    
    if (!cleanLine.includes('=') || cleanLine.includes('==') || cleanLine.includes('!=')) {
        return null;
    }
    
    const equalIndex = cleanLine.indexOf('=');
    const variable = cleanLine.substring(0, equalIndex).trim();
    const value = cleanLine.substring(equalIndex + 1).trim();
    
    // Skip if multiple variables or complex assignment
    if (variable.includes(',') || variable.includes('[') || variable.includes('(')) {
        return null;
    }
    
    let type: Assignment['type'] = 'direct';
    
    if (value.includes('(') && value.includes(')')) {
        if (value.includes('.')) {
            type = 'method_call';
        } else {
            type = 'constructor';
        }
    } else if (value.includes('.')) {
        type = 'property_access';
    }
    
    return {
        variable,
        value,
        line: lineNumber,
        type
    };
}

/**
 * Extract function/method calls from a line
 */
export function parseFunctionCall(line: string, lineNumber: number): FunctionCall[] {
    const calls: FunctionCall[] = [];
    const cleanLine = line.split('#')[0].trim();
    
    // Simple regex to find function calls
    const callPattern = /(\w+(?:\.\w+)*)\s*\(([^)]*)\)/g;
    let match;
    
    while ((match = callPattern.exec(cleanLine)) !== null) {
        const [, name, argsString] = match;
        const args = argsString
            .split(',')
            .map(arg => arg.trim())
            .filter(arg => arg.length > 0);
            
        calls.push({
            name,
            args,
            line: lineNumber
        });
    }
    
    return calls;
}

/**
 * Check if a line contains an import statement
 */
export function parseImport(line: string): { module: string; items: string[] } | null {
    const cleanLine = line.trim();
    
    // from module import *
    const fromImportAll = cleanLine.match(/^from\s+([^\s]+)\s+import\s+\*/);
    if (fromImportAll) {
        return { module: fromImportAll[1], items: ['*'] };
    }
    
    // from module import item1, item2
    const fromImportItems = cleanLine.match(/^from\s+([^\s]+)\s+import\s+(.+)/);
    if (fromImportItems) {
        const items = fromImportItems[2]
            .split(',')
            .map(item => item.trim());
        return { module: fromImportItems[1], items };
    }
    
    // import module
    const importModule = cleanLine.match(/^import\s+([^\s]+)/);
    if (importModule) {
        return { module: importModule[1], items: [] };
    }
    
    return null;
}

/**
 * Extract the scope from a line (function, class, or global)
 */
export function getScope(line: string): { type: 'function' | 'class' | 'global'; name?: string; indent: number } {
    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();
    
    if (trimmed.startsWith('def ')) {
        const match = trimmed.match(/^def\s+(\w+)/);
        return {
            type: 'function',
            name: match ? match[1] : undefined,
            indent
        };
    }
    
    if (trimmed.startsWith('class ')) {
        const match = trimmed.match(/^class\s+(\w+)/);
        return {
            type: 'class', 
            name: match ? match[1] : undefined,
            indent
        };
    }
    
    return { type: 'global', indent };
}