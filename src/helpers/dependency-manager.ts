import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getPythonPath } from './helpers';

const execAsync = promisify(exec);

/**
 * Check and install dependencies if needed
 */
export async function checkAndInstallDependencies(outputChannel: vscode.OutputChannel): Promise<void> {
    const pythonPath = getPythonPath();

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

        const message = `GenLayer requires Python packages: ${missingPackages.join(' and ')}. Would you like to install them?`;

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

/**
 * Install Python packages
 */
export async function installPackages(outputChannel: vscode.OutputChannel, packages?: string[]): Promise<void> {
    const pythonPath = getPythonPath();
    const packagesToInstall = packages || ['genvm-linter', 'mypy'];

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Installing GenLayer dependencies',
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
            vscode.window.showInformationMessage('GenLayer dependencies installed successfully! You may need to reload the window.');

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