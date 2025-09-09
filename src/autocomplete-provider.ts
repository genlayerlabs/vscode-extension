import * as vscode from 'vscode';

export class GenVMCompletionProvider implements vscode.CompletionItemProvider {
    
    // Method signature information for generating snippets
    private readonly methodSignatures: Record<string, { params: string, snippet: string }> = {
        // gl root methods
        'ContractAt': { params: '(address)', snippet: '(${1:address})' },
        
        // gl.eq_principle methods
        'strict_eq': { params: '(fn)', snippet: '(${1:fn})' },
        'prompt_comparative': { params: '(fn, principle)', snippet: '(${1:fn}, "${2:principle}")' },
        'prompt_non_comparative': { params: '(fn, task, criteria)', snippet: '(${1:fn}, task="${2:task}", criteria="${3:criteria}")' },
        
        // gl.nondet methods
        'exec_prompt': { params: '(prompt)', snippet: '("${1:prompt}")' },
        
        // gl.nondet.web methods
        'render': { params: '(url)', snippet: '("${1:url}")' },
        'request': { params: '(url, method)', snippet: '("${1:url}", method="${2:GET}")' },
        'get': { params: '(url)', snippet: '("${1:url}")' },
        'post': { params: '(url, body)', snippet: '("${1:url}", body=${2:data})' },
        'delete': { params: '(url)', snippet: '("${1:url}")' },
        'head': { params: '(url)', snippet: '("${1:url}")' },
        'patch': { params: '(url, body)', snippet: '("${1:url}", body=${2:data})' },
        
        // gl methods
        'trace': { params: '(*args)', snippet: '(${1:value})' },
        'trace_time_micro': { params: '()', snippet: '()' },
        'deploy_contract': { params: '(contract_cls, *args)', snippet: '(${1:ContractClass})' },
        'get_contract_at': { params: '(contract_cls, address)', snippet: '(${1:ContractClass}, ${2:address})' },
        
        // gl.storage methods
        'inmem_allocate': { params: '(type)', snippet: '(${1:type})' },
        'copy_to_memory': { params: '(data)', snippet: '(${1:data})' },
        
        // gl.advanced methods
        'user_error_immediate': { params: '(message)', snippet: '("${1:error message}")' },
        
        // gl.vm methods
        'spawn_sandbox': { params: '(fn)', snippet: '(${1:fn})' },
        'run_nondet': { params: '(fn)', snippet: '(${1:fn})' },
        'run_nondet_unsafe': { params: '(fn)', snippet: '(${1:fn})' },
        'unpack_result': { params: '(result)', snippet: '(${1:result})' },
        
        // gl.evm methods
        'contract_interface': { params: '(address)', snippet: '(${1:address})' },
        'encode': { params: '(data)', snippet: '(${1:data})' },
        'decode': { params: '(data)', snippet: '(${1:data})' },
        'selector_of': { params: '(name, params)', snippet: '("${1:name}", ${2:params})' },
        'signature_of': { params: '(name, params)', snippet: '("${1:name}", ${2:params})' },
        'type_name_of': { params: '(type)', snippet: '(${1:type})' },
        
        // gl.public methods (decorators, not called)
        'payable': { params: '', snippet: '' },
        'min_gas': { params: '(leader, validator)', snippet: '(${1:100000}, ${2:50000})' },
        
        // Contract instance methods (from ContractAt)
        'emit': { params: '(value?, on?)', snippet: '()' },
        'view': { params: '(state?)', snippet: '()' },
        'emit_transfer': { params: '(value, on?)', snippet: '(value=${1:amount})' },
        
        // Common emit() methods
        'send_message': { params: '(chain_id, address, message)', snippet: '(${1:chain_id}, ${2:address}, ${3:message})' },
        'transfer': { params: '(to, amount)', snippet: '(${1:to}, ${2:amount})' },
        'mint': { params: '(to, amount)', snippet: '(${1:to}, ${2:amount})' },
        'update_storage': { params: '(data)', snippet: '(${1:data})' },
        
        // Common view() methods
        'get_balance_of': { params: '(address)', snippet: '(${1:address})' },
        'balance_of': { params: '(address)', snippet: '(${1:address})' },
        'total_supply': { params: '()', snippet: '()' }
    };

    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        
        const line = document.lineAt(position.line).text;
        const linePrefix = line.substring(0, position.character);
        
        // Always return completions using raw string matching
        const items: vscode.CompletionItem[] = [];
        
