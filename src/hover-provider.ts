import * as vscode from 'vscode';

interface GenVMTypeInfo {
    name: string;
    description: string;
    example?: string;
    gasCost?: string;
    documentation?: string;
}

export class GenVMHoverProvider implements vscode.HoverProvider {
    
    private typeInfo: Map<string, GenVMTypeInfo> = new Map([
        // Unsigned integers
        ['u8', {
            name: 'u8',
            description: 'Unsigned 8-bit integer (0 to 255)',
            example: 'u8(255)',
            documentation: 'https://docs.genlayer.com/developers/intelligent-contracts/types/primitive'
        }],
        ['u16', {
            name: 'u16',
            description: 'Unsigned 16-bit integer (0 to 65,535)',
            example: 'u16(65535)',
            documentation: 'https://docs.genlayer.com/developers/intelligent-contracts/types/primitive'
        }],
        ['u32', {
            name: 'u32',
            description: 'Unsigned 32-bit integer (0 to 4,294,967,295)',
            example: 'u32(4294967295)',
            documentation: 'https://docs.genlayer.com/developers/intelligent-contracts/types/primitive'
        }],
        ['u64', {
            name: 'u64',
            description: 'Unsigned 64-bit integer',
            example: 'u64(18446744073709551615)',
            documentation: 'https://docs.genlayer.com/developers/intelligent-contracts/types/primitive'
        }],
        ['u128', {
            name: 'u128',
            description: 'Unsigned 128-bit integer',
            example: 'u128(2**128 - 1)',
            documentation: 'https://docs.genlayer.com/developers/intelligent-contracts/types/primitive'
        }],
        ['u256', {
            name: 'u256',
            description: 'Unsigned 256-bit integer',
            example: 'u256(1000000)',
            documentation: 'https://docs.genlayer.com/developers/intelligent-contracts/types/primitive'
        }],
        // Signed integers
        ['i8', {
            name: 'i8',
            description: 'Signed 8-bit integer (-128 to 127)',
            example: 'i8(-128)',
            documentation: 'https://docs.genlayer.com/developers/intelligent-contracts/types/primitive'
        }],
        ['i16', {
            name: 'i16',
            description: 'Signed 16-bit integer (-32,768 to 32,767)',
            example: 'i16(-32768)',
            documentation: 'https://docs.genlayer.com/developers/intelligent-contracts/types/primitive'
        }],
        ['i32', {
            name: 'i32',
            description: 'Signed 32-bit integer',
            example: 'i32(-2147483648)',
            documentation: 'https://docs.genlayer.com/developers/intelligent-contracts/types/primitive'
        }],
        ['i64', {
            name: 'i64',
            description: 'Signed 64-bit integer',
            example: 'i64(-9223372036854775808)',
            documentation: 'https://docs.genlayer.com/developers/intelligent-contracts/types/primitive'
        }],
        ['i128', {
            name: 'i128',
            description: 'Signed 128-bit integer',
            example: 'i128(-2**127)',
            documentation: 'https://docs.genlayer.com/developers/intelligent-contracts/types/primitive'
        }],
        ['i256', {
            name: 'i256',
            description: 'Signed 256-bit integer',
            example: 'i256(-2**255)',
            documentation: 'https://docs.genlayer.com/developers/intelligent-contracts/types/primitive'
        }],
        // Special types
        ['bigint', {
            name: 'bigint',
            description: 'Arbitrary precision integer (use with caution)',
            example: 'bigint(10**100)',
            documentation: 'https://docs.genlayer.com/developers/intelligent-contracts/types/primitive'
        }],
        ['Address', {
            name: 'Address',
            description: 'GenVM address type (20 bytes)',
            example: 'Address("0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6")',
            documentation: 'https://docs.genlayer.com/developers/intelligent-contracts/types/address'
        }],
        ['TreeMap', {
            name: 'TreeMap',
            description: 'Ordered mapping data structure',
            example: 'TreeMap[Address, u256]()',
            documentation: 'https://docs.genlayer.com/developers/intelligent-contracts/types/collections'
        }],
        ['DynArray', {
            name: 'DynArray',
            description: 'Dynamic array data structure',
            example: 'DynArray[u256]()',
            documentation: 'https://docs.genlayer.com/developers/intelligent-contracts/types/collections'
        }],
    ]);
    
