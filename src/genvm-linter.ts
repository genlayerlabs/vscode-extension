import * as vscode from 'vscode';
import { spawn, ChildProcess, execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const execFileAsync = promisify(execFile);

// Cached resolved path to genvm-lint
let resolvedGenvmLintPath: string | null = null;

export interface GenVMLintResult {
    rule_id: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
    line: number;
    column: number;
    filename?: string;
    suggestion?: string;
}

export interface GenVMLintOutput {
    results: GenVMLintResult[];
    summary: {
        total: number;
        by_severity: {
            error: number;
            warning: number;
            info: number;
        };
    };
}

/**
 * Resolve the path to genvm-lint executable.
 */
async function resolveGenvmLintPath(outputChannel: vscode.OutputChannel): Promise<string | null> {
    // Return cached path if available and still exists
    if (resolvedGenvmLintPath && fs.existsSync(resolvedGenvmLintPath)) {
        return resolvedGenvmLintPath;
    }

    const config = vscode.workspace.getConfiguration('genlayer');

    // 1. Check user setting
    const userPath = config.get<string>('linterPath', '');
    if (userPath) {
        const expandedPath = userPath.replace(/^~/, os.homedir());
        if (fs.existsSync(expandedPath)) {
            outputChannel.appendLine(`Using configured genvm-lint path: ${expandedPath}`);
            resolvedGenvmLintPath = expandedPath;
            return expandedPath;
        }
    }

    // 2. Try login shell lookup (gets full PATH including pipx, homebrew, etc.)
    if (process.platform !== 'win32') {
        try {
            const shell = process.env.SHELL || '/bin/zsh';
            const { stdout } = await execFileAsync(shell, ['-l', '-c', 'which genvm-lint'], {
                timeout: 5000
            });
            const foundPath = stdout.trim();
            if (foundPath && fs.existsSync(foundPath)) {
                outputChannel.appendLine(`Found genvm-lint via login shell: ${foundPath}`);
                resolvedGenvmLintPath = foundPath;
                return foundPath;
            }
        } catch {
            // Login shell lookup failed, continue to fallbacks
        }
    }

    // 3. Check common installation paths
    const homeDir = os.homedir();
    const commonPaths = [
        path.join(homeDir, '.local', 'bin', 'genvm-lint'),           // pipx default
        '/opt/homebrew/bin/genvm-lint',                              // Homebrew ARM Mac
        '/usr/local/bin/genvm-lint',                                 // Homebrew Intel Mac / manual
        path.join(homeDir, 'Library', 'Python', '3.12', 'bin', 'genvm-lint'),
        path.join(homeDir, 'Library', 'Python', '3.11', 'bin', 'genvm-lint'),
        path.join(homeDir, 'Library', 'Python', '3.10', 'bin', 'genvm-lint'),
    ];

    // Windows paths
    if (process.platform === 'win32') {
        const localAppData = process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local');
        commonPaths.push(
            path.join(localAppData, 'Programs', 'Python', 'Python312', 'Scripts', 'genvm-lint.exe'),
            path.join(localAppData, 'Programs', 'Python', 'Python311', 'Scripts', 'genvm-lint.exe'),
            path.join(homeDir, '.local', 'bin', 'genvm-lint.exe'),
        );
    }

    for (const p of commonPaths) {
        if (fs.existsSync(p)) {
            outputChannel.appendLine(`Found genvm-lint at common path: ${p}`);
            resolvedGenvmLintPath = p;
            return p;
        }
    }

    return null;
}

export class GenVMLinter {
    private config: vscode.WorkspaceConfiguration;
    private outputChannel: vscode.OutputChannel;

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
        this.config = vscode.workspace.getConfiguration('genlayer');
    }

    public reloadConfiguration(): void {
        this.config = vscode.workspace.getConfiguration('genlayer');
    }

    public async lintDocument(document: vscode.TextDocument): Promise<GenVMLintResult[]> {
        if (!this.config.get('linting.enabled', true)) {
            return [];
        }

        try {
            // Save document content to temporary file for linting
            const tempPath = this.createTempFile(document);
            const results = await this.runLinter(tempPath);
            
            // Clean up temp file
            this.cleanupTempFile(tempPath);
            
            return results;
        } catch (error) {
            this.outputChannel.appendLine(`GenLayer Error: ${error}`);
            return [];
        }
    }

    public async lintFile(filePath: string): Promise<GenVMLintResult[]> {
        if (!this.config.get('linting.enabled', true)) {
            return [];
        }

        try {
            return await this.runLinter(filePath);
        } catch (error) {
            this.outputChannel.appendLine(`GenLayer Error: ${error}`);
            return [];
        }
    }

    private async runLinter(filePath: string): Promise<GenVMLintResult[]> {
        // Resolve genvm-lint path first
        const genvmLintPath = await resolveGenvmLintPath(this.outputChannel);
        if (!genvmLintPath) {
            this.outputChannel.appendLine('genvm-lint not found. Please install it (pipx install genvm-linter) or set genlayer.linterPath in settings.');
            return [];
        }

        return new Promise((resolve, reject) => {
            const args = ['lint', filePath, '--json'];

            this.outputChannel.appendLine(`Running: ${genvmLintPath} ${args.join(' ')}`);

            const childProcess: ChildProcess = spawn(genvmLintPath, args, {
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd(),
                shell: false  // Use resolved path directly
            });

            let stdout = '';
            let stderr = '';

            childProcess.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            childProcess.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            childProcess.on('close', (code) => {
                this.outputChannel.appendLine(`GenLayer process exited with code: ${code}`);
                if (stderr) {
                    this.outputChannel.appendLine(`GenLayer stderr: ${stderr}`);
                }

                try {
                    if (stdout.trim()) {
                        this.outputChannel.appendLine(`GenLayer stdout length: ${stdout.length}`);
                        const output = JSON.parse(stdout);

                        // Handle modern format: {ok, passed, warnings: [{code, msg, line}]}
                        // Convert to internal format
                        let results: GenVMLintResult[] = [];

                        if (output.warnings && Array.isArray(output.warnings)) {
                            // Modern format
                            results = output.warnings.map((w: any) => ({
                                rule_id: w.code || 'unknown',
                                message: w.msg || w.message || '',
                                severity: w.code?.startsWith('E') ? 'error' : 'warning',
                                line: w.line || 1,
                                column: w.column || 0,
                                suggestion: w.suggestion
                            }));
                        } else if (output.results && Array.isArray(output.results)) {
                            // Legacy format
                            results = output.results;
                        }

                        // Apply client-side severity filter
                        const severityConfig = this.config.get('linting.severity', 'warning') as string;
                        if (severityConfig === 'error') {
                            results = results.filter(r => r.severity === 'error');
                        }

                        // Apply client-side rule exclusions
                        const excludeRules = this.config.get('linting.excludeRules', []) as string[];
                        if (excludeRules.length > 0) {
                            results = results.filter(r => !excludeRules.includes(r.rule_id));
                        }

                        this.outputChannel.appendLine(`GenLayer parsed ${results.length} results`);
                        resolve(results);
                    } else {
                        this.outputChannel.appendLine(`GenLayer: No output received`);
                        resolve([]);
                    }
                } catch (parseError) {
                    this.outputChannel.appendLine(`Failed to parse GenLayer linter output: ${parseError}`);
                    this.outputChannel.appendLine(`Raw output: ${stdout}`);
                    resolve([]);
                }
            });

            childProcess.on('error', (error) => {
                this.outputChannel.appendLine(`Failed to start GenLayer linter: ${error.message}`);
                reject(error);
            });
        });
    }

    private createTempFile(document: vscode.TextDocument): string {
        const tempDir = os.tmpdir();
        const fileName = path.basename(document.fileName) || 'temp.py';
        const tempPath = path.join(tempDir, `genvm_${Date.now()}_${fileName}`);
        
        fs.writeFileSync(tempPath, document.getText(), 'utf8');
        return tempPath;
    }

    private cleanupTempFile(tempPath: string): void {
        try {
            fs.unlinkSync(tempPath);
        } catch (error) {
            // Ignore cleanup errors
        }
    }
}