        // Case 1: gl. completions - use regex to match patterns
        if (linePrefix.match(/gl\.$/)) {
            // Root gl. completions
            items.push(...this.createGlRootCompletions());
        } else if (linePrefix.match(/gl\.eq_principle\.$/)) {
            // gl.eq_principle. completions
            items.push(...this.createEqPrincipleCompletions());
        } else if (linePrefix.match(/gl\.nondet\.$/)) {
            // gl.nondet. completions
            items.push(...this.createNondetCompletions());
        } else if (linePrefix.match(/gl\.nondet\.web\.$/)) {
            // gl.nondet.web. completions
            items.push(...this.createWebCompletions());
        } else if (linePrefix.match(/gl\.message\.$/)) {
            // gl.message. completions  
            items.push(...this.createMessageCompletions());
        } else if (linePrefix.match(/gl\.storage\.$/)) {
            // gl.storage. completions
            items.push(...this.createStorageCompletions());
        } else if (linePrefix.match(/gl\.vm\.$/)) {
            // gl.vm. completions
            items.push(...this.createVmCompletions());
        } else if (linePrefix.match(/gl\.advanced\.$/)) {
            // gl.advanced. completions
            items.push(...this.createAdvancedCompletions());
        } else if (linePrefix.match(/gl\.evm\.$/)) {
            // gl.evm. completions
            items.push(...this.createEvmCompletions());
        } else if (linePrefix.match(/gl\.public\.$/)) {
            // gl.public. completions
            items.push(...this.createPublicCompletions());
        } else if (linePrefix.match(/gl\.public\.write\.$/)) {
            // gl.public.write. completions
            items.push(...this.createPublicWriteCompletions());
        }
        
        // Case 2: Address constructor
        if (linePrefix.match(/\bAddress$/)) {
            const item = new vscode.CompletionItem('Address()', vscode.CompletionItemKind.Constructor);
            item.insertText = new vscode.SnippetString('Address("${1:0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6}")');
            item.detail = 'Address constructor';
            items.push(item);
        }
        
        // Case 3: Contract instance completions
        // Check if we're after .emit().
        if (linePrefix.match(/\.emit\(.*?\)\.$/)) {
            items.push(...this.createEmitMethodCompletions());
        }
        // Check if we're after .view().
        else if (linePrefix.match(/\.view\(.*?\)\.$/)) {
            items.push(...this.createViewMethodCompletions());
        }
        // Check if variable might be a contract instance
        else if (linePrefix.match(/(\w+)\.$/) && this.mightBeContractInstance(document, position, linePrefix)) {
            items.push(...this.createContractInstanceCompletions());
        }
        
        // Case 4: Other variable completions (simple heuristic)
        const varMatch = linePrefix.match(/(\w+)\.$/);
        if (varMatch) {
            const varName = varMatch[1];
            if (varName.includes('addr') || varName.includes('address')) {
                items.push(...this.createAddressMethodCompletions());
            } else if (varName.includes('response')) {
                items.push(...this.createResponseCompletions());
            }
        }
        