    private methodInfo: Map<string, GenVMTypeInfo> = new Map([
        ['gl.public.view', {
            name: '@gl.public.view',
            description: 'Decorator for read-only public methods',
            example: '@gl.public.view\ndef get_balance(self, account: Address) -> int:'
            // No documentation link - decorators don't have dedicated pages
        }],
        ['gl.public.write', {
            name: '@gl.public.write',
            description: 'Decorator for state-modifying public methods',
            example: '@gl.public.write\ndef transfer(self, to: Address, amount: int):'
            // No documentation link - decorators don't have dedicated pages
        }],
        ['gl.ContractAt', {
            name: 'gl.ContractAt',
            description: 'Create a proxy to interact with a deployed contract',
            example: 'contract = gl.ContractAt(address)\nresult = contract.view().method_name()',
            documentation: 'https://docs.genlayer.com/developers/intelligent-contracts/advanced-features/contract-to-contract-interaction'
        }],
        ['gl.eq_principle.strict_eq', {
            name: 'gl.eq_principle.strict_eq',
            description: 'Strict equality check for deterministic consensus',
            example: 'result = gl.eq_principle.strict_eq(lambda: api_call())',
            documentation: 'https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle'
        }],
        ['gl.eq_principle.prompt_comparative', {
            name: 'gl.eq_principle.prompt_comparative',
            description: 'Comparative equivalence principle using LLMs',
            example: 'gl.eq_principle.prompt_comparative(lambda: fetch_data(), "Results must not differ by more than 5%")',
            documentation: 'https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle'
        }],
        ['gl.eq_principle.prompt_non_comparative', {
            name: 'gl.eq_principle.prompt_non_comparative',
            description: 'Non-comparative equivalence for subjective NLP tasks',
            example: 'gl.eq_principle.prompt_non_comparative(input_func, task="Classify sentiment", criteria="Must be positive, negative, or neutral")',
            documentation: 'https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle'
        }],
    ]);
    
    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Hover> {
        
        const range = document.getWordRangeAtPosition(position);
        if (!range) {
            return undefined;
        }
        
        const word = document.getText(range);
        const line = document.lineAt(position.line).text;
        
        // Check for different hover contexts
        let hoverContent: vscode.MarkdownString | undefined;
        
        // 1. GenVM types
        if (this.typeInfo.has(word)) {
            hoverContent = this.createTypeHover(word);
        }
        
        // 2. GenVM methods and decorators
        const fullMethod = this.extractFullMethodName(line, position);
        if (fullMethod && this.methodInfo.has(fullMethod)) {
            hoverContent = this.createMethodHover(fullMethod);
        }
        
        // 3. Variable information
        const varInfo = this.getVariableInfo(document, word, position);
        if (varInfo) {
            hoverContent = this.createVariableHover(varInfo);
        }
        
        // 4. Function/method signature
        const funcSignature = this.getFunctionSignature(document, word, position);
        if (funcSignature) {
            hoverContent = this.createFunctionHover(funcSignature);
        }
        
        // 5. Security warnings
        const securityWarning = this.checkSecurityIssues(line, word);
        if (securityWarning) {
            if (hoverContent) {
                hoverContent.appendMarkdown('\n\n---\n\n');
                hoverContent.appendMarkdown(securityWarning);
            } else {
                hoverContent = new vscode.MarkdownString(securityWarning);
            }
        }
        
        return hoverContent ? new vscode.Hover(hoverContent, range) : undefined;
    }
    
    private createTypeHover(typeName: string): vscode.MarkdownString {
        const info = this.typeInfo.get(typeName)!;
        const content = new vscode.MarkdownString();
        
        content.appendCodeblock(`type ${info.name}`, 'python');
        content.appendMarkdown(`\n${info.description}\n\n`);
        
        if (info.example) {
            content.appendMarkdown('**Example:**\n');
            content.appendCodeblock(info.example, 'python');
        }
        
        if (info.gasCost) {
            content.appendMarkdown(`\n**Gas Cost:** ${info.gasCost}\n`);
        }
        
        if (info.documentation) {
            content.appendMarkdown(`\n[📖 Documentation](${info.documentation})`);
        }
        
        return content;
    }
    
