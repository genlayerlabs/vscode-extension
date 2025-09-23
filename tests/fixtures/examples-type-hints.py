# { "Depends": "py-genlayer:test" }
"""
Comprehensive examples of all type hints provided by GenVM Linter.
Each section demonstrates different kinds of inline hints you'll see.
"""

from genlayer import gl, Address, u8, u16, u32, u64, u128, u256, i128, TreeMap, DynArray

class TypeHintsShowcase(gl.Contract):
    """
    Complete showcase of all type hints the extension provides.
    Enable inlay hints in VS Code settings to see them all.
    """
    
    # ============================================================
    # 1. VARIABLE TYPE HINTS (shown inline after =)
    # ============================================================
    
    def variable_type_hints(self):
        """Variables without explicit types show inferred types."""
        
        # Basic type inference
        counter = 0                          # : int
        name = "Alice"                       # : str
        is_active = True                     # : bool
        ratio = 0.75                        # : float
        nothing = None                       # : None
        
        # GenVM specific types
        small_num = u8(255)                  # : u8
        medium_num = u64(1000000)            # : u64
        big_num = u256(10**18)               # : u256
        signed_num = i128(-500)              # : i128
        
        # Address types
        wallet = Address("0x742d35...")      # : Address
        zero_addr = Address(b'\x00' * 20)    # : Address
        
        # Contract instances
        contract = gl.ContractAt(wallet)     # : ContractProxy
        view_proxy = contract.view()         # : ViewProxy
        emit_proxy = contract.emit()         # : EmitProxy
        
        # Collections
        numbers = [1, 2, 3]                  # : list
        mapping = {"key": "value"}           # : dict
        unique = {1, 2, 3}                   # : set
        pair = (100, 200)                    # : tuple
        
        # GenVM collections
        balances = TreeMap[Address, u256]()  # : TreeMap
        owners = DynArray[Address]()         # : DynArray
        
        # Complex expressions
        balance = contract.balance           # : u256
        sender = gl.message.sender           # : Address
        block_num = gl.message.block_number  # : int
        
        # Lambda and function results
        getter = lambda x: x * 2             # : function
        result = self.calculate_fee(100)     # : u256
        
        # Lazy evaluation
        consensus = gl.eq_principle.strict_eq(
            lambda: self.fetch_data()        # : Lazy[dict]
        )
    
    # ============================================================
    # 2. PARAMETER NAME HINTS (shown in function calls)
    # ============================================================
    
    def parameter_hints_examples(self):
        """Parameter names appear inline when calling functions."""
        
        # GenVM API calls with parameter hints
        gl.nondet.web.get(
            "https://api.example.com"         # url:
        )
        
        gl.nondet.web.post(
            "https://api.example.com",        # url:
            {"data": "value"},                # body:
            {"Authorization": "Bearer xyz"}   # headers:
        )
        
        gl.nondet.exec_prompt(
            "Analyze this data",              # prompt:
            "json",                           # response_format:
            None                              # images:
        )
        
        gl.deploy_contract(
            b"contract_code",                 # code:
            [100, "param"],                   # args:
            {"name": "Test"},                 # kwargs:
            u256(12345),                      # salt_nonce:
            u256(0)                           # value:
        )
        
        # Contract method calls
        self.transfer(
            Address("0x123..."),              # to:
            u256(1000),                       # amount:
            True                              # check_balance:
        )
        
        # Method chaining with hints
        contract.emit(
            u256(100),                        # value:
            'finalized'                       # on:
        ).send_message(
            42,                               # chain_id:
            Address("0x456..."),              # address:
            b"message_data"                   # message:
        )
        
        # TreeMap and DynArray operations
        self.balances.get(
            Address("0x789..."),              # key:
            u256(0)                           # default:
        )
        
        self.owners.append(
            Address("0xabc...")               # value:
        )
    
    # ============================================================
    # 3. RETURN TYPE HINTS (shown after function definitions)
    # ============================================================
    
    def no_return_annotation(self):          # -> None
        """Functions without return type show inferred type."""
        pass
    
    def returns_simple_type(self):           # -> int
        """Infers return type from return statement."""
        return 42
    
    def returns_genvm_type(self):            # -> u256
        """Infers GenVM types."""
        return self.total_supply
    
    def returns_address(self):               # -> Address
        """Infers Address return."""
        return gl.message.sender
    
    def returns_collection(self):            # -> list[str]
        """Infers collection types."""
        return ["item1", "item2"]
    
    def returns_contract_proxy(self):        # -> ContractProxy
        """Infers contract proxy returns."""
        return gl.ContractAt(self.target)
    
    def conditional_return(self, flag):      # -> int | None
        """Infers union types for conditional returns."""
        if flag:
            return 100
        return None
    
    # ============================================================
    # 4. STORAGE FIELD TYPE HINTS (shown on class attributes)
    # ============================================================
    
