import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

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

export class GenVMLinter {
    private config: vscode.WorkspaceConfiguration;
    private outputChannel: vscode.OutputChannel;

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
        this.config = vscode.workspace.getConfiguration('genvm');
    }

    public reloadConfiguration(): void {
        this.config = vscode.workspace.getConfiguration('genvm');
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
        return new Promise((resolve, reject) => {
            const pythonPath = this.config.get('python.interpreterPath', 'python3');
            const severity = this.config.get('linting.severity', 'warning') as string;
            const excludeRules = this.config.get('linting.excludeRules', []) as string[];

            const args = ['-m', 'genvm_linter.cli', filePath, '--format', 'json'];
            
            if (severity && severity !== 'info') {
                args.push('--severity', severity);
            }

            excludeRules.forEach(rule => {
                args.push('--exclude-rule', rule);
            });

            this.outputChannel.appendLine(`Running: ${pythonPath} ${args.join(' ')}`);

            const childProcess: ChildProcess = spawn(pythonPath, args, {
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd()
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
                        const output: GenVMLintOutput = JSON.parse(stdout);
                        this.outputChannel.appendLine(`GenLayer parsed ${output.results?.length || 0} results`);
                        resolve(output.results || []);
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