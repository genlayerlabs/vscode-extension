import * as vscode from 'vscode';

export class GenVMInlayHintsProvider implements vscode.InlayHintsProvider {
    
    provideInlayHints(
        document: vscode.TextDocument,
        range: vscode.Range,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.InlayHint[]> {
        
        const hints: vscode.InlayHint[] = [];
        
        // Parse the document to find places where hints would be helpful
        for (let lineNum = range.start.line; lineNum <= range.end.line; lineNum++) {
            const line = document.lineAt(lineNum);
            const text = line.text;
            
            // Variable type hints for assignments without explicit types
            this.addVariableTypeHints(hints, document, lineNum, text);
            
            // Parameter name hints for function calls
            this.addParameterNameHints(hints, document, lineNum, text);
            
            // Return type hints for methods without annotations
            this.addReturnTypeHints(hints, document, lineNum, text);
            
            // Storage field type hints
            this.addStorageTypeHints(hints, document, lineNum, text);
        }
        
        return hints;
    }
    
    private addVariableTypeHints(
        hints: vscode.InlayHint[],
        document: vscode.TextDocument,
        lineNum: number,
        text: string
    ): void {
        // Match variable assignments without type annotations
        const assignmentPattern = /(\w+)\s*=\s*([^=\n]+)/g;
        let match;
        
        while ((match = assignmentPattern.exec(text)) !== null) {
            const varName = match[1];
            const value = match[2].trim();
            
            // Skip if already has type annotation
            if (text.includes(`${varName}:`)) {
                continue;
            }
            
            // Infer type from value
            const inferredType = this.inferType(value);
            if (inferredType && inferredType !== 'Any') {
                const position = new vscode.Position(
                    lineNum,
                    match.index + varName.length
                );
                
                const hint = new vscode.InlayHint(
                    position,
                    `: ${inferredType}`,
                    vscode.InlayHintKind.Type
                );
                hint.paddingLeft = true;
                hints.push(hint);
            }
        }
    }
    
    private addParameterNameHints(
        hints: vscode.InlayHint[],
        document: vscode.TextDocument,
        lineNum: number,
        text: string
    ): void {
        // Match function calls with arguments
        const callPattern = /(\w+)\((.*?)\)/g;
        let match;
        
        while ((match = callPattern.exec(text)) !== null) {
            const funcName = match[1];
            const argsStr = match[2];
            
            if (!argsStr || argsStr.includes('=')) {
                continue; // Skip if no args or already has named parameters
            }
            
            const args = this.parseArguments(argsStr);
            const paramNames = this.getParameterNames(funcName);
            
            if (paramNames.length > 0) {
                let currentPos = match.index + funcName.length + 1;
                
                args.forEach((arg, index) => {
                    if (index < paramNames.length) {
                        const position = new vscode.Position(lineNum, currentPos);
                        const hint = new vscode.InlayHint(
                            position,
                            `${paramNames[index]}:`,
                            vscode.InlayHintKind.Parameter
                        );
                        hint.paddingRight = true;
                        hints.push(hint);
                    }
                    currentPos += arg.length + 2; // +2 for ", "
                });
            }
        }
    }
    
    private addReturnTypeHints(
        hints: vscode.InlayHint[],
        document: vscode.TextDocument,
        lineNum: number,
        text: string
    ): void {
        // Match function definitions without return type annotations
        const funcPattern = /def\s+(\w+)\s*\(([^)]*)\)/;
        const match = funcPattern.exec(text);
        
        if (match && !text.includes('->')) {
            const funcName = match[1];
            const returnType = this.inferReturnType(document, lineNum, funcName);
            
            if (returnType) {
                // Find the position right after the closing parenthesis
                const closingParenIndex = match.index + match[0].length;
                const position = new vscode.Position(
                    lineNum,
                    closingParenIndex
                );
                
                const hint = new vscode.InlayHint(
                    position,
                    ` -> ${returnType}`,
                    vscode.InlayHintKind.Type
                );
                hints.push(hint);
            }
        }
    }
    
    private addStorageTypeHints(
        hints: vscode.InlayHint[],
        document: vscode.TextDocument,
        lineNum: number,
        text: string
    ): void {
        // Match class attributes (storage fields)
        const attrPattern = /^\s+(\w+)\s*:\s*([\w\[\], ]+)/;
        const match = attrPattern.exec(text);
        
        if (match) {
            const fieldName = match[1];
            const fieldType = match[2];
            
            // Add hint for GenVM specific types
            if (this.isGenVMType(fieldType)) {
                const actualType = this.getActualStorageType(fieldType);
                if (actualType !== fieldType) {
                    const position = new vscode.Position(
                        lineNum,
                        match.index + match[0].length
                    );
                    
                    const hint = new vscode.InlayHint(
                        position,
                        ` # stored as: ${actualType}`,
                        vscode.InlayHintKind.Type
                    );
                    hint.paddingLeft = true;
                    hints.push(hint);
                }
            }
        }
    }
    
