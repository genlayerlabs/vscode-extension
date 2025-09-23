# GenLayer VS Code Extension Architecture

## Overview

The GenLayer VS Code Extension provides IDE integration for developing GenLayer intelligent contracts, featuring real-time linting, code intelligence, and deployment capabilities. It integrates with the Python-based genvm-linter package to provide comprehensive validation.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     VS Code Editor                          │
│  ┌────────────────────────────────────────────────────┐    │
│  │         GenLayer VS Code Extension (TypeScript)     │    │
│  │                                                     │    │
│  │  Entry Point & Activation                          │    │
│  │  • extension.ts                                    │    │
│  │                                                     │    │
│  │  Language Features                                 │    │
│  │  • diagnostics-provider.ts (real-time linting)    │    │
│  │  • hover-provider.ts (hover information)          │    │
│  │  • autocomplete-provider.ts (IntelliSense)        │    │
│  │  • signature-provider.ts (parameter hints)        │    │
│  │  • definition-provider.ts (go to definition)      │    │
│  │  • code-actions-provider.ts (quick fixes)         │    │
│  │  • inlay-hints-provider.ts (inline hints)         │    │
│  │                                                     │    │
│  │  Commands & Helpers                                │    │
│  │  • commands/deploy-command.ts                     │    │
│  │  • helpers/interactive-process.ts                 │    │
│  │  • helpers/dependency-manager.ts                  │    │
│  │  • helpers/helpers.ts                             │    │
│  └──────────────┬────────────────┬────────────────────┘    │
│                 │                │                          │
│                 ▼                ▼                          │
│         Spawns Process      JSON Communication              │
└─────────────────┼────────────────┼─────────────────────────┘
                  │                │
                  ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│              Python Linter (genvm-linter)                   │
│         Installed as separate Python package                │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Extension Entry Point (`src/extension.ts`)

The main activation function that sets up all providers and commands:

```typescript
export async function activate(context: vscode.ExtensionContext) {
    // Create output channel
    const outputChannel = vscode.window.createOutputChannel('GenLayer');

    // Check dependencies
    if (autoInstall) {
        await checkAndInstallDependencies(outputChannel);
    }

    // Initialize providers
    diagnosticsProvider = new GenVMDiagnosticsProvider(outputChannel);

    // Register language features
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(...),
        vscode.languages.registerSignatureHelpProvider(...),
        vscode.languages.registerCodeActionsProvider(...),
        vscode.languages.registerInlayHintsProvider(...),
        vscode.languages.registerDefinitionProvider(...),
        vscode.languages.registerHoverProvider(...)
    );

    // Register commands
    registerCommands(context, outputChannel);
}
```

### 2. Diagnostics Provider (`src/diagnostics-provider.ts`)

Manages real-time linting and error reporting:

```typescript
class GenVMDiagnosticsProvider {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private linter: GenVMLinter;

    async updateDiagnostics(document: vscode.TextDocument) {
        if (!isGenVMFile(document)) return;

        // Run Python linter
        const results = await this.linter.lintDocument(document);

        // Convert to VS Code diagnostics
        const diagnostics = results.map(result => {
            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(
                    result.line - 1, result.column,
                    result.line - 1, result.column + 1
                ),
                result.message,
                this.getSeverity(result.severity)
            );
            diagnostic.code = result.rule_id;
            return diagnostic;
        });

        this.diagnosticCollection.set(document.uri, diagnostics);
    }
}
```

### 3. Language Feature Providers

#### Autocomplete Provider (`src/autocomplete-provider.ts`)
- GenVM types (`u256`, `u64`, `TreeMap`, `DynArray`)
- Decorators (`@gl.public.view`, `@gl.public.write`)
- Contract methods and properties

#### Hover Provider (`src/hover-provider.ts`)
- Type information on hover
- Documentation for GenVM APIs
- Error explanations

#### Signature Provider (`src/signature-provider.ts`)
- Parameter hints for GenVM methods
- Constructor parameter information

#### Code Actions Provider (`src/code-actions-provider.ts`)
- Quick fixes for common issues
- Auto-import suggestions
- Type conversion helpers

### 4. Command Handlers

#### Deploy Command (`src/commands/deploy-command.ts`)
```typescript
export async function deployContract(document: vscode.TextDocument, outputChannel: vscode.OutputChannel) {
    // Network selection
    const network = await selectNetwork();

    // Execute deployment with interactive prompts
    const result = await executeInteractiveCommand(
        'genlayer',
        ['deploy', '--contract', document.fileName],
        outputChannel,
        {
            onProgress: updateProgress,
            timeout: 120000
        }
    );

    // Handle result
    if (result.success) {
        showSuccessMessage(result.contractAddress);
    }
}
```

### 5. Helper Modules

#### Interactive Process Handler (`src/helpers/interactive-process.ts`)
Manages subprocess communication with password and keypair prompts:

```typescript
export async function executeInteractiveCommand(
    command: string,
    args: string[],
    outputChannel: vscode.OutputChannel,
    options?: CommandOptions
): Promise<CommandResult> {
    // Spawn process
    const child = spawn(command, args);

    // Handle interactive prompts
    child.stdout.on('data', async (data) => {
        if (isPasswordPrompt(data)) {
            await handlePasswordPrompt(child, data);
        } else if (isKeypairPrompt(data)) {
            await handleKeypairPrompt(child, data);
        }
    });
}
```

