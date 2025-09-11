# { "Depends": "py-genlayer:test" }
"""
Test file for all GenVM Linter advanced features.
Use this file to test the new capabilities.
"""

from genlayer import gl, Address, u256, TreeMap, DynArray

# ============================================================
# TEST 1: CODE ACTIONS (Quick Fixes)
# ============================================================

class TestCodeActions(gl.Contract):
    """Test quick fixes and refactoring."""
    
    # Issue: Missing decorator - hover over method name and press Ctrl+. (Cmd+. on Mac)
    # Quick Fix: "Add @gl.public.view decorator"
    def get_balance(self, account: Address) -> u256:
        return self.balances[account]
    
    # Issue: int to sized type conversion
    # Quick Fix: "Convert to sized type"
    def set_value(self):
        self.value = 100  # Should suggest wrapping with u256()
    
    # Issue: Write method returning value
    # Quick Fix: "Remove return statement"
    @gl.public.write
    def update_balance(self, account: Address, amount: int):
        self.balances[account] = u256(amount)
        return True  # Should suggest removing this
    
    # TEST: Extract Method Refactoring
    # Select lines 34-36 and press Ctrl+. to extract method
    @gl.public.write
    def complex_operation(self, data: str):
        # Select these lines and refactor -> Extract Method
        processed = data.upper()
        hashed = hash(processed)
        result = str(hashed)
        
        self.store_result(result)

# ============================================================
# TEST 2: INLAY HINTS (Type Hints)
# ============================================================

class TestInlayHints(gl.Contract):
    """Test inline type hints."""
    
    # Storage fields - should show actual storage type
    balances: TreeMap[Address, u256]  # Should show: # stored as: mapping
    owners: DynArray[Address]  # Should show: # stored as: dynamic array
    
    def test_variable_hints(self):
        # Variables without type annotations should show inferred types
        balance = u256(1000)  # Should show: : u256
        address = Address("0x123...")  # Should show: : Address
        contract = gl.ContractAt(address)  # Should show: : ContractProxy
        
        # Function calls should show parameter names
        self.transfer(address, balance)  # Should show param names inline
        gl.nondet.web.get("https://api.example.com")  # Should show: url:
    
    # Method without return type should show hint
    def calculate_fee(self, amount: int):  # Should show: -> int
        return amount * 10 // 100

# ============================================================
# TEST 3: GO TO DEFINITION (F12 or Ctrl+Click)
# ============================================================

class BaseContract(gl.Contract):
    """Base contract for testing navigation."""
    
    def base_method(self) -> str:
        return "base"

class TestDefinition(BaseContract):
    """Test go-to-definition navigation."""
    
    other_contract: Address
    
    def __init__(self):
        self.other_contract = Address("0x456...")
    
    @gl.public.view
    def test_navigation(self):
        # Ctrl+Click on these to navigate:
        
        # 1. Navigate to base class method
        result = self.base_method()  # F12 on base_method
        
        # 2. Navigate to variable definition
        contract_addr = self.other_contract  # F12 on other_contract
        
        # 3. Navigate to imported class
        new_address = Address("0x789...")  # F12 on Address
        
        # 4. Navigate to contract definition
        proxy = gl.ContractAt(contract_addr)  # F12 on ContractAt
        
        return result

# ============================================================
# TEST 4: HOVER INFORMATION
# ============================================================

class TestHover(gl.Contract):
    """Test enhanced hover information."""
    
    # Hover over these items to see rich information:
    
    balance: u256  # Hover to see type description and examples
    accounts: TreeMap[Address, u256]  # Hover to see gas costs
    
    @gl.public.view  # Hover to see decorator documentation
    def get_total_supply(self) -> u256:
        """
        Get the total supply of tokens.
        Hover over function name to see full signature and docs.
        """
        return self.total_supply
    
    @gl.public.write  # Hover to see gas cost warning
    def transfer(self, to: Address, amount: u256):
        # Hover over 'transfer' to see security warnings
        sender = gl.message.sender  # Hover over 'sender' for context info
        
        # Hover over strict_eq to see consensus documentation
        result = gl.eq_principle.strict_eq(
            lambda: self._do_transfer(sender, to, amount)
        )
        
        return result
    
    def _do_transfer(self, from_addr: Address, to_addr: Address, amount: u256):
        # Private helper method
        self.accounts[from_addr] -= amount
        self.accounts[to_addr] += amount

# ============================================================
# TEST 5: ERROR SQUIGGLES WITH QUICK FIXES
# ============================================================

class TestErrors(gl.Contract):
    """Test error detection and quick fixes."""
    
    # Missing import - should show error with quick fix
    # def test_missing_import(self):
    #     result = SomeUndefinedClass()  # Quick fix: Add import
    
    # Type mismatch - should show error with conversion fix
    def test_type_mismatch(self):
        value: u256 = 42  # Should suggest u256(42)
        return value
    
    # Missing decorator on public method
    def public_method_without_decorator(self):  # Should show warning
        return "This needs a decorator"

# ============================================================
# HOW TO TEST EACH FEATURE:
# ============================================================
"""
1. CODE ACTIONS (Quick Fixes):
   - Look for error squiggles (red/yellow underlines)
   - Place cursor on the error
   - Press Ctrl+. (Windows/Linux) or Cmd+. (Mac)
   - Select a quick fix from the menu

2. INLAY HINTS:
   - Enable in settings: "editor.inlayHints.enabled": true
   - Look for grayed-out type hints inline with your code
   - Should appear for variables, parameters, and return types

3. GO TO DEFINITION:
   - Hold Ctrl (Cmd on Mac) and click on any symbol
   - Or press F12 with cursor on a symbol
   - Should navigate to where it's defined

4. HOVER INFORMATION:
   - Hover mouse over any symbol, type, or method
   - Should show rich tooltip with documentation
   - Includes types, examples, gas costs, and links

5. REFACTORING:
   - Select a block of code
   - Press Ctrl+. for refactoring options
   - Choose "Extract Method" or "Extract Variable"

6. PARAMETER HINTS:
   - Type a function call like gl.nondet.web.get(
   - Should show parameter hints as you type

7. ERROR DIAGNOSTICS:
   - Type errors show as red squiggles
   - Warnings show as yellow squiggles
   - Each has associated quick fixes

SETTINGS TO ENABLE:
Add to your VSCode settings.json:
{
    "editor.inlayHints.enabled": true,
    "editor.parameterHints.enabled": true,
    "editor.hover.enabled": true,
    "editor.hover.delay": 300,
    "editor.quickSuggestions": {
        "other": true,
        "comments": false,
        "strings": false
    }
}
"""