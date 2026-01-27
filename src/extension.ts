import * as vscode from 'vscode';
import { GenVMLinter } from './genvm-linter';
import { GenVMDiagnosticsProvider } from './diagnostics-provider';
import { GenVMCompletionProvider } from './autocomplete-provider';
import { GenVMSignatureHelpProvider, GL_SIGNATURE_HELP_TRIGGER_CHARACTERS } from './signature-provider';
import { GenVMCodeActionProvider } from './code-actions-provider';
import { GenVMInlayHintsProvider } from './inlay-hints-provider';
import { GenVMDefinitionProvider } from './definition-provider';
import { GenVMHoverProvider } from './hover-provider';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
let diagnosticsProvider: GenVMDiagnosticsProvider;

export async function activate(context: vscode.ExtensionContext) {
    console.log('GenLayer VS Code Extension is now active');

    // Create output channel for GenVM
    const outputChannel = vscode.window.createOutputChannel('GenLayer');

    // Check and install dependencies if needed
    const autoInstall = vscode.workspace.getConfiguration('genlayer').get<boolean>('autoInstallDependencies', true);
    if (autoInstall) {
        await checkAndInstallDependencies(outputChannel);
    }

    // Generate type stubs for Pylance intellisense
    const autoGenerateStubs = vscode.workspace.getConfiguration('genlayer').get<boolean>('autoGenerateStubs', true);
    if (autoGenerateStubs) {
        generateAndConfigureStubs(outputChannel);
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
    const lintCurrentFileCommand = vscode.commands.registerCommand('genlayer.lintCurrentFile', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && (editor.document.languageId === 'python' )) {
            diagnosticsProvider.lintDocument(editor.document);
        } else {
            vscode.window.showWarningMessage('GenLayer: Please open a Python file');
        }
    });

    const lintWorkspaceCommand = vscode.commands.registerCommand('genlayer.lintWorkspace', () => {
        diagnosticsProvider.lintWorkspace();
    });

    const showOutputCommand = vscode.commands.registerCommand('genlayer.showOutputChannel', () => {
        outputChannel.show();
    });

    // Debug commands
    const debugCommand = vscode.commands.registerCommand('genlayer.debug', () => {
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

    const testLintCommand = vscode.commands.registerCommand('genlayer.testLint', async () => {
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
    
    const installDependenciesCommand = vscode.commands.registerCommand('genlayer.installDependencies', async () => {
        await installPackages(outputChannel);
    });

    const generateStubsCommand = vscode.commands.registerCommand('genlayer.generateStubs', async () => {
        await generateAndConfigureStubs(outputChannel, true);
    });
    
    const createContractCommand = vscode.commands.registerCommand('genlayer.createContract', async (uri?: vscode.Uri) => {
        await createNewContract(uri, outputChannel);
    });

    const deployContractCommand = vscode.commands.registerCommand('genlayer.deployContract', async () => {
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
                vscode.window.showWarningMessage('GenLayer: Please open a Python file');
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
        if (document.languageId === 'python' ) {
            diagnosticsProvider.lintDocument(document);
        }
    });

    const onDidOpenDocument = vscode.workspace.onDidOpenTextDocument((document) => {
        if ((document.languageId === 'python' ) && isGenVMFile(document)) {
            diagnosticsProvider.lintDocument(document);
        }
    });

    const onDidChangeActiveEditor = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && (editor.document.languageId === 'python' ) && isGenVMFile(editor.document)) {
            diagnosticsProvider.lintDocument(editor.document);
        }
    });

    // Lint when document content changes (real-time)
    const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument((event) => {
        const document = event.document;
        if (document.languageId === 'python' ) {
            diagnosticsProvider.lintDocument(document);
        }
    });

    // Register configuration change listener
    const onDidChangeConfiguration = vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('genlayer')) {
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
        generateStubsCommand,
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
        if ((document.languageId === 'python' ) && isGenVMFile(document)) {
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
    try {
        // Check if genvm-linter is available (try running it)
        let genvmInstalled = false;

        try {
            await execAsync('genvm-lint --version');
            genvmInstalled = true;
        } catch (error) {
            // CLI not found, try as Python module
            try {
                await execAsync('python3 -m genvm_linter.cli --version');
                genvmInstalled = true;
            } catch (e) {
                // Not installed
            }
        }

        if (genvmInstalled) {
            outputChannel.appendLine('genvm-linter is installed');
            return;
        }

        const response = await vscode.window.showInformationMessage(
            'GenLayer extension requires genvm-linter. Install now?',
            'Install',
            'Later',
            'Don\'t Ask Again'
        );

        if (response === 'Install') {
            await installPackages(outputChannel, ['genvm-linter']);
        } else if (response === 'Don\'t Ask Again') {
            await vscode.workspace.getConfiguration('genlayer').update('autoInstallDependencies', false, true);
        }
    } catch (error) {
        outputChannel.appendLine(`Error checking dependencies: ${error}`);
    }
}

async function handlePasswordPrompt(
    child: ChildProcess,
    promptText: string,
    outputChannel: vscode.OutputChannel
): Promise<boolean> {
    // Check if process is still alive
    if (child.killed || child.exitCode !== null) {
        return false;
    }

    // Display the actual prompt text for debugging
    outputChannel.appendLine(`[Password prompt detected: ${promptText.trim()}]`);

    const isNewKeystore = promptText.toLowerCase().includes('new') ||
                         promptText.toLowerCase().includes('create') ||
                         promptText.toLowerCase().includes('encrypt');

    const isConfirmation = promptText.toLowerCase().includes('confirm') ||
                           promptText.toLowerCase().includes('again') ||
                           promptText.toLowerCase().includes('re-enter');

    let prompt = 'Enter password';
    if (isNewKeystore && !isConfirmation) {
        prompt = 'Create a password for your new keystore';
    } else if (isConfirmation) {
        prompt = 'Confirm your password';
    } else {
        prompt = 'Enter password to decrypt keystore';
    }

    const password = await vscode.window.showInputBox({
        prompt: prompt,
        password: true,
        ignoreFocusOut: true,
        validateInput: (value) => {
            if (!value) {
                return 'Password is required';
            }
            if (isNewKeystore && !isConfirmation && value.length < 8) {
                return 'Password must be at least 8 characters';
            }
            return null;
        }
    });

    if (password && child.stdin && !child.killed) {
        try {
            child.stdin.write(password + '\n');
            outputChannel.appendLine('[Password sent to process]');
            return true;
        } catch (error) {
            outputChannel.appendLine(`[Error sending password: ${error}]`);
            return false;
        }
    } else {
        outputChannel.appendLine('[Password input cancelled by user]');
        try {
            child.kill();
        } catch (error) {
            // Process might already be dead
        }
        return false;
    }
}

async function handleKeypairPrompt(
    child: ChildProcess,
    promptText: string,
    outputChannel: vscode.OutputChannel
): Promise<boolean> {
    // Check if process is still alive
    if (child.killed || child.exitCode !== null) {
        return false;
    }

    // Display the actual prompt text for debugging
    outputChannel.appendLine(`[Keypair prompt detected: ${promptText.trim()}]`);

    // Show Yes/No dialog
    const answer = await vscode.window.showInformationMessage(
        'Keypair file not found. Would you like to create a new keypair?',
        { modal: true },
        'Yes', 'No'
    );

    if (child.stdin && !child.killed) {
        try {
            if (answer === 'Yes') {
                child.stdin.write('Y\n');
                outputChannel.appendLine('[Sent "Y" to create new keypair]');
            } else if (answer === 'No') {
                child.stdin.write('n\n');
                outputChannel.appendLine('[Sent "n" to skip keypair creation]');
            } else {
                // User cancelled
                outputChannel.appendLine('[Keypair creation cancelled by user]');
                child.kill();
                return false;
            }
            return true;
        } catch (error) {
            outputChannel.appendLine(`[Error sending response: ${error}]`);
            return false;
        }
    }
    return false;
}

async function executeInteractiveCommand(
    command: string,
    args: string[],
    outputChannel: vscode.OutputChannel,
    options?: {
        cwd?: string;
        timeout?: number;
        onProgress?: (message: string) => void;
    }
): Promise<{ success: boolean; output: string; contractAddress?: string }> {
    return new Promise((resolve, reject) => {
        // Don't use shell mode to avoid shell interpretation issues
        const cmdArgs = args.filter(arg => arg); // Remove empty args
        outputChannel.appendLine(`\nExecuting: ${command} ${cmdArgs.join(' ')}`);

        const child = spawn(command, cmdArgs, {
            cwd: options?.cwd,
            shell: false  // Changed to false to avoid shell issues
        });

        let output = '';
        let pendingPrompt = '';
        let timeoutHandle: NodeJS.Timeout | undefined;
        let passwordPromptTimeout: NodeJS.Timeout | undefined; // Track password prompt timeout
        let isProcessing = false;  // Prevent multiple simultaneous password prompts
        let processKilled = false; // Track if process was killed
        let deploymentSuccessful = false; // Track if deployment succeeded
        let passwordHandled = false; // Track if we already handled a password prompt
        let keypairHandled = false; // Track if we already handled a keypair prompt

        // Set timeout
        if (options?.timeout) {
            timeoutHandle = setTimeout(() => {
                if (!processKilled) {
                    outputChannel.appendLine(`\nCommand timed out after ${options.timeout}ms`);
                    processKilled = true;
                    child.kill();
                    resolve({ success: false, output: 'Command timed out' });
                }
            }, options.timeout);
        }

        // Handle stdout
        child.stdout?.on('data', async (data) => {
            const text = data.toString();
            output += text;

            // Check if deployment is successful (contract address appeared)
            if (!deploymentSuccessful && text.match(/0x[a-fA-F0-9]{40}/)) {
                deploymentSuccessful = true;
                // Clear any pending password prompt timeout since deployment succeeded
                if (passwordPromptTimeout) {
                    clearTimeout(passwordPromptTimeout);
                    passwordPromptTimeout = undefined;
                }
            }

            // Check for password errors to allow retry (but not success confirmations)
            const lowerText = text.toLowerCase();
            if ((lowerText.includes('incorrect password') ||
                lowerText.includes('wrong password') ||
                lowerText.includes('authentication failed') ||
                lowerText.includes('could not decrypt') ||
                lowerText.includes('invalid password')) &&
                !text.trim().startsWith('✔')) { // Ignore success checkmarks
                passwordHandled = false; // Reset to allow another password prompt
                pendingPrompt = ''; // Clear any pending prompt
            }

            // Also reset password handling after successful password entry to allow confirmation prompt
            if (text.includes('✔') && lowerText.includes('password') &&
                !lowerText.includes('confirm')) { // Success on initial password, allow confirmation
                passwordHandled = false;
                pendingPrompt = ''; // Clear any pending prompt

                // Check if confirmation prompt is in the same chunk of text
                const confirmIndex = text.toLowerCase().indexOf('confirm password');
                if (confirmIndex > 0) {
                    // Extract and handle the confirmation prompt immediately
                    const confirmPrompt = text.substring(text.lastIndexOf('?', confirmIndex) >= 0 ? text.lastIndexOf('?', confirmIndex) : confirmIndex);
                    setTimeout(async () => {
                        if (!processKilled && !isProcessing) {
                            isProcessing = true;
                            passwordHandled = true;
                            await handlePasswordPrompt(child, confirmPrompt, outputChannel);
                            isProcessing = false;
                        }
                    }, 50);
                }
            }

            // Check for keypair creation prompt
            const isKeypairPrompt = text.toLowerCase().includes('keypair') &&
                                   text.toLowerCase().includes('not found') &&
                                   (text.includes('(Y/n)') || text.includes('(y/n)'));

            // Check for password prompts but avoid duplicate handling and stop after success
            // Ignore lines that start with ✔ (success) or are just echo/display of entered password
            const isPasswordPrompt = (text.toLowerCase().includes('password') || text.toLowerCase().includes('keystore')) &&
                                    !text.trim().startsWith('✔') && // Not a success message
                                    !text.includes('****') && // Not showing masked password
                                    (text.includes('?') || text.includes('Enter') || text.includes('Invalid') || text.includes('Attempt') || text.includes('Confirm'));

            if (!processKilled && !isProcessing && !keypairHandled && isKeypairPrompt) {
                // Handle keypair prompt immediately
                isProcessing = true;
                keypairHandled = true; // Mark as handled to prevent duplicate prompts
                await handleKeypairPrompt(child, text, outputChannel);
                isProcessing = false;
            } else if (!processKilled && !isProcessing && !deploymentSuccessful && !passwordHandled && isPasswordPrompt) {
                pendingPrompt += text;

                // Clear any existing timeout before setting a new one
                if (passwordPromptTimeout) {
                    clearTimeout(passwordPromptTimeout);
                }

                // Wait a bit to collect the full prompt
                passwordPromptTimeout = setTimeout(async () => {
                    if (!processKilled && !isProcessing && !deploymentSuccessful && !passwordHandled && pendingPrompt &&
                        (pendingPrompt.includes(':') || pendingPrompt.includes('?'))) {
                        isProcessing = true;
                        passwordHandled = true; // Mark as handled to prevent duplicate prompts

                        // Update progress when password is needed
                        if (options?.onProgress) {
                            options.onProgress('Authenticating with keystore...');
                        }

                        await handlePasswordPrompt(child, pendingPrompt, outputChannel);
                        pendingPrompt = '';
                        isProcessing = false;
                    }
                    passwordPromptTimeout = undefined;
                }, 100);
            } else {
                outputChannel.append(text);
            }

            // Update progress if needed
            if (options?.onProgress && !processKilled) {
                const lowerText = text.toLowerCase();
                if (lowerText.includes('compil')) {
                    options.onProgress('Compiling contract...');
                } else if (lowerText.includes('deploy') || lowerText.includes('send') || lowerText.includes('submit')) {
                    options.onProgress('Deploying contract to network...');
                } else if (lowerText.includes('transaction') || lowerText.includes('tx')) {
                    options.onProgress('Transaction submitted...');
                } else if (lowerText.includes('confirm') || lowerText.includes('wait') || lowerText.includes('pending')) {
                    options.onProgress('Waiting for confirmation...');
                } else if (lowerText.includes('success') || lowerText.includes('deployed')) {
                    options.onProgress('Deployment successful!');
                } else if (lowerText.includes('contract address') || text.match(/0x[a-fA-F0-9]{40}/)) {
                    options.onProgress('Contract deployed successfully!');
                }
            }
        });

        // Handle stderr (many CLIs send prompts to stderr)
        child.stderr?.on('data', async (data) => {
            const text = data.toString();
            output += text;

            // Check if deployment is successful (contract address might appear in stderr too)
            if (!deploymentSuccessful && text.match(/0x[a-fA-F0-9]{40}/)) {
                deploymentSuccessful = true;
                // Clear any pending password prompt timeout since deployment succeeded
                if (passwordPromptTimeout) {
                    clearTimeout(passwordPromptTimeout);
                    passwordPromptTimeout = undefined;
                }
            }

            // Check for password errors to allow retry (but not success confirmations)
            const lowerText = text.toLowerCase();
            if ((lowerText.includes('incorrect password') ||
                lowerText.includes('wrong password') ||
                lowerText.includes('authentication failed') ||
                lowerText.includes('could not decrypt') ||
                lowerText.includes('invalid password')) &&
                !text.trim().startsWith('✔')) { // Ignore success checkmarks
                passwordHandled = false; // Reset to allow another password prompt
                pendingPrompt = ''; // Clear any pending prompt
            }

            // Also reset password handling after successful password entry to allow confirmation prompt
            if (text.includes('✔') && lowerText.includes('password') &&
                !lowerText.includes('confirm')) { // Success on initial password, allow confirmation
                passwordHandled = false;
                pendingPrompt = ''; // Clear any pending prompt

                // Check if confirmation prompt is in the same chunk of text
                const confirmIndex = text.toLowerCase().indexOf('confirm password');
                if (confirmIndex > 0) {
                    // Extract and handle the confirmation prompt immediately
                    const confirmPrompt = text.substring(text.lastIndexOf('?', confirmIndex) >= 0 ? text.lastIndexOf('?', confirmIndex) : confirmIndex);
                    setTimeout(async () => {
                        if (!processKilled && !isProcessing) {
                            isProcessing = true;
                            passwordHandled = true;
                            await handlePasswordPrompt(child, confirmPrompt, outputChannel);
                            isProcessing = false;
                        }
                    }, 50);
                }
            }

            // Check for keypair creation prompt
            const isKeypairPrompt = text.toLowerCase().includes('keypair') &&
                                   text.toLowerCase().includes('not found') &&
                                   (text.includes('(Y/n)') || text.includes('(y/n)'));

            // Check for password prompts in stderr but stop after success
            // Ignore lines that start with ✔ (success) or are just echo/display of entered password
            const isPasswordPrompt = (text.toLowerCase().includes('password') || text.toLowerCase().includes('keystore')) &&
                                    !text.trim().startsWith('✔') && // Not a success message
                                    !text.includes('****') && // Not showing masked password
                                    (text.includes('?') || text.includes('Enter') || text.includes('Invalid') || text.includes('Attempt') || text.includes('Confirm'));

            if (!processKilled && !isProcessing && !keypairHandled && isKeypairPrompt) {
                // Handle keypair prompt immediately
                isProcessing = true;
                keypairHandled = true; // Mark as handled to prevent duplicate prompts
                await handleKeypairPrompt(child, text, outputChannel);
                isProcessing = false;
            } else if (!processKilled && !isProcessing && !deploymentSuccessful && !passwordHandled && isPasswordPrompt) {
                pendingPrompt += text;

                // Clear any existing timeout before setting a new one
                if (passwordPromptTimeout) {
                    clearTimeout(passwordPromptTimeout);
                }

                passwordPromptTimeout = setTimeout(async () => {
                    if (!processKilled && !isProcessing && !deploymentSuccessful && !passwordHandled && pendingPrompt &&
                        (pendingPrompt.includes(':') || pendingPrompt.includes('?'))) {
                        isProcessing = true;
                        passwordHandled = true; // Mark as handled to prevent duplicate prompts

                        // Update progress when password is needed
                        if (options?.onProgress) {
                            options.onProgress('Authenticating with keystore...');
                        }

                        await handlePasswordPrompt(child, pendingPrompt, outputChannel);
                        pendingPrompt = '';
                        isProcessing = false;
                    }
                    passwordPromptTimeout = undefined;
                }, 100);
            } else {
                outputChannel.append(text);
            }
        });

        // Handle process exit
        child.on('close', (code) => {
            if (!processKilled) {
                processKilled = true;

                if (timeoutHandle) {
                    clearTimeout(timeoutHandle);
                }

                // Clear any pending password prompt timeout
                if (passwordPromptTimeout) {
                    clearTimeout(passwordPromptTimeout);
                    passwordPromptTimeout = undefined;
                }

                outputChannel.appendLine(`\nProcess exited with code ${code}`);

                // Extract contract address if present
                const addressMatch = output.match(/0x[a-fA-F0-9]{40}/);
                const contractAddress = addressMatch ? addressMatch[0] : undefined;

                // Deployment is only successful if we have a contract address
                const success = !!contractAddress;

                resolve({
                    success,
                    output,
                    contractAddress
                });
            }
        });

        // Handle errors
        child.on('error', (err) => {
            if (!processKilled) {
                processKilled = true;
                if (timeoutHandle) {
                    clearTimeout(timeoutHandle);
                }
                // Clear any pending password prompt timeout
                if (passwordPromptTimeout) {
                    clearTimeout(passwordPromptTimeout);
                    passwordPromptTimeout = undefined;
                }
                outputChannel.appendLine(`\nProcess error: ${err.message}`);
                resolve({ success: false, output: err.message });
            }
        });
    });
}

async function deployContract(document: vscode.TextDocument, outputChannel: vscode.OutputChannel): Promise<void> {
    try {
        outputChannel.appendLine('=== Starting Contract Deployment ===');
        outputChannel.appendLine(`File: ${document.fileName}`);

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
            title: 'Deploy Intelligent Contract',
            ignoreFocusOut: true  // Don't close when focus is lost
        });

        if (!selected) {
            outputChannel.appendLine('Deployment cancelled - no network selected');
            return;
        }

        const contractPath = document.fileName;
        outputChannel.appendLine(`Contract: ${contractPath}`);
        outputChannel.appendLine(`Network: ${selected.label}`);

        const pythonPath = vscode.workspace.getConfiguration('genlayer').get<string>('python.interpreterPath', 'python3');
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
            outputChannel.appendLine(`\nSetting network to ${selected.label}...`);
            try {
                const { stdout: networkOut, stderr: networkErr } = await execAsync(`genlayer network ${selected.value}`);

                // Display network command output (both stdout and stderr may contain success messages)
                const networkOutput = networkOut || networkErr || '';
                if (networkOutput) {
                    outputChannel.appendLine(networkOutput.trim());
                }

                // Check if it was actually an error
                if (networkOutput.toLowerCase().includes('error') || networkOutput.toLowerCase().includes('failed')) {
                    vscode.window.showErrorMessage(`Failed to set network: ${networkOutput}`);
                    return;
                }
            } catch (error: any) {
                outputChannel.appendLine(`Error setting network: ${error.message}`);
                vscode.window.showErrorMessage(`Failed to set network: ${error.message}`);
                return;
            }

            deployCommand = `genlayer deploy --contract "${contractPath}"`;
        }

        // Execute deployment with interactive support
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Deploying Intelligent Contract",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: "Initiating deployment..." });

            // Parse the deploy command to extract arguments
            let deployArgs: string[];
            if (selected.value === 'custom' && deployCommand.includes('--rpc')) {
                // For custom RPC: genlayer deploy --contract "path" --rpc url
                const rpcUrl = deployCommand.match(/--rpc\s+(\S+)/)?.[1] || '';
                deployArgs = ['deploy', '--contract', contractPath, '--rpc', rpcUrl];
            } else {
                // For standard networks: genlayer deploy --contract "path"
                deployArgs = ['deploy', '--contract', contractPath];
            }

            progress.report({ increment: 30, message: "Preparing deployment..." });

            // Execute deployment with interactive support
            const result = await executeInteractiveCommand(
                'genlayer',
                deployArgs,
                outputChannel,
                {
                    cwd: vscode.workspace.workspaceFolders?.[0].uri.fsPath,
                    timeout: 120000, // 2 minute timeout for deployment
                    onProgress: (message) => {
                        progress.report({ message });
                    }
                }
            );

            progress.report({ increment: 70, message: "Processing response..." });

            if (result.success && result.contractAddress) {
                outputChannel.appendLine(`\n✅ Contract Address: ${result.contractAddress}`);

                // Show success message with copy option
                const selection = await vscode.window.showInformationMessage(
                    `Contract deployed successfully!\nAddress: ${result.contractAddress}`,
                    'Copy Address',
                    'View Output'
                );

                if (selection === 'Copy Address') {
                    await vscode.env.clipboard.writeText(result.contractAddress);
                    vscode.window.showInformationMessage('Contract address copied to clipboard!');
                } else if (selection === 'View Output') {
                    outputChannel.show();
                }
            // Note: removed else if (result.success) case since success now requires contractAddress
            } else {
                outputChannel.appendLine('\n❌ Deployment failed');
                vscode.window.showErrorMessage('Deployment failed. Check output for details.');
            }

            progress.report({ increment: 100, message: "Complete!" });
        });

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
    const packagesToInstall = packages || ['genvm-linter'];

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

                // Try pipx first (recommended for CLI tools on modern macOS/Linux)
                try {
                    outputChannel.appendLine(`Trying pipx install ${pkg}...`);
                    const { stdout, stderr } = await execAsync(`pipx install ${pkg}`);
                    outputChannel.appendLine(stdout);
                    if (stderr) outputChannel.appendLine(stderr);
                    continue; // Success, move to next package
                } catch (pipxError: any) {
                    outputChannel.appendLine(`pipx not available or failed: ${pipxError.message}`);
                }

                // Fall back to pip with --user flag
                try {
                    outputChannel.appendLine(`Trying pip install --user ${pkg}...`);
                    const { stdout, stderr } = await execAsync(`python3 -m pip install --user ${pkg}`);
                    outputChannel.appendLine(stdout);
                    if (stderr) outputChannel.appendLine(stderr);
                    continue; // Success
                } catch (pipUserError: any) {
                    outputChannel.appendLine(`pip --user failed: ${pipUserError.message}`);
                }

                // Final fallback: suggest manual installation
                const errorMsg = `Could not install ${pkg} automatically. Please install manually:\n  pipx install ${pkg}\n  or: pip install --user ${pkg}`;
                outputChannel.appendLine(errorMsg);
                vscode.window.showErrorMessage(`Failed to install ${pkg}. See GenLayer output for instructions.`, 'Copy Command').then(response => {
                    if (response === 'Copy Command') {
                        vscode.env.clipboard.writeText(`pipx install ${pkg}`);
                    }
                });
                throw new Error(errorMsg);
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