    private createMethodHover(methodName: string): vscode.MarkdownString {
        const info = this.methodInfo.get(methodName)!;
        const content = new vscode.MarkdownString();
        
        content.appendCodeblock(info.name, 'python');
        content.appendMarkdown(`\n${info.description}\n\n`);
        
        if (info.example) {
            content.appendMarkdown('**Example:**\n');
            content.appendCodeblock(info.example, 'python');
        }
        
        if (info.documentation) {
            content.appendMarkdown(`\n[📖 Documentation](${info.documentation})`);
        }
        
        return content;
    }
    
    private createVariableHover(varInfo: any): vscode.MarkdownString {
        const content = new vscode.MarkdownString();
        
        content.appendCodeblock(`(variable) ${varInfo.name}: ${varInfo.type}`, 'python');
        
        if (varInfo.value) {
            content.appendMarkdown(`\n**Current value:** \`${varInfo.value}\`\n`);
        }
        
        if (varInfo.isStorage) {
            content.appendMarkdown('\n**📦 Storage Variable**\n');
            content.appendMarkdown('This variable is stored on-chain and modifying it costs gas.\n');
        }
        
        if (varInfo.declaration) {
            content.appendMarkdown('\n**Declared at:** ');
            content.appendMarkdown(`Line ${varInfo.declaration.line + 1}`);
        }
        
        return content;
    }
    
    private createFunctionHover(signature: any): vscode.MarkdownString {
        const content = new vscode.MarkdownString();
        
        content.appendCodeblock(signature.full, 'python');
        
        if (signature.docstring) {
            content.appendMarkdown(`\n${signature.docstring}\n`);
        }
        
        if (signature.parameters.length > 0) {
            content.appendMarkdown('\n**Parameters:**\n');
            for (const param of signature.parameters) {
                content.appendMarkdown(`- \`${param.name}\`: ${param.type || 'Any'}`);
                if (param.description) {
                    content.appendMarkdown(` — ${param.description}`);
                }
                content.appendMarkdown('\n');
            }
        }
        
        if (signature.returns) {
            content.appendMarkdown(`\n**Returns:** \`${signature.returns}\`\n`);
        }
        
        if (signature.decorator) {
            if (signature.decorator.includes('write')) {
                content.appendMarkdown('\n⚠️ **State Modification:** This method modifies contract state\n');
            } else if (signature.decorator.includes('view')) {
                content.appendMarkdown('\n✅ **Read-only:** This method does not modify state\n');
            }
        }
        
        return content;
    }
    
    private extractFullMethodName(line: string, position: vscode.Position): string | null {
        // Extract full method name like gl.eq_principle.strict_eq
        const beforeCursor = line.substring(0, position.character + 10);
        const match = beforeCursor.match(/gl\.[\w.]+/);
        return match ? match[0] : null;
    }
    
    private getVariableInfo(document: vscode.TextDocument, varName: string, position: vscode.Position): any | null {
        // Search for variable declaration
        for (let i = position.line - 1; i >= 0; i--) {
            const line = document.lineAt(i).text;
            
            // Check for variable assignment with type
            const typeMatch = line.match(new RegExp(`${varName}\\s*:\\s*(\\w+)\\s*=\\s*(.+)`));
            if (typeMatch) {
                return {
                    name: varName,
                    type: typeMatch[1],
                    value: typeMatch[2].trim(),
                    declaration: { line: i },
                    isStorage: false
                };
            }
            
            // Check for simple assignment
            const assignMatch = line.match(new RegExp(`${varName}\\s*=\\s*(.+)`));
            if (assignMatch) {
                const inferredType = this.inferType(assignMatch[1]);
                return {
                    name: varName,
                    type: inferredType || 'Any',
                    value: assignMatch[1].trim(),
                    declaration: { line: i },
                    isStorage: false
                };
            }
            
            // Check for class attribute (storage)
            if (line.match(new RegExp(`^\\s+${varName}\\s*:`))) {
                const typeMatch = line.match(new RegExp(`${varName}\\s*:\\s*(\\w+)`));
                return {
                    name: varName,
                    type: typeMatch ? typeMatch[1] : 'Any',
                    isStorage: true,
                    declaration: { line: i }
                };
            }
        }
        
        return null;
    }
    