class StorageHintsExample(gl.Contract):
    """Storage fields show their actual storage representation."""
    
    # Basic storage with hints
    owner: Address                           # stored as: address(20 bytes)
    total_supply: u256                       # stored as: uint256
    is_paused: bool                          # stored as: bool(1 byte)
    
    # Sized integers show storage size
    small_counter: u8                        # stored as: uint8
    medium_counter: u64                      # stored as: uint64
    large_counter: u256                      # stored as: uint256
    
    # Collections show storage type
    balances: TreeMap[Address, u256]         # stored as: mapping
    holders: DynArray[Address]               # stored as: dynamic array
    
    # Nested types
    approvals: TreeMap[Address, TreeMap[Address, u256]]  # stored as: nested mapping
    
    # ============================================================
    # 5. LAMBDA AND CLOSURE TYPE HINTS
    # ============================================================
    
    def lambda_type_hints(self):
        """Lambda expressions and closures show parameter types."""
        
        # Simple lambdas
        doubler = lambda x: x * 2            # x: Any -> Any
        adder = lambda a, b: a + b           # a: Any, b: Any -> Any
        
        # Typed lambdas in API calls
        result = gl.eq_principle.strict_eq(
            lambda: self.get_price()         # () -> u256
        )
        
        # Map/filter operations
        numbers = [1, 2, 3]
        doubled = map(lambda n: n * 2, numbers)  # n: int -> int
        filtered = filter(lambda n: n > 1, numbers)  # n: int -> bool
        
        # Callback functions
        def process_data(callback):          # callback: Callable
            return callback(100)
        
        result = process_data(
            lambda value: value * 2          # value: Any -> Any
        )
    
    # ============================================================
    # 6. GENERIC TYPE HINTS
    # ============================================================
    
    def generic_type_hints(self):
        """Generic types show their type parameters."""
        
        # Generic collections
        addresses: list[Address] = []        # : list[Address]
        scores: dict[str, int] = {}          # : dict[str, int]
        pairs: list[tuple[str, u256]] = []   # : list[tuple[str, u256]]
        
        # Optional types
        maybe_address = None                 # : None
        maybe_address = Address("0x1...")    # : Address
        
        # Union types (when detected)
        value = 100 if True else "text"      # : int | str
        
        # GenVM generics
        lazy_result = gl.eq_principle.strict_eq(
            lambda: {"data": 123}            # : Lazy[dict]
        )
        
        vm_result = gl.vm.run_nondet(
            lambda: self.compute()           # : Result[T]
        )
    
    # ============================================================
    # 7. CONTEXT-AWARE TYPE HINTS
    # ============================================================
    
    def context_aware_hints(self):
        """Hints change based on context."""
        
        # Method chaining shows appropriate hints
        contract = gl.ContractAt(self.addr)  # : ContractProxy
        
        # After .view(), shows view methods available
        view = contract.view()                # : ViewProxy
        balance = view.get_balance()         # : u256
        
        # After .emit(), shows write methods available
        emit = contract.emit()                # : EmitProxy
        emit.transfer(addr, amount)          # returns: None
        
        # Context from imports
        from datetime import datetime
        now = datetime.now()                 # : datetime
        timestamp = now.timestamp()          # : float
    
    # ============================================================
    # 8. SPECIAL HOVER HINTS (not inline, but on hover)
    # ============================================================
    
    @gl.public.view
    def hover_information_examples(self):
        """Hover over any item for detailed information."""
        
        # Hover over these for rich information:
        
        # Type information with examples
        balance: u256  # Hover: "Unsigned 256-bit integer, Example: u256(10**18)"
        
        # Gas cost information
        storage_var = self.total_supply  # Hover: "Reading: 2100 gas"
        
        # Security warnings
        eval("code")  # Hover: "⚠️ Security: Avoid eval with user input"
        
        # Method signatures
        self.transfer(addr, amount)  # Hover: "transfer(to: Address, amount: u256) -> None"
        
        # Decorator information
        @gl.public.write  # Hover: "State-modifying method, Gas: 21000 base"
        def some_method(self): pass
        
        # API documentation links
        gl.eq_principle  # Hover: "Consensus mechanism [📖 Docs]"
    
    # ============================================================
    # 9. ERROR SQUIGGLE HINTS
    # ============================================================
    
    def error_hints(self):
        """Errors show inline hints for fixes."""
        
        # Type mismatch hint
        value: u256 = 100  # Error: "Expected u256, got int" + hint: "Use u256(100)"
        
        # Missing import hint
        # undefined_var  # Error: "undefined_var not defined" + hint: "Import from genlayer"
        
        # Missing decorator hint
        # public_method without decorator  # Warning + hint: "Add @gl.public.view"
        
        # Return type mismatch
        def get_number(self) -> str:
            return 123  # Error: "Expected str, returning int"

# ============================================================
# CONFIGURATION FOR BEST EXPERIENCE
# ============================================================
"""
Add to VS Code settings.json for all hints:

{
    "editor.inlayHints.enabled": true,
    "editor.inlayHints.fontSize": 12,
    "editor.inlayHints.fontFamily": "Consolas, 'Courier New', monospace",
    "editor.inlayHints.padding": true,
    
    "editor.parameterHints.enabled": true,
    "editor.parameterHints.cycle": true,
    
    "python.analysis.inlayHints.functionReturnTypes": true,
    "python.analysis.inlayHints.variableTypes": true,
    "python.analysis.inlayHints.callArgumentNames": true,
    
    "editor.hover.enabled": true,
    "editor.hover.delay": 300,
    "editor.hover.sticky": true
}

KEYBOARD SHORTCUTS:
- Toggle inlay hints: Ctrl+Alt+Shift+H
- Show hover: Ctrl+K Ctrl+I
- Show parameter hints: Ctrl+Shift+Space
- Trigger suggestions: Ctrl+Space
"""