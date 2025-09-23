# GenVM Linter Extension - Troubleshooting

## Quick Fix for Your Issue

The VS Code extension is not highlighting the `u64` return type error. Here's how to fix it:

### Step 1: Install the Python Package
```bash
cd /Users/canelito/projetos/genlayer/genvm-linter
pip3 install -e .
```

### Step 2: Test CLI Manually
```bash
# Test with your contract
python3 -m genvm_linter.cli your_contract.py
```

You should see:
```
error: Method 'analyze_banner' returns 'u64' type. Use 'int' for return types [genvm-types]
```

### Step 3: Configure VS Code Extension

1. **Install the Extension:**
   ```bash
   code --install-extension genvm-linter-0.1.0.vsix
   ```

2. **Configure Python Path:**
   - Open VS Code Settings (Ctrl+,)
   - Search for "genvm"
   - Set **GenVM: Python: Interpreter Path** to your Python path:
     ```bash
     # Find your Python path:
     which python3
     ```
   - Example: `/usr/local/bin/python3` or `/opt/homebrew/bin/python3`

3. **Enable All Severity Levels:**
   - Set **GenVM: Linting: Severity** to `info`

### Step 4: Test the Extension

1. **Open Extension Development:**
   - Open the `vscode-extension` folder in VS Code
   - Press `F5` to launch Extension Development Host

2. **Test Your Contract:**
   - In the new VS Code window, open your contract file
   - Save the file (Ctrl+S) to trigger linting
   - Run command: "GenVM: Test Linter" from Command Palette

3. **Check for Issues:**
   - Look for red squiggles under `-> u64:`
   - Check Problems panel (View → Problems)
   - Check Output channel (View → Output → GenVM Linter)

### Step 5: Debug Commands

Use these commands from Command Palette (Ctrl+Shift+P):

- **"GenVM: Debug Current File"** - Shows file detection info
- **"GenVM: Test Linter"** - Manually runs linter and shows results
- **"GenVM: Show GenVM Output"** - Shows extension logs

## Common Issues

### Issue 1: "No module named 'genvm_linter'"
```bash
# Solution: Install the package
cd /Users/canelito/projetos/genlayer/genvm-linter
pip3 install -e .
```

### Issue 2: "command not found: python3"
```bash
# Solution: Set correct Python path in VS Code settings
# Find Python: which python3
# Then set in VS Code: "genvm.python.interpreterPath": "/your/python/path"
```

### Issue 3: Extension Not Activating
- Check that file starts with `# { "Depends": "py-genlayer:test" }`
- Check file extension is `.py`
- Check VS Code Extensions panel shows "GenVM Linter" as active

### Issue 4: No Diagnostics Showing
1. Save the file to trigger linting
2. Check Output → GenVM Linter for errors
3. Verify Python path in settings
4. Run "GenVM: Test Linter" command manually

## Expected Results

With your test contract, you should see:

**Error:** Line 13, Column 0
```
Method 'analyze_banner' returns 'u64' type. Use 'int' for return types [genvm-types]
💡 Suggestion: Change return type from 'u64' to 'int'
```

## Manual Verification

Test the linter directly:
```bash
# Create test file
cat > test.py << 'EOF'
# { "Depends": "py-genlayer:test" }

from genlayer import *

class TestContract(gl.Contract):
    def __init__(self):
        pass

    @gl.public.write
    def analyze_banner(self) -> u64:
        return 42
EOF

# Run linter
python3 -m genvm_linter.cli test.py
```

If this shows the error but VS Code doesn't, the issue is with the extension configuration.