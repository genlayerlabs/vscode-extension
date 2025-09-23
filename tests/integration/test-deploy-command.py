# { "Depends": "py-genlayer:test" }

from genlayer import *

class DeployTestContract(gl.Contract):
    """Test contract for deployment feature."""

    balance: u256
    owner: Address

    def __init__(self):
        """Initialize the contract."""
        self.balance = 0
        self.owner = gl.message.sender_address

    @gl.public.view
    def get_balance(self) -> int:
        """Get the current balance."""
        return self.balance

    @gl.public.write
    def deposit(self, amount: int):
        """Deposit funds to the contract."""
        self.balance += amount