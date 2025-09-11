# { "Depends": "py-genlayer:test" }

from genlayer import *

class TestContract(gl.Contract):
    """Test contract without __init__ method to verify ERROR severity."""
    
    @gl.public.view
    def get_value(self) -> int:
        return 42