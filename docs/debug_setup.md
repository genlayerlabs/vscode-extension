# GenVM Linter VS Code Extension - Debug Setup

## Issue Identification

The VS Code extension is not showing linting errors. This is likely due to:

1. **Python Path Issues**: VS Code can't find the Python interpreter
2. **Package Installation**: genvm-linter package not installed in the Python environment
3. **Configuration Issues**: Extension settings not properly configured

## Debugging Steps

### 1. Test the Extension
1. Open the `vscode-extension` folder in VS Code
2. Press `F5` to launch Extension Development Host
3. In the new VS Code window, open your test contract file
4. Try these commands from Command Palette (`Ctrl+Shift+P`):
   - "GenVM: Debug Current File"
   - "GenVM: Test Linter"
   - "GenVM: Show GenVM Output"

### 2. Check Python Configuration
Add this to VS Code User Settings or Workspace Settings:

```json
{
  "genvm.python.interpreterPath": "/usr/local/bin/python3",
  "genvm.linting.enabled": true,
  "genvm.linting.severity": "info"
}
```

**Find your Python path:**
```bash
# Check which Python has genvm-linter
which python3
python3 -c "import sys; print(sys.executable)"
python3 -m genvm_linter.cli --help
```

### 3. Install GenVM Linter Package
```bash
# From the main genvm-linter directory
cd /Users/canelito/projetos/genlayer/genvm-linter
pip3 install -e .

# Verify installation
python3 -m genvm_linter.cli --help
```

### 4. Manual Test
Test the linter manually on your contract:

```bash
cd /Users/canelito/projetos/genlayer/genvm-linter
python3 -m genvm_linter.cli your_contract.py --format json
```

This should output JSON with the linting results.

### 5. VS Code Extension Settings

Open VS Code Settings and configure:

- **GenVM: Linting: Enabled** → ✅ True
- **GenVM: Python: Interpreter Path** → Full path to Python (e.g., `/usr/local/bin/python3`)
- **GenVM: Linting: Severity** → "info" (to show all issues)

### 6. Check VS Code Output

1. View → Output
2. Select "GenVM Linter" from dropdown
3. Look for error messages

Common issues:
- `command not found: python3`
- `No module named 'genvm_linter'`
- `Permission denied`

## Expected Behavior

When working correctly:
1. **On file save**: Diagnostics appear as red squiggles
2. **Problems panel**: Shows GenVM linting issues
3. **Hover**: Shows error messages
4. **Output channel**: Shows linter execution logs

## Test Contract

Use this contract to test (should show 1 error):

```python
# { "Depends": "py-genlayer:test" }

from genlayer import *

class TestContract(gl.Contract):
    value: u256

    def __init__(self):
        self.value = 0

    @gl.public.write
    def analyze_banner(self) -> u64:  # ← This should show error: use 'int' not 'u64'
        return 42
```

Expected error: `Method 'analyze_banner' returns 'u64' type. Use 'int' for return types [genvm-types]`