async function generateAndConfigureStubs(outputChannel: vscode.OutputChannel, showProgress = false): Promise<void> {
    const pythonPath = vscode.workspace.getConfiguration('genlayer').get<string>('python.interpreterPath', 'python3');

    const doGenerate = async () => {
        try {
            outputChannel.appendLine('Generating GenLayer type stubs for intellisense...');

            // Run genvm-lint stubs command
            const { stdout, stderr } = await execAsync(`${pythonPath} -m genvm_linter.cli stubs`);

            // Parse output to get stubs path
            const output = stdout + stderr;
            outputChannel.appendLine(output);

            // Extract stubs path from output (looks for "Stubs generated at /path" or similar)
            const pathMatch = output.match(/(?:Stubs generated at|✓ Stubs generated at)\s+(.+)/);
            let stubsPath: string | undefined;

            if (pathMatch) {
                stubsPath = pathMatch[1].trim();
            } else {
                // Fallback: check default cache location
                const homeDir = process.env.HOME || process.env.USERPROFILE || '';
                const defaultPath = `${homeDir}/.cache/genvm-linter/stubs`;
                try {
                    const { stdout: listOutput } = await execAsync(`${pythonPath} -m genvm_linter.cli stubs --list`);
                    // Get first cached version
                    const versionMatch = listOutput.match(/(\S+)\s*->\s*(.+)/);
                    if (versionMatch) {
                        stubsPath = versionMatch[2].trim();
                    }
                } catch {
                    // Ignore
                }
            }

            if (stubsPath) {
                outputChannel.appendLine(`Stubs path: ${stubsPath}`);
                await configurePylanceStubPath(stubsPath, outputChannel);
            } else {
                outputChannel.appendLine('Could not determine stubs path');
            }
        } catch (error: any) {
            outputChannel.appendLine(`Error generating stubs: ${error.message}`);
            if (error.message.includes('No module named')) {
                outputChannel.appendLine('genvm-linter package may not be installed. Run "GenLayer: Install Dependencies"');
            }
        }
    };

    if (showProgress) {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Generating GenLayer type stubs',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Downloading SDK and generating stubs...' });
            await doGenerate();
            progress.report({ message: 'Complete!' });
        });
    } else {
        // Run in background without blocking
        doGenerate();
    }
}

async function configurePylanceStubPath(stubsPath: string, outputChannel: vscode.OutputChannel): Promise<void> {
    try {
        const config = vscode.workspace.getConfiguration('python.analysis');
        const currentStubPath = config.get<string>('stubPath');

        // Only update if different
        if (currentStubPath !== stubsPath) {
            // Update at user level so it persists across workspaces
            await config.update('stubPath', stubsPath, vscode.ConfigurationTarget.Global);
            outputChannel.appendLine(`Configured Pylance stubPath: ${stubsPath}`);
        } else {
            outputChannel.appendLine('Pylance stubPath already configured');
        }

        // Suppress "missing module source" warnings for stub-only packages
        const currentReportMissing = config.get<string>('reportMissingModuleSource');
        if (currentReportMissing !== 'none') {
            await config.update('reportMissingModuleSource', 'none', vscode.ConfigurationTarget.Global);
            outputChannel.appendLine('Suppressed reportMissingModuleSource for stub-only packages');
        }

        outputChannel.appendLine('GenLayer intellisense is now available for Python files');
    } catch (error: any) {
        outputChannel.appendLine(`Error configuring Pylance: ${error.message}`);
    }
}