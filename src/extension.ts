import * as vscode from 'vscode';
import { GenVMLinter } from './genvm-linter';
import { GenVMDiagnosticsProvider } from './diagnostics-provider';
import { GenVMCompletionProvider } from './autocomplete-provider';
import { GenVMSignatureHelpProvider, GL_SIGNATURE_HELP_TRIGGER_CHARACTERS } from './signature-provider';

let diagnosticsProvider: GenVMDiagnosticsProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('GenVM Linter extension is now active');

    // Create output channel for GenVM
    const outputChannel = vscode.window.createOutputChannel('GenVM Linter');
    
    // Initialize diagnostics provider
    diagnosticsProvider = new GenVMDiagnosticsProvider(outputChannel);
    
    // Register language support providers
    const completionProvider = vscode.languages.registerCompletionItemProvider(
        [{ language: 'python' }, { language: 'genvm-python' }],
        new GenVMCompletionProvider(),
        '.', 'g', 'l', 'A' // Trigger on dot, gl, and Address
    );
    
    const signatureProvider = vscode.languages.registerSignatureHelpProvider(
        [{ language: 'python' }, { language: 'genvm-python' }],
        new GenVMSignatureHelpProvider(),
        ...GL_SIGNATURE_HELP_TRIGGER_CHARACTERS
    );
    
    // Register commands
    const lintCurrentFileCommand = vscode.commands.registerCommand('genvm.lintCurrentFile', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && (editor.document.languageId === 'python' || editor.document.languageId === 'genvm-python')) {
            diagnosticsProvider.lintDocument(editor.document);
        } else {
            vscode.window.showWarningMessage('GenVM Linter: Please open a Python file');
        }
    });

    const lintWorkspaceCommand = vscode.commands.registerCommand('genvm.lintWorkspace', () => {
        diagnosticsProvider.lintWorkspace();
    });

    const showOutputCommand = vscode.commands.registerCommand('genvm.showOutputChannel', () => {
        outputChannel.show();
    });

    // Debug commands
    const debugCommand = vscode.commands.registerCommand('genvm.debug', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            outputChannel.appendLine(`=== GenVM Debug Info ===`);
            outputChannel.appendLine(`Active file: ${editor.document.fileName}`);
            outputChannel.appendLine(`Language ID: ${editor.document.languageId}`);
            outputChannel.appendLine(`Line count: ${editor.document.lineCount}`);
            
            if (editor.document.lineCount > 0) {
                const firstLine = editor.document.lineAt(0).text;
                outputChannel.appendLine(`First line: ${firstLine}`);
                
                const isGenVM = isGenVMFile(editor.document);
                outputChannel.appendLine(`Is GenVM file: ${isGenVM}`);
            }
            outputChannel.show();
        }
    });

    const testLintCommand = vscode.commands.registerCommand('genvm.testLint', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            outputChannel.appendLine('No active editor');
            return;
        }
        
        outputChannel.appendLine('=== Testing GenVM Linter ===');
        outputChannel.show();
        
        try {
            const results = await diagnosticsProvider.testLinter(editor.document);
            outputChannel.appendLine(`Test completed: ${results.length} issues found`);
        } catch (error) {
            outputChannel.appendLine(`Test failed: ${error}`);
        }
    });

    // Register event listeners
    const onDidSaveDocument = vscode.workspace.onDidSaveTextDocument((document) => {
        if (document.languageId === 'python' || document.languageId === 'genvm-python') {
            diagnosticsProvider.lintDocument(document);
        }
    });

    const onDidOpenDocument = vscode.workspace.onDidOpenTextDocument((document) => {
        if ((document.languageId === 'python' || document.languageId === 'genvm-python') && isGenVMFile(document)) {
            diagnosticsProvider.lintDocument(document);
        }
    });

    const onDidChangeActiveEditor = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && (editor.document.languageId === 'python' || editor.document.languageId === 'genvm-python') && isGenVMFile(editor.document)) {
            diagnosticsProvider.lintDocument(editor.document);
        }
    });

    // Lint when document content changes (real-time)
    const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument((event) => {
        const document = event.document;
        if (document.languageId === 'python' || document.languageId === 'genvm-python') {
            diagnosticsProvider.lintDocument(document);
        }
    });

    // Register configuration change listener
    const onDidChangeConfiguration = vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('genvm')) {
            // Reload configuration and re-lint open documents
            diagnosticsProvider.reloadConfiguration();
            vscode.workspace.textDocuments.forEach(document => {
                if (document.languageId === 'python' && isGenVMFile(document)) {
                    diagnosticsProvider.lintDocument(document);
                }
            });
        }
    });

    // Add all disposables to context
    context.subscriptions.push(
        lintCurrentFileCommand,
        lintWorkspaceCommand,
        showOutputCommand,
        debugCommand,
        testLintCommand,
        onDidSaveDocument,
        onDidOpenDocument,
        onDidChangeActiveEditor,
        onDidChangeTextDocument,
        onDidChangeConfiguration,
        completionProvider,
        signatureProvider,
        diagnosticsProvider,
        outputChannel
    );

    // Lint currently open Python documents
    vscode.workspace.textDocuments.forEach(document => {
        if ((document.languageId === 'python' || document.languageId === 'genvm-python') && isGenVMFile(document)) {
            diagnosticsProvider.lintDocument(document);
        }
    });
    
    // Also ensure the currently active editor is linted on activation
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && 
        (activeEditor.document.languageId === 'python' || activeEditor.document.languageId === 'genvm-python') && 
        isGenVMFile(activeEditor.document)) {
        // Add a small delay to ensure extension is fully initialized
        setTimeout(() => {
            diagnosticsProvider.lintDocument(activeEditor.document);
        }, 100);
    }
}

export function deactivate() {
    if (diagnosticsProvider) {
        diagnosticsProvider.dispose();
    }
}

function isGenVMFile(document: vscode.TextDocument): boolean {
    // Check if file contains GenVM magic comment
    if (document.lineCount > 0) {
        const firstLine = document.lineAt(0).text.trim();
        if (/^#\s*\{\s*"Depends"\s*:\s*"py-genlayer:/.test(firstLine)) {
            return true;
        }
    }
    
    // Check filename patterns that might indicate GenVM contracts
    const fileName = document.fileName.toLowerCase();
    if (fileName.includes('contract') || 
        fileName.includes('genvm') || 
        fileName.includes('genlayer')) {
        return true;
    }
    
    // Check if file imports genlayer
    if (document.lineCount > 0) {
        const text = document.getText();
        if (text.includes('from genlayer import') || text.includes('import genlayer')) {
            return true;
        }
    }
    
    return false;
}