#### Dependency Manager (`src/helpers/dependency-manager.ts`)
Handles Python package installation:

```typescript
export async function checkAndInstallDependencies(outputChannel: vscode.OutputChannel) {
    // Check for required packages
    const missing = await checkPackages(['genvm-linter', 'mypy']);

    if (missing.length > 0) {
        // Prompt user to install
        const response = await vscode.window.showInformationMessage(
            `Missing packages: ${missing.join(', ')}`,
            'Install', 'Later'
        );

        if (response === 'Install') {
            await installPackages(outputChannel, missing);
        }
    }
}
```

## Communication Protocol

### Python Linter Integration

The extension communicates with the Python linter via JSON:

```typescript
// Request to Python linter
const args = [
    '-m', 'genvm_linter.cli',
    filePath,
    '--format', 'json',
    '--severity', severity
];

const child = spawn(pythonPath, args);

// Parse JSON response
const output = JSON.parse(stdout);
const results: LintResult[] = output.results;
```

### JSON Response Format

```json
{
    "results": [
        {
            "rule_id": "genvm-types",
            "message": "Storage field must use sized integer",
            "severity": "error",
            "line": 10,
            "column": 4,
            "filename": "contract.py",
            "suggestion": "Change 'int' to 'u256'"
        }
    ],
    "summary": {
        "total": 1,
        "by_severity": {
            "error": 1,
            "warning": 0,
            "info": 0
        }
    }
}
```

## Available Commands

1. **genvm.lintCurrentFile** - Lint the active Python file
2. **genvm.lintWorkspace** - Lint all GenVM contracts in workspace
3. **genvm.showOutputChannel** - Show the GenLayer output channel
4. **genvm.debug** - Show debug information
5. **genvm.testLint** - Test the linter with a sample contract
6. **genvm.installDependencies** - Install required Python packages
7. **genvm.createContract** - Create new intelligent contract from template
8. **genvm.deployContract** - Deploy contract to GenLayer network

## Configuration

### Extension Settings

```json
{
    "genvm.linting.enabled": true,
    "genvm.linting.severity": "warning",
    "genvm.linting.showSuggestions": true,
    "genvm.linting.excludeRules": [],
    "genvm.python.interpreterPath": "python3",
    "genvm.autoInstallDependencies": true
}
```

### Workspace Configuration

The extension respects `.vscode/settings.json` for project-specific configuration:

```json
{
    "genvm.linting.excludeRules": ["genvm-magic-comment"],
    "genvm.python.interpreterPath": "${workspaceFolder}/venv/bin/python"
}
```

## File Detection

The extension automatically detects GenVM files by:

1. Magic comment: `# { "Depends": "py-genlayer:test" }`
2. GenLayer imports: `from genlayer import *`
3. Contract class: `class MyContract(gl.Contract)`
4. Filename patterns: containing "contract", "genvm", or "genlayer"

## Event Handling

### File System Events

```typescript
const watcher = vscode.workspace.createFileSystemWatcher('**/*.py');

watcher.onDidChange(uri => {
    diagnosticsProvider.updateDiagnostics(uri);
});

watcher.onDidCreate(uri => {
    diagnosticsProvider.updateDiagnostics(uri);
});
```

### Document Events

```typescript
vscode.workspace.onDidChangeTextDocument(event => {
    if (isGenVMFile(event.document)) {
        diagnosticsProvider.updateDiagnostics(event.document);
    }
});

vscode.workspace.onDidSaveTextDocument(document => {
    if (isGenVMFile(document)) {
        diagnosticsProvider.updateDiagnostics(document);
    }
});
```

## Code Snippets

The extension provides snippets for common patterns:

- `genvm-contract` - Complete contract template
- `genvm-magic` - Magic comment
- `genvm-import` - GenLayer imports
- `genvm-view` - Public view method
- `genvm-write` - Public write method
- `genvm-dataclass` - Storage dataclass
- `genvm-treemap` - TreeMap field
- `genvm-dynarray` - DynArray field

## Testing

### Extension Testing

```typescript
suite('Extension Test Suite', () => {
    test('Detects GenVM files', () => {
        const document = createMockDocument(contractCode);
        assert(isGenVMFile(document));
    });

    test('Provides completions', async () => {
        const completions = await provider.provideCompletionItems(document, position);
        assert(completions.items.length > 0);
    });
});
```

### Integration Testing

- Test contract deployment
- Test interactive prompts
- Test dependency installation
- Test linting accuracy

## Performance Optimizations

1. **Debounced Updates**: Diagnostics update after 500ms of inactivity
2. **Incremental Processing**: Only lint changed files
3. **Caching**: Cache linter results for unchanged files
4. **Lazy Loading**: Load providers only when needed

## Future Enhancements

1. **Refactoring Support**: Automated code refactoring
2. **Debugging Integration**: GenLayer contract debugging
3. **Test Runner**: Integrated test execution
4. **Contract Templates**: More sophisticated templates
5. **Multi-root Workspace**: Better support for monorepos