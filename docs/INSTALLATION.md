# GenLayer VS Code Extension - Installation Guide

## Prerequisites

- **Python 3.8+** - Required for the linter backend
- **VS Code 1.74.0+** - Minimum VS Code version
- **Node.js 16+** - Only needed for development

## Installation Options

### Option 1: Install from VS Code Marketplace (Recommended)

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "GenLayer"
4. Click Install

### Option 2: Install from VSIX Package

1. Download the latest `.vsix` file from [Releases](https://github.com/genlayerlabs/genvm-linter/releases)
2. In VS Code, press Ctrl+Shift+P (Cmd+Shift+P on Mac)
3. Type "Extensions: Install from VSIX"
4. Select the downloaded `.vsix` file

### Option 3: Install via Command Line

```bash
# Install the extension
code --install-extension genvm-linter-0.2.0.vsix
```

## Python Package Installation

The VS Code extension requires the Python linter package:

### From PyPI (Recommended)

```bash
pip install genvm-linter
```

### From Source

```bash
git clone https://github.com/genlayerlabs/genvm-linter.git
cd genvm-linter
pip install -e .
```

## Development Setup

For contributing to the extension:

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/genlayerlabs/genvm-linter.git
cd genvm-linter/vscode-extension
npm install
```

### 2. Build the Extension

```bash
# Compile TypeScript
npm run compile

# Watch mode for development
npm run watch
```

### 3. Test in Development

1. Open the `vscode-extension` folder in VS Code
2. Press `F5` to launch Extension Development Host
3. Test the extension in the new VS Code window

### 4. Package the Extension

```bash
# Install packaging tool
npm install -g vsce

# Create VSIX package
vsce package
```

## Configuration

### Python Interpreter Setup

Make sure the Python interpreter has the GenVM linter installed:

```bash
# Test that the linter is available
python3 -m genvm_linter.cli --help
```

Configure VS Code settings:

```json
{
    "genvm.python.interpreterPath": "python3",
    "genvm.linting.enabled": true,
    "genvm.linting.severity": "warning"
}
```

### Testing the Extension

1. Create a test file `test.py`:
```python
# { "Depends": "py-genlayer:test" }

from genlayer import *

class TestContract(gl.Contract):
    balance: u256

    def __init__(self):
        self.balance = 0

    @gl.public.view
    def get_balance(self) -> int:
        return self.balance
```

2. Save the file - you should see:
   - GenVM-specific syntax highlighting
   - Real-time linting diagnostics
   - Code snippets available (type `genvm-` and press Tab)

## Development

### Project Structure
```
vscode-extension/
├── src/                    # TypeScript source
│   ├── extension.ts        # Main extension entry point
│   ├── genvm-linter.ts     # Linter integration
│   └── diagnostics-provider.ts # VS Code diagnostics
├── syntaxes/               # Syntax highlighting
├── snippets/               # Code snippets
├── package.json            # Extension manifest
└── README.md               # Extension documentation
```

### Building

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode for development
npm run watch

# Lint the code
npm run lint
```

### Testing

```bash
# Run tests
npm test

# Launch extension in development mode
# Press F5 in VS Code
```

### Publishing

```bash
# Package for distribution
vsce package

# Publish to VS Code Marketplace (requires publisher account)
vsce publish
```

## Troubleshooting

### Extension Not Loading
- Check VS Code version (requires 1.74.0+)
- Verify package.json syntax
- Check TypeScript compilation errors: `npm run compile`

### Linting Not Working
- Verify Python installation: `python3 --version`
- Check GenVM linter: `python3 -m genvm_linter.cli --help`
- Check extension logs: View → Output → GenVM Linter

### Python Path Issues
- Set absolute path in settings: `"genvm.python.interpreterPath": "/usr/bin/python3"`
- Test manually: `which python3`
- Use Python where genvm-linter is installed

## Features Verified

✅ **Real-time Linting** - Diagnostics appear on save/edit  
✅ **Code Snippets** - Type `genvm-contract` and press Tab  
✅ **Syntax Highlighting** - GenVM types and decorators highlighted  
✅ **Command Palette** - "GenVM: Lint Current File" command  
✅ **Configuration** - Settings in VS Code preferences  
✅ **Error Reporting** - Issues shown in Problems panel  

## Next Steps

1. **Test thoroughly** with various GenVM contract files
2. **Customize settings** for your development workflow  
3. **Create workspace settings** for team consistency
4. **Report issues** or contribute improvements

## Support

- 📖 [GenVM Documentation](https://docs.genlayer.com/)
- 🐛 [Report Issues](https://github.com/genlayerlabs/genvm-linter/issues)
- 💬 [GenLayer Community](https://discord.gg/genlayer)