import * as vscode from 'vscode';
import { GenVMLinter, GenVMLintResult } from './genvm-linter';

export class GenVMDiagnosticsProvider implements vscode.Disposable {
    private diagnosticsCollection: vscode.DiagnosticCollection;
    private linter: GenVMLinter;
    private outputChannel: vscode.OutputChannel;

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
        this.diagnosticsCollection = vscode.languages.createDiagnosticCollection('genvm');
        this.linter = new GenVMLinter(outputChannel);
    }

    public reloadConfiguration(): void {
        this.linter.reloadConfiguration();
    }

    public async lintDocument(document: vscode.TextDocument): Promise<void> {
        this.outputChannel.appendLine(`GenVM: Starting lint for ${document.fileName}`);
        try {
            const results = await this.linter.lintDocument(document);
            this.outputChannel.appendLine(`GenVM: Linter returned ${results.length} results`);
            const diagnostics = this.convertResultsToDiagnostics(results);
            
            this.diagnosticsCollection.set(document.uri, diagnostics);
            
            if (results.length > 0) {
                this.outputChannel.appendLine(`GenVM: Found ${results.length} issues in ${document.fileName}`);
                results.forEach(r => {
                    this.outputChannel.appendLine(`  - Line ${r.line}: ${r.message}`);
                });
            } else {
                this.outputChannel.appendLine(`GenVM: No issues found in ${document.fileName}`);
            }
        } catch (error) {
            this.outputChannel.appendLine(`GenVM Diagnostics Error: ${error}`);
        }
    }

    public async lintWorkspace(): Promise<void> {
        const pythonFiles = await vscode.workspace.findFiles('**/*.py', '**/node_modules/**');
        
        this.outputChannel.appendLine(`GenVM: Linting ${pythonFiles.length} Python files in workspace...`);
        
        for (const file of pythonFiles) {
            try {
                const document = await vscode.workspace.openTextDocument(file);
                if (this.isGenVMFile(document)) {
                    await this.lintDocument(document);
                }
            } catch (error) {
                this.outputChannel.appendLine(`GenVM: Error linting ${file.fsPath}: ${error}`);
            }
        }
        
        this.outputChannel.appendLine('GenVM: Workspace linting completed');
    }

    public async testLinter(document: vscode.TextDocument): Promise<GenVMLintResult[]> {
        this.outputChannel.appendLine(`Testing linter on: ${document.fileName}`);
        
        try {
            const results = await this.linter.lintDocument(document);
            this.outputChannel.appendLine(`Found ${results.length} issues:`);
            
            results.forEach((result, index) => {
                this.outputChannel.appendLine(`  ${index + 1}. [${result.rule_id}] ${result.severity}: ${result.message} (Line ${result.line})`);
                if (result.suggestion) {
                    this.outputChannel.appendLine(`     💡 ${result.suggestion}`);
                }
            });
            
            return results;
        } catch (error) {
            this.outputChannel.appendLine(`Error testing linter: ${error}`);
            throw error;
        }
    }

    private convertResultsToDiagnostics(results: GenVMLintResult[]): vscode.Diagnostic[] {
        return results.map(result => {
            const line = Math.max(0, result.line - 1); // VS Code uses 0-based line numbers
            const column = Math.max(0, result.column);
            
            const range = new vscode.Range(
                new vscode.Position(line, column),
                new vscode.Position(line, column + 1)
            );

            const severity = this.mapSeverity(result.severity);
            const diagnostic = new vscode.Diagnostic(range, result.message, severity);
            
            diagnostic.code = result.rule_id;
            diagnostic.source = 'GenVM Linter';
            
            // Add suggestion as related information if available
            if (result.suggestion) {
                diagnostic.relatedInformation = [
                    new vscode.DiagnosticRelatedInformation(
                        new vscode.Location(vscode.Uri.parse(''), range),
                        `💡 Suggestion: ${result.suggestion}`
                    )
                ];
            }

            return diagnostic;
        });
    }

    private mapSeverity(severity: string): vscode.DiagnosticSeverity {
        switch (severity) {
            case 'error':
                return vscode.DiagnosticSeverity.Error;
            case 'warning':
                return vscode.DiagnosticSeverity.Warning;
            case 'info':
                return vscode.DiagnosticSeverity.Information;
            default:
                return vscode.DiagnosticSeverity.Warning;
        }
    }

    private isGenVMFile(document: vscode.TextDocument): boolean {
        // Check if file contains GenVM magic comment
        if (document.lineCount > 0) {
            const firstLine = document.lineAt(0).text.trim();
            return /^#\s*\{\s*"Depends"\s*:\s*"py-genlayer:/.test(firstLine);
        }
        
        // Also check filename patterns that might indicate GenVM contracts
        const fileName = document.fileName.toLowerCase();
        return fileName.includes('contract') || 
               fileName.includes('genvm') || 
               fileName.includes('genlayer');
    }

    public dispose(): void {
        this.diagnosticsCollection.dispose();
    }
}