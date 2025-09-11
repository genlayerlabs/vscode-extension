# { "Depends": "py-genlayer:test" }

from genlayer import *

class TestReturnHints(gl.Contract):
    """Test contract to verify return type hints display correctly."""
    
    def __init__(self):
        pass
    
    @gl.public.view
    def get_value(self):  # Should show: ) -> int
        return 42
    
    @gl.public.write
    def set_value(self, value: int):  # Should show: ) -> None
        """Set a value in the contract."""
        pass
    
    def helper_method(self, x, y):  # Should show: ) -> int
        return x + y
    
    def another_helper(self):  # Should show: ) -> None
        print("Helper")