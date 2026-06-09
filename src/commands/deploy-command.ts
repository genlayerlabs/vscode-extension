import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { executeInteractiveCommand } from '../helpers/interactive-process';
import { getWorkspaceRoot } from '../helpers/helpers';

const execFileAsync = promisify(execFile);

type FeeEstimate = {
    distribution?: Record<string, unknown>;
    messageAllocations?: unknown[];
    message_allocations?: unknown[];
    feeValue?: string | number | bigint;
    fee_value?: string | number | bigint;
};

let supportsFeeEstimationPromise: Promise<boolean> | undefined;
let shownFeeEstimationNotice = false;

function feePresetFromEstimate(estimate: FeeEstimate): string {
    if (!estimate.distribution) {
        throw new Error('genlayer estimate-fees --json did not return a fee distribution');
    }
    const feeValue = estimate.feeValue ?? estimate.fee_value;
    const messageAllocations = estimate.messageAllocations ?? estimate.message_allocations;
    const preset: Record<string, unknown> = {
        distribution: estimate.distribution,
    };
    if (messageAllocations) {
        preset.messageAllocations = messageAllocations;
    }
    if (feeValue !== undefined) {
        preset.feeValue = String(feeValue);
    }
    return JSON.stringify(preset);
}

function formatGenFromWei(weiValue: string | number | bigint): string {
    const wei = BigInt(String(weiValue));
    const weiPerGen = BigInt('1000000000000000000');
    const whole = wei / weiPerGen;
    const fraction = wei % weiPerGen;

    if (fraction === BigInt(0)) {
        return whole.toString();
    }

    const fractionText = fraction.toString().padStart(18, '0');
    const firstSixDecimals = fractionText.slice(0, 6);
    const trimmedDecimals = firstSixDecimals.replace(/0+$/, '');

    if (!trimmedDecimals) {
        return wei > BigInt(0) ? '<0.000001' : '0';
    }

    return `${whole.toString()}.${trimmedDecimals}`;
}

async function supportsFeeEstimation(outputChannel: vscode.OutputChannel): Promise<boolean> {
    if (!supportsFeeEstimationPromise) {
        supportsFeeEstimationPromise = execFileAsync('genlayer', ['estimate-fees', '--help'], {
            cwd: getWorkspaceRoot(),
            timeout: 30000,
        })
            .then(() => true)
            .catch((error: any) => {
                outputChannel.appendLine(`Fee estimation unavailable: ${error.message}`);
                return false;
            });
    }

    return supportsFeeEstimationPromise;
}

function showFeeEstimationUnavailableNotice(outputChannel: vscode.OutputChannel): void {
    if (shownFeeEstimationNotice) {
        return;
    }

    shownFeeEstimationNotice = true;
    const message = 'Fee estimation requires genlayer CLI ≥ 0.40 — deploying without explicit fees.';
    outputChannel.appendLine(message);
    vscode.window.showInformationMessage(message);
}

async function estimateDeployFees(rpcUrl: string | undefined, outputChannel: vscode.OutputChannel): Promise<string> {
    const args = ['estimate-fees', '--json'];
    if (rpcUrl) {
        args.push('--rpc', rpcUrl);
    }

    outputChannel.appendLine(`Estimating deployment fees: genlayer ${args.join(' ')}`);
    const { stdout } = await execFileAsync('genlayer', args, {
        cwd: getWorkspaceRoot(),
        timeout: 120000,
    });
    const lines = stdout
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);
    const rawJson = lines[lines.length - 1];
    if (!rawJson) {
        throw new Error('genlayer estimate-fees --json returned no output');
    }
    const estimate = JSON.parse(rawJson) as FeeEstimate;
    const feeValue = estimate.feeValue ?? estimate.fee_value;
    if (feeValue !== undefined) {
        outputChannel.appendLine(`Estimated fee deposit: ${String(feeValue)} wei (~${formatGenFromWei(feeValue)} GEN)`);
    }
    return feePresetFromEstimate(estimate);
}

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
            { label: '🧪 TestNet Bradbury', value: 'testnet-bradbury', description: 'Bradbury Test Network' },
            { label: '🧪 TestNet Asimov', value: 'testnet-asimov', description: 'Asimov Test Network' },
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

        let rpcUrl: string | undefined;

        if (selected.value === 'custom') {
            // Prompt for custom RPC URL
            rpcUrl = await vscode.window.showInputBox({
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
        } else {
            // For standard networks, set network first then deploy
            outputChannel.appendLine(`\nSetting network to ${selected.label}...`);
            try {
                const { stdout: networkOut, stderr: networkErr } = await execFileAsync(
                    'genlayer',
                    ['network', 'set', selected.value],
                    {
                        cwd: getWorkspaceRoot(),
                        timeout: 30000,
                    }
                );

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
        }

        // Execute deployment with interactive support
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Deploying Intelligent Contract",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: "Initiating deployment..." });

            const deployArgs = ['deploy', '--contract', contractPath];

            if (await supportsFeeEstimation(outputChannel)) {
                const feePreset = await estimateDeployFees(rpcUrl, outputChannel);
                deployArgs.push('--fees', feePreset);
            } else {
                showFeeEstimationUnavailableNotice(outputChannel);
            }

            if (rpcUrl) {
                deployArgs.push('--rpc', rpcUrl);
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
