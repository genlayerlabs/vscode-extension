# GenLayer VS Code Extension - Troubleshooting

## Common Issues and Solutions

### Extension Not Working

#### Problem: No linting errors appear in VS Code

**Solution 1: Verify Python Package Installation**
```bash
# Check if genvm-linter is installed
pip show genvm-linter

# If not installed, install it:
pip install genvm-linter
# OR from source:
pip install -e /path/to/genvm-linter
```

**Solution 2: Configure Python Interpreter**
1. Open VS Code Settings (Ctrl+, / Cmd+,)
2. Search for "genvm.python.interpreterPath"
3. Set it to your Python executable path:
   ```bash
   # Find your Python path:
   which python3
   ```
4. Common paths:
   - macOS: `/usr/local/bin/python3` or `/opt/homebrew/bin/python3`
   - Linux: `/usr/bin/python3`
   - Windows: `C:\Python39\python.exe`

**Solution 3: Check Extension Activation**
1. Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
2. Run "GenVM: Show GenVM Output"
3. Check for error messages in the output panel

### Linting Not Triggering

#### Problem: Files are not being validated

**Solution 1: Verify File Has Magic Comment**
```python
# { "Depends": "py-genlayer:test" }  # Required on first line
from genlayer import *
```

**Solution 2: Enable Linting in Settings**
```json
{
  "genvm.linting.enabled": true,
  "genvm.linting.severity": "info"
}
```

**Solution 3: Manually Trigger Linting**
- Save the file (Ctrl+S / Cmd+S)
- Or run command: "GenVM: Lint Current File"

### Python Path Issues

#### Problem: "Python interpreter not found" error

**Solution 1: Set Absolute Path**
```json
{
  "genvm.python.interpreterPath": "/usr/local/bin/python3"
}
```

**Solution 2: Test CLI Manually**
```bash
# Test if the linter works from command line
python3 -m genvm_linter.cli your_contract.py
```

**Solution 3: Use Python from Virtual Environment**
```bash
# Activate your virtual environment
source venv/bin/activate

# Get Python path
which python

# Use this path in VS Code settings
```

### Specific Error Types Not Showing

#### Problem: Some validation errors don't appear

**Solution 1: Check Severity Level**
```json
{
  "genvm.linting.severity": "info"  // Shows all: error, warning, info
}
```

**Solution 2: Check Excluded Rules**
```json
{
  "genvm.linting.excludeRules": []  // Empty array excludes nothing
}
```

### Performance Issues

#### Problem: Extension is slow or unresponsive

**Solution 1: Check File Size**
- Very large files may take longer to validate
- Consider splitting large contracts

**Solution 2: Disable Auto-Save**
- Constant auto-saves can trigger too many validations
- Use manual save (Ctrl+S) instead

## Debug Commands

Use these commands from Command Palette (Ctrl+Shift+P / Cmd+Shift+P):
- **"GenVM: Debug Current File"** - Shows detailed debug output
- **"GenVM: Test Linter"** - Tests if linter is working
- **"GenVM: Show GenVM Output"** - Shows extension output channel
- **"GenVM: Lint Current File"** - Manually trigger linting
- **"GenVM: Install Dependencies"** - Install required Python packages

## Manual Testing

Test the linter directly from command line:

```bash
# Create a test contract file
cat > test_contract.py << 'EOF'
# { "Depends": "py-genlayer:test" }
from genlayer import *

class TestContract(gl.Contract):
    balance: int  # Should be u256

    def __init__(self):
        self.balance = 0

    @gl.public.view
    def get_balance(self) -> u256:  # Should return int
        return self.balance
EOF

# Run the linter
python3 -m genvm_linter.cli test_contract.py
```

Expected output:
```
error: Storage field 'balance' uses 'int' type. Use sized integers [genvm-types]
error: Method 'get_balance' returns 'u256' type. Use 'int' for return types [genvm-types]
```

## Getting Help

### Before Reporting an Issue

1. Check the [CHANGELOG](../../CHANGELOG.md) for recent changes
2. Search [existing issues](https://github.com/genlayerlabs/genvm-linter/issues)
3. Try the solutions in this guide

### Reporting Issues

Include in your report:
- VS Code version (`code --version`)
- Python version (`python3 --version`)
- GenVM linter version (`pip show genvm-linter`)
- Operating system and version
- Sample code that reproduces the issue
- Error messages from Output panel

### Community Resources

- [GitHub Issues](https://github.com/genlayerlabs/genvm-linter/issues)
- [GenLayer Documentation](https://docs.genlayer.com)
- [GenLayer Discord](https://discord.gg/genlayer)