    private inferType(value: string): string | null {
        // Remove whitespace
        value = value.trim();
        
        // Direct type constructors
        if (value.match(/^u\d+\(/)) return value.split('(')[0];
        if (value.match(/^i\d+\(/)) return value.split('(')[0];
        if (value.startsWith('Address(')) return 'Address';
        if (value.startsWith('gl.ContractAt(')) return 'ContractProxy';
        
        // Literals
        if (value.match(/^\d+$/)) return 'int';
        if (value.match(/^\d+\.\d+$/)) return 'float';
        if (value.startsWith('"') || value.startsWith("'")) return 'str';
        if (value === 'True' || value === 'False') return 'bool';
        if (value === 'None') return 'None';
        
        // Collections
        if (value.startsWith('[')) return 'list';
        if (value.startsWith('{') && value.includes(':')) return 'dict';
        if (value.startsWith('{') && !value.includes(':')) return 'set';
        if (value.startsWith('(')) return 'tuple';
        
        // GenVM specific
        if (value.startsWith('TreeMap(')) return 'TreeMap';
        if (value.startsWith('DynArray(')) return 'DynArray';
        
        // Method calls that return known types
        if (value.includes('.view()')) return 'ViewProxy';
        if (value.includes('.emit()')) return 'EmitProxy';
        if (value.includes('.balance')) return 'u256';
        if (value.includes('.address')) return 'Address';
        
        return null;
    }
    
    private parseArguments(argsStr: string): string[] {
        // Simple argument parser (doesn't handle nested parentheses perfectly)
        const args: string[] = [];
        let current = '';
        let depth = 0;
        
        for (const char of argsStr) {
            if (char === '(' || char === '[' || char === '{') {
                depth++;
                current += char;
            } else if (char === ')' || char === ']' || char === '}') {
                depth--;
                current += char;
            } else if (char === ',' && depth === 0) {
                args.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        if (current.trim()) {
            args.push(current.trim());
        }
        
        return args;
    }
    
    private getParameterNames(funcName: string): string[] {
        // Known GenVM function signatures
        const signatures: { [key: string]: string[] } = {
            'get': ['url', 'headers'],
            'post': ['url', 'body', 'headers'],
            'ContractAt': ['address'],
            'Address': ['value'],
            'emit': ['value', 'on'],
            'view': ['state'],
            'deploy_contract': ['code', 'args', 'kwargs', 'salt_nonce', 'value'],
            'get_contract_at': ['address'],
            'strict_eq': ['fn'],
            'exec_prompt': ['prompt', 'response_format', 'images'],
            'send_message': ['chain_id', 'address', 'message'],
            'transfer': ['to', 'amount'],
        };
        
        return signatures[funcName] || [];
    }
    
    private inferReturnType(document: vscode.TextDocument, startLine: number, funcName: string): string | null {
        // Known return types for common methods
        const knownReturns: { [key: string]: string } = {
            'get_balance': 'u256',
            'get_address': 'Address',
            'get_name': 'str',
            'get_symbol': 'str',
            'total_supply': 'u256',
            '__init__': 'None',
            '__str__': 'str',
            '__repr__': 'str',
        };
        
        if (knownReturns[funcName]) {
            return knownReturns[funcName];
        }
        
        // Try to infer from return statements in the method
        const methodEnd = this.findMethodEnd(document, startLine);
        for (let i = startLine + 1; i <= methodEnd; i++) {
            const line = document.lineAt(i).text;
            const returnMatch = line.match(/return\s+(.+)/);
            if (returnMatch) {
                const returnValue = returnMatch[1].trim();
                if (returnValue === 'None' || !returnValue) {
                    return 'None';
                }
                return this.inferType(returnValue) || 'Any';
            }
        }
        
        // Check if it's a @gl.public.write method (should return None)
        if (startLine > 0) {
            const prevLine = document.lineAt(startLine - 1).text;
            if (prevLine.includes('@gl.public.write')) {
                return 'None';
            }
        }
        
        return null;
    }
    
    private findMethodEnd(document: vscode.TextDocument, startLine: number): number {
        const baseIndent = document.lineAt(startLine).text.match(/^\s*/)?.[0].length || 0;
        
        for (let i = startLine + 1; i < document.lineCount; i++) {
            const line = document.lineAt(i).text;
            if (line.trim()) {
                const currentIndent = line.match(/^\s*/)?.[0].length || 0;
                if (currentIndent <= baseIndent) {
                    return i - 1;
                }
            }
        }
        
        return document.lineCount - 1;
    }
    
    private isGenVMType(type: string): boolean {
        const genvmTypes = [
            'u8', 'u16', 'u32', 'u64', 'u128', 'u256',
            'i8', 'i16', 'i32', 'i64', 'i128', 'i256',
            'TreeMap', 'DynArray', 'Address'
        ];
        
        return genvmTypes.some(t => type.includes(t));
    }
    
    private getActualStorageType(type: string): string {
        // Map to actual storage representation
        const mappings: { [key: string]: string } = {
            'u8': 'uint8',
            'u16': 'uint16',
            'u32': 'uint32',
            'u64': 'uint64',
            'u128': 'uint128',
            'u256': 'uint256',
            'TreeMap': 'mapping',
            'DynArray': 'dynamic array',
        };
        
        for (const [from, to] of Object.entries(mappings)) {
            if (type.includes(from)) {
                return type.replace(from, to);
            }
        }
        
        return type;
    }
}