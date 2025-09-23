import * as vscode from 'vscode';
import { GenVMLinter } from './genvm-linter';
import { GenVMDiagnosticsProvider } from './diagnostics-provider';
import { GenVMCompletionProvider } from './autocomplete-provider';
import { GenVMSignatureHelpProvider, GL_SIGNATURE_HELP_TRIGGER_CHARACTERS } from './signature-provider';
import { GenVMCodeActionProvider } from './code-actions-provider';
import { GenVMInlayHintsProvider } from './inlay-hints-provider';
import { GenVMDefinitionProvider } from './definition-provider';
import { GenVMHoverProvider } from './hover-provider';
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
    
    // Register Code Actions Provider (Quick Fixes)
    const codeActionProvider = vscode.languages.registerCodeActionsProvider(
        [{ language: 'python' }, { language: 'genvm-python' }],
        new GenVMCodeActionProvider(),
        {
            providedCodeActionKinds: GenVMCodeActionProvider.providedCodeActionKinds
        }
    );
    
    // Register Inlay Hints Provider
    const inlayHintsProvider = vscode.languages.registerInlayHintsProvider(
        [{ language: 'python' }, { language: 'genvm-python' }],
        new GenVMInlayHintsProvider()
    );
    
    // Register Definition Provider (Go to Definition)
    const definitionProvider = vscode.languages.registerDefinitionProvider(
        [{ language: 'python' }, { language: 'genvm-python' }],
        new GenVMDefinitionProvider()
    );
    
    // Register Hover Provider
    const hoverProvider = vscode.languages.registerHoverProvider(
        [{ language: 'python' }, { language: 'genvm-python' }],
        new GenVMHoverProvider()
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
    
    const createContractCommand = vscode.commands.registerCommand('genvm.createContract', async (uri?: vscode.Uri) => {
        await createNewContract(uri, outputChannel);
    });

    const deployContractCommand = vscode.commands.registerCommand('genvm.deployContract', async () => {
        try {
            outputChannel.appendLine('Deploy command triggered');
            const editor = vscode.window.activeTextEditor;

            if (!editor) {
                outputChannel.appendLine('No active editor');
                vscode.window.showWarningMessage('GenVM Linter: Please open a file first');
                return;
            }

            outputChannel.appendLine(`Active file: ${editor.document.fileName}`);
            outputChannel.appendLine(`Language ID: ${editor.document.languageId}`);

            if (editor.document.languageId !== 'python' && editor.document.languageId !== 'genvm-python') {
                vscode.window.showWarningMessage('GenVM Linter: Please open a Python file');
                return;
            }

            if (!isGenVMFile(editor.document)) {
                outputChannel.appendLine('File is not a GenVM contract');
                vscode.window.showWarningMessage('GenVM Linter: Current file is not a GenVM contract');
                return;
            }

            outputChannel.appendLine('Calling deployContract function...');
            await deployContract(editor.document, outputChannel);
        } catch (error: any) {
            outputChannel.appendLine(`Error in deploy command: ${error.message}`);
            vscode.window.showErrorMessage(`Deploy error: ${error.message}`);
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
        installDependenciesCommand,
        createContractCommand,
        deployContractCommand,
        onDidSaveDocument,
        onDidOpenDocument,
        onDidChangeActiveEditor,
        onDidChangeTextDocument,
        onDidChangeConfiguration,
        completionProvider,
        signatureProvider,
        codeActionProvider,
        inlayHintsProvider,
        definitionProvider,
        hoverProvider,
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

async function deployContract(document: vscode.TextDocument, outputChannel: vscode.OutputChannel): Promise<void> {
    try {
        outputChannel.appendLine('=== Starting Contract Deployment ===');
        outputChannel.appendLine(`File: ${document.fileName}`);
        outputChannel.show();

        // Network selection options
        const networks = [
            { label: '🌐 StudioNet', value: 'studionet', description: 'GenLayer Studio Network' },
            { label: '🏠 LocalNet', value: 'localnet', description: 'Local Development Network' },
            { label: '🧪 TestNet', value: 'testnet', description: 'Test Network' },
            { label: '⚙️ Custom RPC...', value: 'custom', description: 'Custom RPC Endpoint' }
        ];

        outputChannel.appendLine('Showing network selection dialog...');

        const selected = await vscode.window.showQuickPick(networks, {
            placeHolder: 'Select deployment network',
            title: 'Deploy GenVM Contract',
            ignoreFocusOut: true  // Don't close when focus is lost
        });

        if (!selected) {
            outputChannel.appendLine('Deployment cancelled - no network selected');
            return;
        }

        const contractPath = document.fileName;
        outputChannel.appendLine(`Contract: ${contractPath}`);
        outputChannel.appendLine(`Network: ${selected.label}`);

        const pythonPath = vscode.workspace.getConfiguration('genvm').get<string>('python.interpreterPath', 'python3');
        let deployCommand: string;

        if (selected.value === 'custom') {
            // Prompt for custom RPC URL
            const rpcUrl = await vscode.window.showInputBox({
                prompt: 'Enter custom RPC URL',
                placeHolder: 'http://localhost:8545',
                ignoreFocusOut: true,  // Don't close when focus is lost
                validateInput: (value) => {
                    if (!value) {
                        return 'RPC URL is required';
                    }
                    try {
                        new URL(value);
                        return null;
                    } catch {
                        return 'Invalid URL format';
                    }
                }
            });

            if (!rpcUrl) {
                outputChannel.appendLine('Deployment cancelled - no RPC URL provided');
                return;
            }

            outputChannel.appendLine(`Custom RPC: ${rpcUrl}`);
            deployCommand = `genlayer deploy --contract "${contractPath}" --rpc ${rpcUrl}`;
        } else {
            // For standard networks, set network first then deploy
            outputChannel.appendLine(`Setting network to ${selected.value}...`);
            try {
                const { stdout: networkOut, stderr: networkErr } = await execAsync(`genlayer network ${selected.value}`);
                if (networkOut) outputChannel.appendLine(networkOut);
                if (networkErr) outputChannel.appendLine(`Network stderr: ${networkErr}`);
            } catch (error: any) {
                outputChannel.appendLine(`Error setting network: ${error.message}`);
                vscode.window.showErrorMessage(`Failed to set network: ${error.message}`);
                return;
            }

            deployCommand = `genlayer deploy --contract "${contractPath}"`;
        }

        // Execute deployment
        outputChannel.appendLine(`\nExecuting: ${deployCommand}`);
        vscode.window.showInformationMessage('Deploying contract... Check output for details.');

        try {
            const { stdout, stderr } = await execAsync(deployCommand, {
                cwd: vscode.workspace.workspaceFolders?.[0].uri.fsPath
            });

            if (stdout) {
                outputChannel.appendLine('\n=== Deployment Output ===');
                outputChannel.appendLine(stdout);

                // Check for success indicators
                if (stdout.includes('deployed') || stdout.includes('success') || stdout.includes('0x')) {
                    vscode.window.showInformationMessage('Contract deployed successfully! Check output for details.');
                }
            }

            if (stderr && !stderr.includes('warning')) {
                outputChannel.appendLine('\n=== Deployment Errors ===');
                outputChannel.appendLine(stderr);
            }
        } catch (error: any) {
            outputChannel.appendLine(`\n=== Deployment Failed ===`);
            outputChannel.appendLine(error.message);
            if (error.stdout) outputChannel.appendLine(error.stdout);
            if (error.stderr) outputChannel.appendLine(error.stderr);

            vscode.window.showErrorMessage(`Deployment failed: ${error.message}`);
        }

        outputChannel.appendLine('\n=== Deployment Process Complete ===');

    } catch (error: any) {
        outputChannel.appendLine(`Unexpected error: ${error.message}`);
        vscode.window.showErrorMessage(`Deployment error: ${error.message}`);
    }
}

async function createNewContract(uri: vscode.Uri | undefined, outputChannel: vscode.OutputChannel): Promise<void> {
    try {
        // Determine target directory
        let targetDir: vscode.Uri;
        if (uri && (await vscode.workspace.fs.stat(uri)).type === vscode.FileType.Directory) {
            targetDir = uri;
        } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            targetDir = vscode.workspace.workspaceFolders[0].uri;
        } else {
            vscode.window.showErrorMessage('No workspace folder open. Please open a folder first.');
            return;
        }
        
        // Prompt for contract name
        const contractName = await vscode.window.showInputBox({
            prompt: 'Enter the contract name',
            placeHolder: 'MyContract',
            validateInput: (value) => {
                if (!value) {
                    return 'Contract name is required';
                }
                if (!/^[A-Z][a-zA-Z0-9]*$/.test(value)) {
                    return 'Contract name must start with uppercase letter and contain only letters and numbers';
                }
                return null;
            }
        });
        
        if (!contractName) {
            return; // User cancelled
        }
        
        // Generate filename (snake_case)
        const fileName = contractName
            .replace(/([A-Z])/g, '_$1')
            .toLowerCase()
            .substring(1) + '.py';
        
        // Create contract content
        const contractContent = `# { "Depends": "py-genlayer:test" }

from genlayer import *

class ${contractName}(gl.Contract):
    """${contractName} intelligent contract."""
    
    def __init__(self):
        """Initialize the contract."""
        pass
    
    @gl.public.view
    def get_value(self) -> int:
        """Get a value from the contract."""
        return 0
    
    @gl.public.write
    def set_value(self, value: int):
        """Set a value in the contract."""
        pass
`;
        
        // Create file path
        const filePath = vscode.Uri.joinPath(targetDir, fileName);
        
        // Check if file already exists
        try {
            await vscode.workspace.fs.stat(filePath);
            const overwrite = await vscode.window.showWarningMessage(
                `File ${fileName} already exists. Overwrite?`,
                'Yes',
                'No'
            );
            if (overwrite !== 'Yes') {
                return;
            }
        } catch (error) {
            // File doesn't exist, which is what we want
        }
        
        // Write the file
        const encoder = new TextEncoder();
        await vscode.workspace.fs.writeFile(filePath, encoder.encode(contractContent));
        
        // Open the file in editor
        const document = await vscode.workspace.openTextDocument(filePath);
        const editor = await vscode.window.showTextDocument(document);
        
        // Place cursor at the end of __init__ method
        const initLine = document.getText().split('\n').findIndex(line => line.includes('def __init__'));
        if (initLine !== -1) {
            const position = new vscode.Position(initLine + 2, 8); // After 'pass' in __init__
            editor.selection = new vscode.Selection(position, position);
        }
        
        outputChannel.appendLine(`Created new GenVM contract: ${fileName}`);
        vscode.window.showInformationMessage(`Created new GenVM contract: ${fileName}`);
        
    } catch (error) {
        outputChannel.appendLine(`Error creating contract: ${error}`);
        vscode.window.showErrorMessage(`Failed to create contract: ${error}`);
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