    private getFunctionSignature(document: vscode.TextDocument, funcName: string, position: vscode.Position): any | null {
        const text = document.getText();
        const funcPattern = new RegExp(`def\\s+${funcName}\\s*\\(([^)]*)\\)\\s*(?:->\\s*([^:]+))?:`, 'g');
        const match = funcPattern.exec(text);
        
        if (match) {
            const params = match[1];
            const returnType = match[2];
            
            // Parse parameters
            const parameters = this.parseParameters(params);
            
            // Get decorator if any
            const funcPos = document.positionAt(match.index);
            let decorator = null;
            if (funcPos.line > 0) {
                const prevLine = document.lineAt(funcPos.line - 1).text;
                if (prevLine.includes('@gl.public')) {
                    decorator = prevLine.trim();
                }
            }
            
            // Get docstring if any
            const docstring = this.extractDocstring(document, funcPos.line + 1);
            
            return {
                full: `def ${funcName}(${params})${returnType ? ' -> ' + returnType : ''}`,
                name: funcName,
                parameters,
                returns: returnType || 'None',
                decorator,
                docstring
            };
        }
        
        return null;
    }
    
    private parseParameters(params: string): any[] {
        const parameters: any[] = [];
        const paramList = params.split(',');
        
        for (const param of paramList) {
            const trimmed = param.trim();
            if (!trimmed || trimmed === 'self') continue;
            
            const match = trimmed.match(/(\w+)\s*(?::\s*([^=]+))?\s*(?:=\s*(.+))?/);
            if (match) {
                parameters.push({
                    name: match[1],
                    type: match[2]?.trim(),
                    default: match[3]?.trim()
                });
            }
        }
        
        return parameters;
    }
    
    private extractDocstring(document: vscode.TextDocument, startLine: number): string | null {
        if (startLine >= document.lineCount) return null;
        
        const line = document.lineAt(startLine).text.trim();
        if (line.startsWith('"""') || line.startsWith("'''")) {
            const quote = line.substring(0, 3);
            let docstring = line.substring(3);
            
            if (docstring.endsWith(quote)) {
                return docstring.substring(0, docstring.length - 3).trim();
            }
            
            // Multi-line docstring
            for (let i = startLine + 1; i < document.lineCount; i++) {
                const nextLine = document.lineAt(i).text;
                docstring += '\n' + nextLine;
                if (nextLine.includes(quote)) {
                    return docstring.substring(0, docstring.lastIndexOf(quote)).trim();
                }
            }
        }
        
        return null;
    }
    
    private checkSecurityIssues(line: string, word: string): string | null {
        const warnings: string[] = [];
        
        // Check for common security issues
        if (line.includes('eval(') || line.includes('exec(')) {
            warnings.push('⚠️ **Security Warning:** Avoid using eval/exec with user input');
        }
        
        if (word === 'transfer' && !line.includes('require') && !line.includes('assert')) {
            warnings.push('⚠️ **Security:** Consider adding checks before transfer');
        }
        
        if (line.includes('selfdestruct')) {
            warnings.push('🔴 **Critical:** selfdestruct permanently destroys the contract');
        }
        
        if (line.includes('delegatecall')) {
            warnings.push('⚠️ **Security:** delegatecall can be dangerous if not used carefully');
        }
        
        return warnings.length > 0 ? warnings.join('\n\n') : null;
    }
    
    private inferType(value: string): string | null {
        value = value.trim();
        
        if (value.match(/^u\d+\(/)) return value.split('(')[0];
        if (value.startsWith('Address(')) return 'Address';
        if (value.startsWith('gl.ContractAt(')) return 'ContractProxy';
        if (value.match(/^\d+$/)) return 'int';
        if (value.startsWith('"') || value.startsWith("'")) return 'str';
        if (value === 'True' || value === 'False') return 'bool';
        if (value.startsWith('[')) return 'list';
        if (value.startsWith('{')) return 'dict';
        
        return null;
    }
}