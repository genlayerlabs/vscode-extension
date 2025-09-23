import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Check if a document is a GenVM/GenLayer file
 */
export function isGenVMFile(document: vscode.TextDocument): boolean {
    // Check if it's a Python file
    if (document.languageId !== 'python' && document.languageId !== 'genvm-python') {
        return false;
    }

    const text = document.getText();

    // Check for GenVM-specific imports and patterns
    const genVMPatterns = [
        /from\s+genlayer\s+import/,
        /import\s+genlayer/,
        /from\s+genvm/,
        /import\s+genvm/,
        /class\s+\w+\s*\(\s*(gl\.)?Contract\s*\)/,
        /@gl\./,
        /gl\.public/,
        /gl\.private/
    ];

    return genVMPatterns.some(pattern => pattern.test(text));
}

/**
 * Get the Python interpreter path from configuration
 */
export function getPythonPath(): string {
    return vscode.workspace.getConfiguration('genlayer').get<string>('python.interpreterPath', 'python3');
}

/**
 * Get the workspace root path
 */
export function getWorkspaceRoot(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}