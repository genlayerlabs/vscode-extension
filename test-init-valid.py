# { "Depends": "py-genlayer:test" }

from genlayer import *

class ValidContract(gl.Contract):
    """Test contract with __init__ method."""
    
    def __init__(self):
        pass
    
    @gl.public.view
    def get_value(self) -> int:
        return 42