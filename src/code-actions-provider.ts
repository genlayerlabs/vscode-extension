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