        return new vscode.CompletionList(items, false);
    }

    private createGlRootCompletions(): vscode.CompletionItem[] {
        const items = [];
        
        // Modules
        items.push(this.createCompletion('eq_principle', vscode.CompletionItemKind.Module, 'Equivalence principle module'));
        items.push(this.createCompletion('nondet', vscode.CompletionItemKind.Module, 'Non-deterministic operations module'));
        items.push(this.createCompletion('message', vscode.CompletionItemKind.Module, 'Message context module'));
        items.push(this.createCompletion('storage', vscode.CompletionItemKind.Module, 'Storage operations module'));
        items.push(this.createCompletion('vm', vscode.CompletionItemKind.Module, 'Virtual machine operations module'));
        items.push(this.createCompletion('advanced', vscode.CompletionItemKind.Module, 'Advanced operations module'));
        items.push(this.createCompletion('evm', vscode.CompletionItemKind.Module, 'EVM compatibility module'));
        items.push(this.createCompletion('public', vscode.CompletionItemKind.Module, 'Public method decorators'));
        
        // Classes
        items.push(this.createCompletion('Contract', vscode.CompletionItemKind.Class, 'Base contract class'));
        items.push(this.createMethodCompletion('ContractAt', 'Contract proxy at address'));
        items.push(this.createCompletion('Event', vscode.CompletionItemKind.Class, 'Event definition class'));
        
        // Root methods - use createMethodCompletion for functions
        items.push(this.createMethodCompletion('trace', 'Debug tracing output'));
        items.push(this.createMethodCompletion('trace_time_micro', 'Get runtime in microseconds'));
        items.push(this.createMethodCompletion('deploy_contract', 'Deploy a new GenVM contract'));
        items.push(this.createMethodCompletion('get_contract_at', 'Get contract proxy at address'));
        items.push(this.createMethodCompletion('contract_interface', 'Contract interface decorator'));
        
        return items;
    }

    private createEqPrincipleCompletions(): vscode.CompletionItem[] {
        return [
            this.createMethodCompletion('strict_eq', 'Strict equality equivalence principle'),
            this.createMethodCompletion('prompt_comparative', 'Comparative equivalence principle using NLP'),
            this.createMethodCompletion('prompt_non_comparative', 'Non-comparative equivalence principle')
        ];
    }

    private createNondetCompletions(): vscode.CompletionItem[] {
        return [
            this.createCompletion('web', vscode.CompletionItemKind.Module, 'Web operations module'),
            this.createMethodCompletion('exec_prompt', 'Execute an AI prompt')
        ];
    }

    private createWebCompletions(): vscode.CompletionItem[] {
        return [
            this.createMethodCompletion('render', 'Render a webpage'),
            this.createMethodCompletion('request', 'Make an HTTP request with specified method'),
            this.createMethodCompletion('get', 'Make a GET request'),
            this.createMethodCompletion('post', 'Make a POST request'),
            this.createMethodCompletion('delete', 'Make a DELETE request'),
            this.createMethodCompletion('head', 'Make a HEAD request'),
            this.createMethodCompletion('patch', 'Make a PATCH request')
        ];
    }

    private createMessageCompletions(): vscode.CompletionItem[] {
        return [
            this.createCompletion('sender', vscode.CompletionItemKind.Property, 'Address of message sender (alias for sender_address)'),
            this.createCompletion('sender_address', vscode.CompletionItemKind.Property, 'Address of message sender'),
            this.createCompletion('contract_address', vscode.CompletionItemKind.Property, 'Address of current contract'),
            this.createCompletion('value', vscode.CompletionItemKind.Property, 'Value sent with message'),
            this.createCompletion('chain_id', vscode.CompletionItemKind.Property, 'Current chain ID'),
            this.createCompletion('data', vscode.CompletionItemKind.Property, 'Message call data')
        ];
    }

    private createStorageCompletions(): vscode.CompletionItem[] {
        return [
            this.createMethodCompletion('inmem_allocate', 'Allocate storage type in memory'),
            this.createMethodCompletion('copy_to_memory', 'Copy data to memory'),
            this.createCompletion('Root', vscode.CompletionItemKind.Class, 'Storage root class')
        ];
    }

    private createAddressMethodCompletions(): vscode.CompletionItem[] {
        return [
            this.createCompletion('as_hex', vscode.CompletionItemKind.Property, 'Get address as hex string'),
            this.createCompletion('as_bytes', vscode.CompletionItemKind.Property, 'Get address as bytes'),
            this.createCompletion('as_b64', vscode.CompletionItemKind.Property, 'Get address as base64'),
            this.createCompletion('as_int', vscode.CompletionItemKind.Property, 'Get address as integer')
        ];
    }

    private createResponseCompletions(): vscode.CompletionItem[] {
        return [
            this.createCompletion('status', vscode.CompletionItemKind.Property, 'HTTP status code'),
            this.createCompletion('headers', vscode.CompletionItemKind.Property, 'Response headers'),
            this.createCompletion('body', vscode.CompletionItemKind.Property, 'Response body content')
        ];
    }

    private createVmCompletions(): vscode.CompletionItem[] {
        return [
            this.createCompletion('UserError', vscode.CompletionItemKind.Class, 'User error exception'),
            this.createCompletion('VMError', vscode.CompletionItemKind.Class, 'VM error exception'),
            this.createCompletion('Return', vscode.CompletionItemKind.Class, 'Return value wrapper'),
            this.createCompletion('Result', vscode.CompletionItemKind.Class, 'Result type (union of Return, VMError, UserError)'),
            this.createMethodCompletion('spawn_sandbox', 'Spawn sandboxed execution'),
            this.createMethodCompletion('run_nondet', 'Run non-deterministic operation'),
            this.createMethodCompletion('run_nondet_unsafe', 'Run unsafe non-deterministic operation'),
            this.createMethodCompletion('unpack_result', 'Unpack result value')
        ];
    }

    private createAdvancedCompletions(): vscode.CompletionItem[] {
        return [
            this.createMethodCompletion('user_error_immediate', 'Raise immediate user error')
        ];
    }

    private createEvmCompletions(): vscode.CompletionItem[] {
        return [
            this.createMethodCompletion('contract_interface', 'EVM contract interface decorator'),
            this.createCompletion('MethodEncoder', vscode.CompletionItemKind.Class, 'EVM method encoder for ABI calls'),
            this.createMethodCompletion('encode', 'Encode data to EVM calldata'),
            this.createMethodCompletion('decode', 'Decode EVM return data'),
            this.createMethodCompletion('selector_of', 'Get function selector bytes'),
            this.createMethodCompletion('signature_of', 'Get function signature string'),
            this.createMethodCompletion('type_name_of', 'Get EVM type name'),
            this.createCompletion('ContractProxy', vscode.CompletionItemKind.Class, 'EVM contract proxy'),
            this.createCompletion('ContractDeclaration', vscode.CompletionItemKind.Class, 'EVM contract declaration'),
            this.createCompletion('bytes32', vscode.CompletionItemKind.Class, '32-byte EVM type')
        ];
    }

    private createPublicCompletions(): vscode.CompletionItem[] {
        return [
            this.createCompletion('view', vscode.CompletionItemKind.Method, 'Public view method decorator'),
            this.createCompletion('write', vscode.CompletionItemKind.Module, 'Public write method decorator')
        ];
    }

    private createPublicWriteCompletions(): vscode.CompletionItem[] {
        return [
            this.createCompletion('payable', vscode.CompletionItemKind.Method, 'Make method payable'),
            this.createMethodCompletion('min_gas', 'Set minimum gas requirements')
        ];
    }

    private createCompletion(name: string, kind: vscode.CompletionItemKind, description: string): vscode.CompletionItem {
        const item = new vscode.CompletionItem(name, kind);
        item.detail = description;
        return item;
    }
    
    private createMethodCompletion(name: string, description: string): vscode.CompletionItem {
        const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Method);
        
        // Check if we have signature info for this method
        const sigInfo = this.methodSignatures[name];
        if (sigInfo) {
            // Add parameter info to the label detail
            if (sigInfo.params) {
                item.label = { label: name, detail: sigInfo.params };
            }
            
            // Use snippet for insert text if we have parameters
            if (sigInfo.snippet) {
                item.insertText = new vscode.SnippetString(name + sigInfo.snippet);
            } else {
                // No parameters, just add empty parentheses
                item.insertText = name + '()';
            }
        } else {
            // Default behavior for methods without signature info
            item.insertText = name + '()';
        }
        
        item.detail = description;
        return item;
    }
    
    private createContractInstanceCompletions(): vscode.CompletionItem[] {
        const items = [];
        
        // Methods that return something for chaining
        items.push(this.createMethodCompletion('emit', 'Emit a write transaction to the contract'));
        items.push(this.createMethodCompletion('view', 'Call view methods on the contract'));
        items.push(this.createMethodCompletion('emit_transfer', 'Transfer value to the contract'));
        
        // Properties (no parentheses)
        items.push(this.createCompletion('balance', vscode.CompletionItemKind.Property, 'Contract balance (u256)'));
        items.push(this.createCompletion('address', vscode.CompletionItemKind.Property, 'Contract address'));
        
        return items;
    }
    
    private createEmitMethodCompletions(): vscode.CompletionItem[] {
        return [
            this.createMethodCompletion('send_message', 'Send cross-chain message'),
            this.createMethodCompletion('transfer', 'Transfer tokens'),
            this.createMethodCompletion('mint', 'Mint new tokens'),
            this.createMethodCompletion('update_storage', 'Update contract storage'),
            // Generic method names often used
            this.createMethodCompletion('foo', 'Call foo method'),
            this.createMethodCompletion('bar', 'Call bar method'),
            this.createMethodCompletion('test', 'Call test method')
        ];
    }
    
    private createViewMethodCompletions(): vscode.CompletionItem[] {
        return [
            this.createMethodCompletion('get_balance_of', 'Get balance of address'),
            this.createMethodCompletion('balance_of', 'Get balance of address'),
            this.createMethodCompletion('total_supply', 'Get total token supply'),
            this.createMethodCompletion('get_name', 'Get contract name'),
            this.createMethodCompletion('get_symbol', 'Get token symbol'),
            this.createMethodCompletion('owner', 'Get contract owner'),
            // Generic method names often used
            this.createMethodCompletion('foo', 'Call foo view method'),
            this.createMethodCompletion('test', 'Call test view method'),
            this.createMethodCompletion('nested', 'Call nested view method')
        ];
    }
    
    private mightBeContractInstance(document: vscode.TextDocument, position: vscode.Position, linePrefix: string): boolean {
        // Simple heuristic: check if variable was assigned from gl.ContractAt
        const varMatch = linePrefix.match(/(\w+)\.$/);
        if (!varMatch) return false;
        
        const varName = varMatch[1];
        
        // Look backwards through the document for assignment
        for (let i = position.line; i >= Math.max(0, position.line - 50); i--) {
            const line = document.lineAt(i).text;
            // Check if this variable was assigned from gl.ContractAt
            const assignPattern = new RegExp(`${varName}\\s*=\\s*gl\\.ContractAt\\(`);
            if (assignPattern.test(line)) {
                return true;
            }
            // Also check for gl.get_contract_at
            const getContractPattern = new RegExp(`${varName}\\s*=\\s*gl\\.get_contract_at\\(`);
            if (getContractPattern.test(line)) {
                return true;
            }
        }
        
        // Check if variable name suggests it's a contract
        return varName.includes('contract') || varName.includes('token') || varName.includes('bridge');
    }
}