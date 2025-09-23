#!/usr/bin/env python3
"""Test script to verify VS Code extension can find and run the linter."""

import subprocess
import sys
import os

def test_python_path():
    """Test Python interpreter"""
    print("=== Python Path Test ===")
    print(f"Python executable: {sys.executable}")
    print(f"Python version: {sys.version}")
    print(f"Python PATH: {sys.path}")
    
def test_genvm_linter():
    """Test GenVM linter availability"""
    print("\n=== GenVM Linter Test ===")
    try:
        result = subprocess.run([
            sys.executable, '-m', 'genvm_linter.cli', '--help'
        ], capture_output=True, text=True, timeout=10)
        
        print(f"Exit code: {result.returncode}")
        if result.returncode == 0:
            print("✅ GenVM linter is available")
            print("First few lines of help:")
            print('\n'.join(result.stdout.split('\n')[:5]))
        else:
            print("❌ GenVM linter failed")
            print(f"stderr: {result.stderr}")
    except Exception as e:
        print(f"❌ Error running genvm linter: {e}")

def test_file_linting():
    """Test linting a file"""
    print("\n=== File Linting Test ===")
    
    # Create a test file
    test_content = '''# { "Depends": "py-genlayer:test" }

from genlayer import *

class TestContract(gl.Contract):
    def __init__(self):
        pass

    @gl.public.write
    def bad_method(self) -> u64:  # This should cause an error
        return 42
'''
    
    test_file = 'temp_test.py'
    try:
        with open(test_file, 'w') as f:
            f.write(test_content)
        
        print(f"Created test file: {test_file}")
        
        # Run linter on test file
        result = subprocess.run([
            sys.executable, '-m', 'genvm_linter.cli', test_file, '--format', 'json'
        ], capture_output=True, text=True, timeout=10)
        
        print(f"Linter exit code: {result.returncode}")
        if result.stdout.strip():
            print("Linter output (JSON):")
            print(result.stdout[:500] + "..." if len(result.stdout) > 500 else result.stdout)
        
        if result.stderr:
            print(f"Linter stderr: {result.stderr}")
            
    except Exception as e:
        print(f"❌ Error in file linting test: {e}")
    finally:
        # Clean up
        if os.path.exists(test_file):
            os.remove(test_file)
            print(f"Cleaned up {test_file}")

if __name__ == "__main__":
    test_python_path()
    test_genvm_linter()
    test_file_linting()