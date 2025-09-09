import * as vscode from 'vscode';
import { GenVMLinter } from './genvm-linter';
import { GenVMDiagnosticsProvider } from './diagnostics-provider';
import { GenVMCompletionProvider } from './autocomplete-provider';
import { GenVMSignatureHelpProvider, GL_SIGNATURE_HELP_TRIGGER_CHARACTERS } from './signature-provider';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
let diagnosticsProvider: GenVMDiagnosticsProvider;

export async function activate(context: vscode.ExtensionContext) {
    console.log('GenVM Linter extension is now active');

    // Create output channel for GenVM
    const outputChannel = vscode.window.createOutputChannel('GenVM Linter');
    
    // Check and install dependencies if needed
    const autoInstall = vscode.workspace.getConfiguration('genvm').get<boolean>('autoInstallDependencies', true);
    if (autoInstall) {
        await checkAndInstallDependencies(outputChannel);
    }
    
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
    
    const installDependenciesCommand = vscode.commands.registerCommand('genvm.installDependencies', async () => {
        await installPackages(outputChannel);
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
        installDependenciesCommand,
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

async function checkAndInstallDependencies(outputChannel: vscode.OutputChannel): Promise<void> {
    const pythonPath = vscode.workspace.getConfiguration('genvm').get<string>('python.interpreterPath', 'python3');
    
    try {
        // Check if packages are installed
        let genvmInstalled = false;
        let mypyInstalled = false;
        
        try {
            await execAsync(`${pythonPath} -m pip show genvm-linter`);
            genvmInstalled = true;
        } catch (error) {
            // Package not installed
        }
        
        try {
            await execAsync(`${pythonPath} -m pip show mypy`);
            mypyInstalled = true;
        } catch (error) {
            // Package not installed
        }
        
        // If both are installed, we're done
        if (genvmInstalled && mypyInstalled) {
            outputChannel.appendLine('All required Python packages are installed');
            return;
        }
        
        // Build message about missing packages
        const missingPackages = [];
        if (!genvmInstalled) missingPackages.push('genvm-linter');
        if (!mypyInstalled) missingPackages.push('mypy');
        
        const message = `GenVM Linter requires Python packages: ${missingPackages.join(' and ')}. Would you like to install them?`;
        
        const response = await vscode.window.showInformationMessage(
            message,
            'Install',
            'Later',
            'Don\'t Ask Again'
        );
        
        if (response === 'Install') {
            await installPackages(outputChannel, missingPackages);
        } else if (response === 'Don\'t Ask Again') {
            await vscode.workspace.getConfiguration('genvm').update('autoInstallDependencies', false, true);
        }
    } catch (error) {
        outputChannel.appendLine(`Error checking dependencies: ${error}`);
    }
}

async function installPackages(outputChannel: vscode.OutputChannel, packages?: string[]): Promise<void> {
    const pythonPath = vscode.workspace.getConfiguration('genvm').get<string>('python.interpreterPath', 'python3');
    const packagesToInstall = packages || ['genvm-linter', 'mypy'];
    
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Installing GenVM Linter dependencies',
        cancellable: false
    }, async (progress) => {
        try {
            outputChannel.appendLine('=== Installing Python Dependencies ===');
            outputChannel.show();
            
            for (let i = 0; i < packagesToInstall.length; i++) {
                const pkg = packagesToInstall[i];
                const percentage = (i / packagesToInstall.length) * 100;
                
                progress.report({ 
                    increment: percentage, 
                    message: `Installing ${pkg}...` 
                });
                
                outputChannel.appendLine(`Installing ${pkg}...`);
                
                try {
                    const { stdout, stderr } = await execAsync(`${pythonPath} -m pip install ${pkg}`);
                    outputChannel.appendLine(stdout);
                    if (stderr) outputChannel.appendLine(stderr);
                } catch (error: any) {
                    outputChannel.appendLine(`Error installing ${pkg}: ${error.message}`);
                    
                    // Check if it's a permission error
                    if (error.message.includes('Permission denied') || error.message.includes('access denied')) {
                        const retryMessage = `Installation failed due to permissions. Try running:\n${pythonPath} -m pip install --user ${pkg}`;
                        vscode.window.showErrorMessage(retryMessage, 'Copy Command').then(response => {
                            if (response === 'Copy Command') {
                                vscode.env.clipboard.writeText(`${pythonPath} -m pip install --user ${pkg}`);
                            }
                        });
                    } else {
                        vscode.window.showErrorMessage(`Failed to install ${pkg}: ${error.message}`);
                    }
                    throw error;
                }
            }
            
            progress.report({ increment: 100, message: 'Installation complete!' });
            outputChannel.appendLine('All dependencies installed successfully!');
            vscode.window.showInformationMessage('GenVM Linter dependencies installed successfully! You may need to reload the window.');
            
            // Offer to reload window
            const reload = await vscode.window.showInformationMessage(
                'Dependencies installed. Reload window to apply changes?',
                'Reload',
                'Later'
            );
            
            if (reload === 'Reload') {
                vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
        } catch (error) {
            outputChannel.appendLine(`Installation failed: ${error}`);
        }
    });
}