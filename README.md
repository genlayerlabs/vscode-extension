# GenVM Linter - VS Code Extension

A comprehensive VS Code extension for linting and developing GenLayer GenVM smart contracts in Python.

## Features

### 🔍 Real-time Linting
- **Automatic validation** of GenVM contract files on save and edit
- **Inline diagnostics** with error squiggles and hover information
- **Comprehensive rule checking** for GenVM-specific syntax and patterns

### 📝 Code Intelligence
- **Smart snippets** for common GenVM patterns
- **Syntax highlighting** for GenVM-specific types and decorators
- **Auto-completion** for GenVM types and decorators

### ⚙️ Configurable Rules
- **Rule filtering** - enable/disable specific linting rules
- **Severity levels** - customize error/warning/info levels
- **Workspace settings** - per-project configuration

## Installation

### Prerequisites
1. **Python 3.8+** with the GenVM linter package installed:
   ```bash
   pip install genvm-linter
   ```

2. **VS Code 1.74.0+**

### Install Extension
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "GenVM Linter"
4. Click Install

### Manual Installation
1. Download the `.vsix` file
2. In VS Code, press Ctrl+Shift+P
3. Type "Extensions: Install from VSIX"
4. Select the downloaded `.vsix` file

## Usage

### Automatic Linting
The extension automatically detects GenVM contract files by looking for:
- Files with the GenVM magic comment: `# { "Depends": "py-genlayer:test" }`
- Python files with "contract", "genvm", or "genlayer" in the filename

### Manual Commands
- **Ctrl+Shift+P** → "GenVM: Lint Current File"
- **Ctrl+Shift+P** → "GenVM: Lint Workspace"
- **Ctrl+Shift+P** → "GenVM: Show GenVM Output"

### Code Snippets
Type these prefixes and press Tab:

- `genvm-contract` - Complete contract template
- `genvm-magic` - Magic comment
- `genvm-import` - GenLayer import
- `genvm-view` - Public view method
- `genvm-write` - Public write method
- `genvm-dataclass` - Storage dataclass
- `genvm-treemap` - TreeMap field
- `genvm-dynarray` - DynArray field

## Configuration

Configure the extension through VS Code settings:

```json
{
  "genvm.linting.enabled": true,
  "genvm.linting.severity": "warning",
  "genvm.linting.showSuggestions": true,
  "genvm.linting.excludeRules": [],
  "genvm.python.interpreterPath": "python3"
}
```

### Available Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `genvm.linting.enabled` | boolean | `true` | Enable/disable GenVM linting |
| `genvm.linting.severity` | string | `"warning"` | Minimum severity to show (`error`, `warning`, `info`) |
| `genvm.linting.showSuggestions` | boolean | `true` | Show fix suggestions in diagnostics |
| `genvm.linting.excludeRules` | array | `[]` | Rules to exclude from linting |
| `genvm.python.interpreterPath` | string | `"python3"` | Path to Python interpreter |

### Example Workspace Settings

```json
{
  "genvm.linting.enabled": true,
  "genvm.linting.severity": "error",
  "genvm.linting.excludeRules": ["genvm-magic-comment"],
  "genvm.python.interpreterPath": "/usr/local/bin/python3.11"
}
```

## Validation Rules

The extension validates the following GenVM-specific rules:

### Structure Rules
- ✅ Magic comment on first line
- ✅ GenLayer import statement
- ✅ Single contract class extending `gl.Contract`

### Type System Rules
- ✅ Sized integers in storage (`u256`, `u64`, etc.)
- ✅ GenVM collections (`TreeMap`, `DynArray`)
- ✅ Correct return types (`int` not `u256`)
- ✅ Dataclass storage decorators

### Decorator Rules
- ✅ Proper `@gl.public.view`/`@gl.public.write` usage
- ✅ No decorators on constructors
- ✅ State modification detection

## Example

![GenVM Linter in action](./images/genvm-linter-demo.gif)

```python
# { "Depends": "py-genlayer:test" }

from genlayer import *

class TokenContract(gl.Contract):
    balance: u256  # ✅ Correct: sized integer for storage
    owner: Address

    def __init__(self, initial_balance: int):
        self.balance = initial_balance
        self.owner = gl.message.sender_address

    @gl.public.view  # ✅ Correct: view decorator for read-only
    def get_balance(self) -> int:  # ✅ Correct: int return type
        return self.balance

    @gl.public.write  # ✅ Correct: write decorator for state changes
    def transfer(self, to: str, amount: int):
        if amount > self.balance:
            raise gl.Rollback("Insufficient balance")
        self.balance -= amount
```

## Troubleshooting

### Extension Not Working
1. Check that Python is installed and accessible
2. Verify genvm-linter package is installed: `pip show genvm-linter`
3. Check the GenVM Output channel for error messages
4. Ensure Python interpreter path is correct in settings

### Linting Not Triggering
1. Verify file contains GenVM magic comment
2. Check that linting is enabled in settings
3. Save the file to trigger linting
4. Check Output → GenVM Linter for error messages

### Python Path Issues
1. Set absolute path in `genvm.python.interpreterPath`
2. Use the Python interpreter where genvm-linter is installed
3. Test manually: `python3 -m genvm_linter.cli --version`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test the extension
5. Submit a pull request

### Development Setup

```bash
git clone https://github.com/genlayerlabs/genvm-linter.git
cd genvm-linter/vscode-extension
npm install
npm run compile
```

Press F5 in VS Code to launch Extension Development Host.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Related

- [GenVM Linter CLI](../README.md) - Command-line linter
- [GenLayer Documentation](https://docs.genlayer.com/)
- [GenLayer Studio](https://studio.genlayer.com/)
- [GenLayer Protocol](https://www.genlayer.com/)