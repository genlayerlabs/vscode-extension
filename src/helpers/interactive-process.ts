import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';

/**
 * Handle password prompts from the process
 */
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

/**
 * Handle keypair creation prompts from the process
 */
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

/**
 * Execute an interactive command with prompt handling
 */
export async function executeInteractiveCommand(
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

                const success = code === 0 ||
                               output.toLowerCase().includes('success') ||
                               output.toLowerCase().includes('deployed') ||
                               !!contractAddress;

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