# New GenVM Linter Features

## 1. ✅ Required __init__ Method (ERROR)

The `__init__` method is now **required** for all GenVM contracts. Previously it was a WARNING, now it's an ERROR that will prevent the contract from being considered valid.

### Example of Invalid Contract:
```python
# { "Depends": "py-genlayer:test" }
from genlayer import *

class MyContract(gl.Contract):  # ❌ ERROR: Missing __init__ method
    @gl.public.view
    def get_value(self) -> int:
        return 0
```

### Example of Valid Contract:
```python
# { "Depends": "py-genlayer:test" }
from genlayer import *

class MyContract(gl.Contract):  # ✅ Valid: Has __init__ method
    def __init__(self):
        pass
    
    @gl.public.view
    def get_value(self) -> int:
        return 0
```

## 2. 🆕 Create New Contract Command

A new VSCode command has been added to quickly create GenVM contract templates.

### How to Use:

#### Option 1: Command Palette
1. Open Command Palette (`Cmd+Shift+P` on Mac, `Ctrl+Shift+P` on Windows/Linux)
2. Type "GenVM: Create New Contract"
3. Enter your contract name (e.g., "TokenContract")
4. A new file will be created with the proper template

#### Option 2: Context Menu
1. Right-click on a folder in the Explorer panel
2. Select "GenVM: Create New Contract"
3. Enter your contract name
4. The file will be created in that folder

### Generated Template:
When you create a new contract named "MyToken", it will generate `my_token.py`:

```python
# { "Depends": "py-genlayer:test" }

from genlayer import *

class MyToken(gl.Contract):
    """MyToken intelligent contract."""
    
    def __init__(self):
        """Initialize the contract."""
        pass
    
    @gl.public.view
    def get_value(self) -> int:
        """Get a value from the contract."""
        return 0
    
    @gl.public.write
    def set_value(self, value: int):
        """Set a value in the contract."""
        pass
```

### Features:
- ✅ Includes required magic comment
- ✅ Imports GenLayer library
- ✅ Has required `__init__` method
- ✅ Includes example `@gl.public.view` method
- ✅ Includes example `@gl.public.write` method
- ✅ Automatically converts PascalCase to snake_case for filename
- ✅ Opens the file and positions cursor for editing

## 3. 📚 Fixed Documentation Links

All hover documentation links have been updated to point to the correct pages:
- Integer types (u8-u256, i8-i256) → `/developers/intelligent-contracts/types/primitive`
- Address type → `/developers/intelligent-contracts/types/address`
- Collection types (TreeMap, DynArray) → `/developers/intelligent-contracts/types/collections`
- Contract interaction (gl.ContractAt) → `/advanced-features/contract-to-contract-interaction`
- Equivalence principles → `/developers/intelligent-contracts/equivalence-principle`

Decorators no longer show documentation links since they don't have dedicated pages.

## Testing

To test the new features:

1. **Test __init__ requirement:**
   - Create a contract without `__init__` - should show ERROR
   - Add `__init__` method - error should disappear

2. **Test contract creation:**
   - Use command palette or context menu
   - Enter a contract name
   - Verify the generated file has all required elements
   - Verify the file passes all linting rules

3. **Test documentation links:**
   - Hover over types like `u256`, `Address`, `TreeMap`
   - Click documentation links to verify they work