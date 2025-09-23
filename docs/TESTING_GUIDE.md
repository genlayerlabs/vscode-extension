# GenVM Linter - Testing Guide for Advanced Features

## Installation

1. Install the VSIX file:
   ```bash
   code --install-extension genvm-linter-0.1.0.vsix
   ```

2. Reload VS Code window:
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
   - Type "Reload Window" and press Enter

## Enable Features in Settings

Add to your VS Code `settings.json`:
```json
{
    "editor.inlayHints.enabled": true,
    "editor.parameterHints.enabled": true,
    "editor.hover.enabled": true,
    "editor.hover.delay": 300,
    "editor.quickSuggestions": {
        "other": true,
        "comments": false,
        "strings": false
    },
    "editor.codeActionsOnSave": {
        "source.fixAll": true
    }
}
```

## Testing Each Feature

### 1. 🔧 Code Actions (Quick Fixes)

**What it does:** Provides automatic fixes for common issues

**How to test:**
1. Open `test-all-features.py`
2. Look for red/yellow squiggles under errors
3. Click on the squiggle or press `Ctrl+.` (Windows/Linux) or `Cmd+.` (Mac)
4. Choose a fix from the menu

**Test cases:**
- Missing `@gl.public` decorator → Adds decorator automatically
- `int` to `u256` conversion → Wraps value with `u256()`
- Missing imports → Adds `from genlayer import ...`
- Write method returning value → Removes return statement

**Example:**
```python
# Before (shows error)
def get_balance(self):  # ← Missing decorator
    return self.balance

# After quick fix
@gl.public.view
def get_balance(self):
    return self.balance
```

### 2. 💡 Inlay Hints (Inline Type Information)

**What it does:** Shows type information inline without cluttering code

**How to test:**
1. Open any GenVM contract file
2. Look for grayed-out hints next to variables and parameters
3. Toggle with `Ctrl+Alt+Shift+H` if needed

**What you'll see:**
```python
balance = u256(1000)  # : u256  ← Type hint appears here
contract = gl.ContractAt(addr)  # : ContractProxy
self.transfer(addr, amount)  # to: addr, amount: amount
```

### 3. 🔍 Go to Definition (F12)

**What it does:** Navigate to where symbols are defined

**How to test:**
1. Hold `Ctrl` (or `Cmd` on Mac) and hover over any symbol
2. Click when it becomes a link, or press `F12`
3. Should jump to definition

**Test scenarios:**
- Click on method names → Goes to method definition
- Click on variables → Goes to declaration
- Click on imports → Opens imported file
- Click on base classes → Goes to class definition

### 4. 📖 Enhanced Hover Information

**What it does:** Shows rich documentation on hover

**How to test:**
1. Hover mouse over any symbol
2. Wait for tooltip (300ms default)

**What you'll see:**
- **Types:** Description, examples, gas costs
- **Methods:** Full signature, parameters, return type
- **Decorators:** Documentation and usage
- **Security warnings:** For dangerous patterns
- **Links:** Direct links to documentation

**Example hover content:**
```
u256
Unsigned 256-bit integer

Example:
u256(1000000)

⛽ Gas Cost: Storage: 20000 gas

📖 Documentation
```

### 5. ♻️ Refactoring

**What it does:** Extract code into methods or variables

**How to test:**
1. Select a block of code
2. Press `Ctrl+.` (or `Cmd+.` on Mac)
3. Choose "Extract Method" or "Extract Variable"

**Example:**
```python
# Select these lines
processed = data.upper()
result = hash(processed)

# After "Extract Method":
def _process_data(self, data):
    processed = data.upper()
    return hash(processed)

# Original code becomes:
result = self._process_data(data)
```

### 6. 🎯 Parameter Hints

**What it does:** Shows parameter names while typing

**How to test:**
1. Type a function call
2. When you type `(`, parameter hints appear
3. Navigate with Tab

**Example:**
```python
gl.nondet.web.get(  # Shows: (url: str, headers: dict)
```

### 7. 🐛 Diagnostics with Quick Fixes

**What it does:** Real-time error detection with fixes

**Error types:**
- 🔴 **Errors** (red squiggles): Must fix
- 🟡 **Warnings** (yellow squiggles): Should fix
- 🔵 **Info** (blue squiggles): Suggestions

## Keyboard Shortcuts

| Action | Windows/Linux | Mac |
|--------|--------------|-----|
| Quick Fix | `Ctrl+.` | `Cmd+.` |
| Go to Definition | `F12` | `F12` |
| Peek Definition | `Alt+F12` | `Option+F12` |
| Go to References | `Shift+F12` | `Shift+F12` |
| Rename Symbol | `F2` | `F2` |
| Format Document | `Shift+Alt+F` | `Shift+Option+F` |
| Show Hover | `Ctrl+K Ctrl+I` | `Cmd+K Cmd+I` |
| Trigger Suggestions | `Ctrl+Space` | `Cmd+Space` |
| Show Parameter Hints | `Ctrl+Shift+Space` | `Cmd+Shift+Space` |

## Troubleshooting

### Features not working?

1. **Check extension is active:**
   - Open Command Palette (`Ctrl+Shift+P`)
   - Type "GenVM: Show Output"
   - Check for errors

2. **Reload window:**
   - Command Palette → "Reload Window"

3. **Check settings:**
   - Ensure features are enabled in settings.json

4. **Check file type:**
   - File should be `.py` with GenVM imports
   - Or have magic comment: `# { "Depends": "py-genlayer:test" }`

### Performance issues?

1. **Disable unused features:**
   ```json
   {
       "editor.inlayHints.enabled": false,  // If too many hints
       "editor.hover.delay": 1000  // Increase delay
   }
   ```

2. **Limit file size:**
   - Large files may slow down analysis

## Test File

Use `test-all-features.py` to test all features:
1. Open the file in VS Code
2. Follow the inline comments
3. Try each feature as described

## Feedback

Found issues? Report at:
- GitHub: https://github.com/genlayerlabs/vscode-extension/issues
- Include: VS Code version, extension version, error messages