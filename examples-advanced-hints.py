# { "Depends": "py-genlayer:test" }
"""
Advanced type hints examples showing complex scenarios.
These demonstrate the intelligent type inference capabilities.
"""

from genlayer import gl, Address, u256, i256, TreeMap, DynArray
from typing import Optional, Union, List, Dict, Tuple, Callable
import json

class AdvancedTypeHints(gl.Contract):
    """Advanced type inference scenarios."""
    
    # ============================================================
    # 1. COMPLEX TYPE INFERENCE
    # ============================================================
    
    def complex_type_inference(self):
        """Infers types from complex expressions."""
        
        # Chained operations
        result = self.get_data().process().validate()  # : ValidationResult
        
        # Nested function calls
        final = json.loads(
            gl.nondet.web.get(
                self.build_url("api", "v2")    # : str
            ).body                              # : str
        )                                       # : dict
        
        # List comprehensions
        addresses = [
            Address(f"0x{i:040x}")             # : Address
            for i in range(10)
        ]                                       # : list[Address]
        
        # Dictionary comprehensions  
        balances = {
            addr: u256(1000)                   # : u256
            for addr in addresses               
        }                                       # : dict[Address, u256]
        
        # Generator expressions
        total = sum(
            self.balances[addr]                # : u256
            for addr in self.holders
        )                                       # : u256
        
        # Ternary expressions
        fee = u256(100) if self.is_premium else u256(10)  # : u256
        
        # Walrus operator (Python 3.8+)
        if (balance := self.get_balance()) > 0:  # balance: u256
            return balance
    
    # ============================================================
    # 2. ASYNC AND LAZY EVALUATION HINTS
    # ============================================================
    
    def async_lazy_hints(self):
        """Async operations and lazy evaluation."""
        
        # Lazy evaluation types
        lazy_data = gl.eq_principle.strict_eq(
            lambda: self.fetch_external_data()
        )                                       # : Lazy[dict]
        
        # Getting lazy result
        actual_data = lazy_data.get()          # : dict
        
        # Consensus with multiple validators
        consensus_result = gl.eq_principle.prompt_comparative(
            lambda: self.calculate_price(),    # : Callable[[], float]
            "Price should be within 5% margin"  # : str
        )                                       # : Lazy[float]
        
        # VM execution results
        vm_result = gl.vm.run_nondet(
            lambda: self.risky_operation()
        )                                       # : Result[Any]
        
        # Unpacking results
        try:
            value = gl.vm.unpack_result(vm_result)  # : Any
        except gl.vm.VMError as e:             # e: VMError
            error_msg = str(e)                 # : str
    
    # ============================================================
    # 3. DECORATOR AND ANNOTATION HINTS
    # ============================================================
    
    @gl.public.view
    def decorated_method(                      # Hover shows: "Read-only method"
        self,
        account: Address,                      # : Address (explicit)
        include_pending: bool = False          # : bool (with default)
    ) -> u256:                                # Return type specified
        """Method with full type annotations."""
        
        # Local variable with annotation
        balance: u256 = self.balances[account] # : u256 (explicit)
        
        # Type narrowing
        optional_value: Optional[u256] = None
        if include_pending:
            optional_value = self.pending[account]  # : u256 (narrowed)
        
        return balance + (optional_value or u256(0))
    
    @gl.public.write.payable                   # Hover: "Payable write method"
    def payable_method(self) -> None:
        """Shows gas cost and payable info on hover."""
        
        value = gl.message.value               # : u256
        sender = gl.message.sender             # : Address
        
        # Storage modification hints
        self.balances[sender] += value         # Hover: "Storage write: ~20000 gas"
    
    # ============================================================
    # 4. GENERIC AND UNION TYPE HINTS
    # ============================================================
    
    def generic_union_hints(self):
        """Complex generic and union types."""
        
        # Union types
        mixed: Union[int, str] = 42            # : int | str
        mixed = "text"                         # : int | str (maintains union)
        
        # Optional (Union with None)
        maybe_addr: Optional[Address] = None   # : Address | None
        maybe_addr = Address("0x1...")         # : Address | None
        
        # Generic containers
        queue: List[Tuple[Address, u256]] = [] # : list[tuple[Address, u256]]
        
        # Nested generics
        registry: Dict[str, List[Address]] = {
            "admins": [],                      # : list[Address]
            "users": []                         # : list[Address]
        }                                       # : dict[str, list[Address]]
        
        # Callable types
        processor: Callable[[int], str]        # : (int) -> str
        processor = lambda x: str(x * 2)       # : (x: int) -> str
        
        # Type aliases (if supported)
        Balance = u256                         
        account_balance: Balance = Balance(1000)  # : u256
    
    # ============================================================
    # 5. CLASS AND INSTANCE HINTS
    # ============================================================
    
    def class_instance_hints(self):
        """Class instantiation and instance method hints."""
        
        # Contract instantiation
        contract = gl.ContractAt(              # Hover: "Create contract proxy"
            Address("0x123...")                # : Address
        )                                       # : ContractProxy
        
        # Accessing contract methods
        view_proxy = contract.view(            # Hover: "Get view methods"
            state='latest'                      # state: StorageType
        )                                       # : ViewProxy
        
        # Calling view methods
        balance = view_proxy.balanceOf(        # Hover: "balanceOf(address) -> u256"
            gl.message.sender                  # : Address
        )                                       # : u256
        
        # Emit proxy for transactions
        emit_proxy = contract.emit(            # Hover: "Get write methods"
            value=u256(100),                   # value: u256
            on='finalized'                     # on: str
        )                                       # : EmitProxy
        
        # Custom class instances
        class Token:
            def __init__(self, supply: u256):
                self.supply = supply            # : u256
        
        token = Token(u256(1_000_000))         # : Token
        token_supply = token.supply            # : u256
    
    # ============================================================
    # 6. CONTROL FLOW TYPE NARROWING
    # ============================================================
    
    def type_narrowing(self, value: Union[int, str, None]):
        """Type narrowing in control flow."""
        
        # Initial type
        # value: int | str | None
        
        if value is None:
            # value: None (narrowed)
            return u256(0)
        
        # value: int | str (None eliminated)
        
        if isinstance(value, int):
            # value: int (narrowed)
            result = u256(value)               # : u256
        elif isinstance(value, str):
            # value: str (narrowed)
            result = u256(int(value))          # : u256
        
        # After checks
        return result                          # : u256
    
    # ============================================================
    # 7. SPECIAL GENVM HINTS
    # ============================================================
    
    def genvm_specific_hints(self):
        """GenVM-specific type hints."""
        
        # Message context
        msg_sender = gl.message.sender         # : Address
        msg_value = gl.message.value           # : u256
        msg_data = gl.message.data             # : bytes
        chain_id = gl.message.chain_id         # : int
        
        # Storage operations
        storage_root = gl.storage.Root()       # : StorageRoot
        
        # Advanced operations
        user_error = gl.advanced.user_error_immediate(
            "Custom error"                      # message: str
        )                                       # : Never (throws)
        
        # EVM compatibility
        encoder = gl.evm.MethodEncoder(
            "transfer",                        # name: str
            (Address, u256),                   # params: tuple
            None                                # returns: type
        )                                       # : MethodEncoder
        
        # Encode call
        calldata = encoder.encode_call(
            (Address("0x1..."), u256(100))    # args: tuple
        )                                       # : bytes
        
        # Contract deployment
        new_addr = gl.deploy_contract(
            code=b"bytecode",                  # : bytes
            args=[],                            # : list
            salt_nonce=u256(42)                # : u256
        )                                       # : Address | None
    
    # ============================================================
    # 8. COLLECTION OPERATION HINTS
    # ============================================================
    
    def collection_hints(self):
        """Collection-specific type hints."""
        
        # TreeMap operations
        tree_map = TreeMap[Address, u256]()    # : TreeMap[Address, u256]
        
        # Get with default
        balance = tree_map.get(
            Address("0x1..."),                 # key: Address
            u256(0)                            # default: u256
        )                                       # : u256
        
        # Keys and values
        all_keys = tree_map.keys()             # : KeysView[Address]
        all_values = tree_map.values()         # : ValuesView[u256]
        all_items = tree_map.items()           # : ItemsView[Address, u256]
        
        # DynArray operations
        dyn_array = DynArray[Address]()        # : DynArray[Address]
        
        # Append and extend
        dyn_array.append(Address("0x1..."))    # item: Address
        dyn_array.extend([                     # items: list[Address]
            Address("0x2..."),
            Address("0x3...")
        ])
        
        # Indexing and slicing
        first = dyn_array[0]                   # : Address
        subset = dyn_array[1:3]                # : list[Address]
        
        # Length and contains
        length = len(dyn_array)                # : int
        exists = Address("0x1...") in dyn_array  # : bool

# ============================================================
# VISUAL HINT EXAMPLES
# ============================================================
"""
Here's what the hints look like visually in VS Code:

1. Variable Type Hints (gray, after =):
   balance = u256(1000)│: u256│

2. Parameter Hints (gray, in calls):
   transfer(│to:│addr, │amount:│value)

3. Return Type Hints (gray, after def):
   def calculate()│-> int│:

4. Storage Hints (gray comment):
   total: u256  # stored as: uint256

5. Hover Information (tooltip on hover):
   ┌──────────────────────────┐
   │ u256                     │
   │ Unsigned 256-bit integer │
   │ Example: u256(10**18)    │
   │ Gas: Storage 20000       │
   │ 📖 Documentation         │
   └──────────────────────────┘

6. Error Squiggles with hints:
   value: u256 = 100
   ~~~~~~~~~~~~  ^^^
   Type error: Expected u256, got int
   💡 Quick Fix: Convert to u256(100)

7. Code Lens (above functions):
   │ 3 references | Run Test │
   def test_function():

8. Semantic Highlighting (different colors):
   self.balance  # 'self' in italic
   u256(100)     # 'u256' in special color
   @gl.public    # decorator in different color
"""