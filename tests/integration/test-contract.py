# { "Depends": "py-genlayer:test" }

from genlayer import *
from dataclasses import dataclass

@allow_storage
@dataclass
class UserProfile:
    username: str
    balance: u256
    is_premium: bool

class SocialContract(gl.Contract):
    profiles: TreeMap[Address, UserProfile]
    posts: DynArray[str]
    owner: Address
    total_users: u64

    def __init__(self, owner_address: str):
        self.owner = Address(owner_address)
        self.total_users = 0

    @gl.public.write
    def create_profile(self, username: str, is_premium: bool):
        user_address = gl.message.sender_address
        
        # Check if profile already exists
        if self.profiles.get(user_address) is not None:
            raise gl.Rollback("Profile already exists")
        
        # Create new profile
        profile = UserProfile(
            username=username,
            balance=0,
            is_premium=is_premium
        )
        
        self.profiles[user_address] = profile
        self.total_users += 1

    @gl.public.view
    def get_profile(self, user_address: str) -> dict:
        address = Address(user_address)
        profile = self.profiles.get(address)
        
        if profile:
            return {
                "username": profile.username,
                "balance": profile.balance,
                "is_premium": profile.is_premium
            }
        return {}

    @gl.public.write
    def add_post(self, content: str):
        user_address = gl.message.sender_address
        profile = self.profiles.get(user_address)
        
        if not profile:
            raise gl.Rollback("Profile not found")
        
        self.posts.append(f"{profile.username}: {content}")

    @gl.public.view
    def get_posts_count(self) -> int:
        return len(self.posts)

    @gl.public.view
    def get_total_users(self) -> int:
        return self.total_users

    def _validate_owner(self) -> bool:
        return gl.message.sender_address == self.owner