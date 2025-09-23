import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { executeInteractiveCommand } from '../helpers/interactive-process';
import { getPythonPath, getWorkspaceRoot } from '../helpers/helpers';

const execAsync = promisify(exec);

/**
 * Deploy a GenLayer intelligent contract
 */
export async function deployContract(document: vscode.TextDocument, outputChannel: vscode.OutputChannel): Promise<void> {
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

        const pythonPath = getPythonPath();
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
                    cwd: getWorkspaceRoot(),
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
            } else if (result.success) {
                vscode.window.showInformationMessage('Contract deployed successfully! Check output for details.');
            } else {
                outputChannel.appendLine('\n❌ Deployment failed');
                vscode.window.showErrorMessage('Deployment failed. Check output for details.');
            }

            progress.report({ increment: 100, message: "Complete!" });
        });

        outputChannel.appendLine('\n=== Deployment Process Complete ===');

    } catch (error: any) {
        outputChannel.appendLine(`\n❌ Error: ${error.message}`);
        vscode.window.showErrorMessage(`Deployment error: ${error.message}`);
    }
}