import * as vscode from 'vscode';

export class GenVMCodeActionProvider implements vscode.CodeActionProvider {
    
    public static readonly providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix,
        vscode.CodeActionKind.Refactor,
        vscode.CodeActionKind.RefactorExtract
    ];

    provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
        
        const actions: vscode.CodeAction[] = [];
        
        // Process diagnostics for quick fixes
        for (const diagnostic of context.diagnostics) {
            // Fix missing decorator
            if (diagnostic.message.includes('missing @gl.public decorator')) {
                actions.push(this.createAddDecoratorFix(document, diagnostic));
            }
            
            // Fix int to sized type conversion
            if (diagnostic.message.includes('incompatible type') && diagnostic.message.includes('int')) {
                actions.push(this.createConvertToSizedTypeFix(document, diagnostic));
            }
            
            // Fix missing import
            if (diagnostic.message.includes('is not defined') || diagnostic.message.includes('No module named')) {
                actions.push(this.createAddImportFix(document, diagnostic));
            }
            
            // Fix write method returning value
            if (diagnostic.message.includes('should not return a value')) {
                actions.push(this.createRemoveReturnFix(document, diagnostic));
            }
            
            // Fix missing __init__ method
            if (diagnostic.message.includes('missing __init__ method')) {
                actions.push(this.createAddInitMethodFix(document, diagnostic));
            }
            
            // Fix sized types in return type
            if (diagnostic.message.includes('should not be used in return types')) {
                actions.push(this.createFixReturnTypeFix(document, diagnostic));
            }
        }
        
        // Add refactoring actions if text is selected
        if (!range.isEmpty) {
            actions.push(this.createExtractMethodAction(document, range));
            actions.push(this.createExtractVariableAction(document, range));
        }
        
        return actions;
    }
    
    private createAddDecoratorFix(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction {
        const fix = new vscode.CodeAction(
            'Add @gl.public.view decorator',
            vscode.CodeActionKind.QuickFix
        );
        
        fix.edit = new vscode.WorkspaceEdit();
        
        // Find the method definition line
        const line = diagnostic.range.start.line;
        const methodLine = document.lineAt(line);
        const indent = methodLine.text.match(/^\s*/)?.[0] || '    ';
        
        // Check if method likely modifies state
        const methodText = this.getMethodText(document, line);
        const isWrite = this.looksLikeWriteMethod(methodText);
        
        const decorator = isWrite ? '@gl.public.write' : '@gl.public.view';
        
        // Insert decorator above the method
        fix.edit.insert(
            document.uri,
            new vscode.Position(line, 0),
            `${indent}${decorator}\n`
        );
        
        fix.diagnostics = [diagnostic];
        fix.isPreferred = true;
        
        return fix;
    }
    
    private createConvertToSizedTypeFix(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction {
        const fix = new vscode.CodeAction(
            'Convert to sized type',
            vscode.CodeActionKind.QuickFix
        );
        
        fix.edit = new vscode.WorkspaceEdit();
        
        // Extract the target type from diagnostic message
        const typeMatch = diagnostic.message.match(/expected ["']([ui]\d+)["']/);
        if (typeMatch) {
            const targetType = typeMatch[1];
            const range = diagnostic.range;
            const text = document.getText(range);
            
            // Wrap the value with type constructor
            fix.edit.replace(
                document.uri,
                range,
                `${targetType}(${text})`
            );
        }
        
        fix.diagnostics = [diagnostic];
        return fix;
    }
    
    private createAddImportFix(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction {
        const fix = new vscode.CodeAction(
            'Add import from genlayer',
            vscode.CodeActionKind.QuickFix
        );
        
        fix.edit = new vscode.WorkspaceEdit();
        
        // Find where to insert import
        let importLine = 0;
        let hasImports = false;
        
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i).text;
            if (line.startsWith('import ') || line.startsWith('from ')) {
                hasImports = true;
                importLine = i + 1;
            } else if (hasImports && !line.trim().startsWith('#')) {
                break;
            }
        }
        
        // Check what needs to be imported
        const missingSymbol = diagnostic.message.match(/["'](\w+)["'] is not defined/)?.[1];
        let importStatement = 'from genlayer import gl\n';
        
        if (missingSymbol === 'Address') {
            importStatement = 'from genlayer import Address\n';
        } else if (missingSymbol && missingSymbol.match(/^[ui]\d+$/)) {
            importStatement = `from genlayer import ${missingSymbol}\n`;
        }
        
        fix.edit.insert(
            document.uri,
            new vscode.Position(importLine, 0),
            importStatement
        );
        
        fix.diagnostics = [diagnostic];
        return fix;
    }
    
    private createAddInitMethodFix(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction {
        const fix = new vscode.CodeAction(
            'Add __init__ method',
            vscode.CodeActionKind.QuickFix
        );
        
        fix.edit = new vscode.WorkspaceEdit();
        
        // Find the class definition line
        const classLine = diagnostic.range.start.line;
        const classText = document.lineAt(classLine).text;
        const indent = '    '; // Standard Python indentation
        
        // Find the line after the class definition to insert __init__
        let insertLine = classLine + 1;
        let foundDocstring = false;
        
        // Skip past class docstring if present
        for (let i = classLine + 1; i < document.lineCount; i++) {
            const line = document.lineAt(i).text;
            const trimmed = line.trim();
            
            // Check for docstring
            if (!foundDocstring && (trimmed.startsWith('"""') || trimmed.startsWith("'''"))) {
                foundDocstring = true;
                // Find end of docstring
                const quote = trimmed.substring(0, 3);
                if (trimmed.endsWith(quote) && trimmed.length > 6) {
                    // Single line docstring
                    insertLine = i + 1;
                    break;
                } else {
                    // Multi-line docstring
                    for (let j = i + 1; j < document.lineCount; j++) {
                        if (document.lineAt(j).text.includes(quote)) {
                            insertLine = j + 1;
                            break;
                        }
                    }
                    break;
                }
            } else if (trimmed && !trimmed.startsWith('#')) {
                // Found non-comment, non-docstring content
                insertLine = i;
                break;
            }
        }
        
        // Create the __init__ method
        const initMethod = `${indent}def __init__(self):\n${indent}${indent}pass\n`;
        
        // Insert the __init__ method
        fix.edit.insert(
            document.uri,
            new vscode.Position(insertLine, 0),
            `\n${initMethod}`
        );
        
        fix.diagnostics = [diagnostic];
        fix.isPreferred = true;
        
        return fix;
    }
    
    private createFixReturnTypeFix(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction {
        const fix = new vscode.CodeAction(
            'Replace sized type with int',
            vscode.CodeActionKind.QuickFix
        );
        
        fix.edit = new vscode.WorkspaceEdit();
        
        // Get the line with the return type
        const line = diagnostic.range.start.line;
        const lineText = document.lineAt(line).text;
        
        // Find the return type annotation
        const returnTypeMatch = lineText.match(/\)\s*->\s*([ui]\d+)/);
        if (returnTypeMatch) {
            const sizedType = returnTypeMatch[1];
            const startIndex = lineText.indexOf('->') + 2;
            const endIndex = startIndex + sizedType.length;
            
            // Replace the sized type with 'int'
            fix.edit.replace(
                document.uri,
                new vscode.Range(
                    line,
                    lineText.indexOf('->') + 3, // Skip past '-> '
                    line,
                    lineText.indexOf('->') + 3 + sizedType.length
                ),
                'int'
            );
        }
        
        fix.diagnostics = [diagnostic];
        fix.isPreferred = true;
        
        return fix;
    }
    
    private createRemoveReturnFix(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction {
        const fix = new vscode.CodeAction(
            'Remove return statement',
            vscode.CodeActionKind.QuickFix
        );
        
        fix.edit = new vscode.WorkspaceEdit();
        
        // Find return statements in the method
        const methodStart = diagnostic.range.start.line;
        const methodText = this.getMethodText(document, methodStart);
        
        // Simple approach: comment out return statements
        const lines = methodText.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith('return ') && !lines[i].includes('return None')) {
                const lineNum = methodStart + i;
                const line = document.lineAt(lineNum);
                fix.edit.replace(
                    document.uri,
                    line.range,
                    line.text.replace(/return\s+/, '# return ')
                );
            }
        }
        
        fix.diagnostics = [diagnostic];
        return fix;
    }
    
    private createExtractMethodAction(document: vscode.TextDocument, range: vscode.Range): vscode.CodeAction {
        const action = new vscode.CodeAction(
            'Extract Method',
            vscode.CodeActionKind.RefactorExtract
        );
        
        action.edit = new vscode.WorkspaceEdit();
        
        const selectedText = document.getText(range);
        const indent = document.lineAt(range.start.line).text.match(/^\s*/)?.[0] || '    ';
        
        // Generate method name
        const methodName = '_extracted_method';
        
        // Create the new method
        const newMethod = `${indent}def ${methodName}(self):\n${indent}    ${selectedText.replace(/\n/g, '\n    ')}`;
        
        // Replace selection with method call
        action.edit.replace(document.uri, range, `self.${methodName}()`);
        
        // Find where to insert the new method (after current method)
        const currentLine = range.end.line;
        let insertLine = currentLine + 1;
        for (let i = currentLine + 1; i < document.lineCount; i++) {
            const line = document.lineAt(i).text;
            if (line.trim() && !line.trim().startsWith('#')) {
                if (line.match(/^\s*(def|class|@)/)) {
                    insertLine = i;
                    break;
                }
            }
        }
        
        action.edit.insert(
            document.uri,
            new vscode.Position(insertLine, 0),
            `\n${newMethod}\n`
        );
        
        return action;
    }
    
    private createExtractVariableAction(document: vscode.TextDocument, range: vscode.Range): vscode.CodeAction {
        const action = new vscode.CodeAction(
            'Extract Variable',
            vscode.CodeActionKind.RefactorExtract
        );
        
        action.edit = new vscode.WorkspaceEdit();
        
        const selectedText = document.getText(range);
        const indent = document.lineAt(range.start.line).text.match(/^\s*/)?.[0] || '    ';
        
        // Generate variable name
        const varName = 'extracted_value';
        
        // Insert variable assignment before current line
        action.edit.insert(
            document.uri,
            new vscode.Position(range.start.line, 0),
            `${indent}${varName} = ${selectedText}\n`
        );
        
        // Replace selection with variable
        action.edit.replace(document.uri, range, varName);
        
        return action;
    }
    
    private getMethodText(document: vscode.TextDocument, startLine: number): string {
        const lines: string[] = [];
        const baseIndent = document.lineAt(startLine).text.match(/^\s*/)?.[0].length || 0;
        
        for (let i = startLine; i < document.lineCount; i++) {
            const line = document.lineAt(i).text;
            const currentIndent = line.match(/^\s*/)?.[0].length || 0;
            
            if (i > startLine && currentIndent <= baseIndent && line.trim()) {
                break;
            }
            
            lines.push(line);
        }
        
        return lines.join('\n');
    }
    
    private looksLikeWriteMethod(methodText: string): boolean {
        // Check for state modifications
        const writePatterns = [
            /self\.\w+\s*=/,
            /self\.\w+\[.+\]\s*=/,
            /self\.\w+\s*\+=/,
            /self\.\w+\.append/,
            /self\.\w+\.remove/,
            /self\.\w+\.update/,
        ];
        
        return writePatterns.some(pattern => pattern.test(methodText));
    }
}