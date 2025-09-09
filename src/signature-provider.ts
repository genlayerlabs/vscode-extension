import * as vscode from 'vscode';

interface ParameterInfo {
    name: string;
    type: string;
    description?: string;
    optional?: boolean;
}

interface SignatureInfo {
    signature: string;
    description: string;
    parameters: ParameterInfo[];
}

// Detailed signature information for GenVM methods
const GL_SIGNATURES: Record<string, SignatureInfo> = {
    'gl.eq_principle.strict_eq': {
        signature: 'strict_eq(fn: Callable[[], T]) -> Lazy[T]',
        description: 'Comparative equivalence principle that checks for strict equality',
        parameters: [
            {
                name: 'fn',
                type: 'Callable[[], T]',
                description: 'Function that provides result that will be validated'
            }
        ]
    },
    'gl.eq_principle.prompt_comparative': {
        signature: 'prompt_comparative(fn: Callable[[], T], principle: str) -> Lazy[T]',
        description: 'Comparative equivalence principle using NLP for verification',
        parameters: [
            {
                name: 'fn',
                type: 'Callable[[], T]',
                description: 'Function that does all the job'
            },
            {
                name: 'principle', 
                type: 'str',
                description: 'Principle with which equivalence will be evaluated via NLP'
            }
        ]
    },
    'gl.eq_principle.prompt_non_comparative': {
        signature: 'prompt_non_comparative(fn: Callable[[], str], *, task: str, criteria: str) -> Lazy[str]',
        description: 'Non-comparative equivalence principle for subjective tasks',
        parameters: [
            {
                name: 'fn',
                type: 'Callable[[], str]',
                description: 'Function that provides input for the task'
            },
            {
                name: 'task',
                type: 'str',
                description: 'Task to be performed on the input'
            },
            {
                name: 'criteria',
                type: 'str', 
                description: 'Criteria for evaluating task completion'
            }
        ]
    },
    'gl.nondet.exec_prompt': {
        signature: 'exec_prompt(prompt: str, *, response_format: str = "text", images: list = None) -> str | dict',
        description: 'Execute an AI prompt with optional configuration',
        parameters: [
            {
                name: 'prompt',
                type: 'str',
                description: 'The prompt text to execute'
            },
            {
                name: 'response_format',
                type: 'str',
                description: 'Response format: "text" or "json"',
                optional: true
            },
            {
                name: 'images',
                type: 'list[bytes | Image] | None',
                description: 'Optional list of images to include with prompt',
                optional: true
            }
        ]
    },
    'gl.nondet.web.render': {
        signature: 'render(url: str, *, mode: str = "text", wait_after_loaded: str = None) -> str | Image',
        description: 'Render a webpage in a browser-like environment',
        parameters: [
            {
                name: 'url',
                type: 'str',
                description: 'URL of the website to render'
            },
            {
                name: 'mode',
                type: 'str',
                description: 'Mode: "html", "text", or "screenshot"',
                optional: true
            },
            {
                name: 'wait_after_loaded',
                type: 'str | None',
                description: 'Time to wait after DOM loaded (e.g., "1000ms", "1s")',
                optional: true
            }
        ]
    },
    'gl.nondet.web.request': {
        signature: 'request(url: str, *, method: str, body: str = None, headers: dict = {}) -> Lazy[Response]',
        description: 'Make an HTTP request',
        parameters: [
            {
                name: 'url',
                type: 'str',
                description: 'Request URL'
            },
            {
                name: 'method', 
                type: 'str',
                description: 'HTTP method: GET, POST, DELETE, HEAD, OPTIONS, PATCH'
            },
            {
                name: 'body',
                type: 'str | bytes | None',
                description: 'Request body content',
                optional: true
            },
            {
                name: 'headers',
                type: 'dict[str, str | bytes]',
                description: 'HTTP headers as key-value pairs',
                optional: true
            }
        ]
    },
    'gl.nondet.web.get': {
        signature: 'get(url: str, *, headers: dict = {}) -> Lazy[Response]',
        description: 'Make an HTTP GET request',
        parameters: [
            {
                name: 'url',
                type: 'str',
                description: 'Request URL'
            },
            {
                name: 'headers',
                type: 'dict[str, str | bytes]',
                description: 'HTTP headers as key-value pairs',
                optional: true
            }
        ]
    },
    'gl.nondet.web.post': {
        signature: 'post(url: str, *, body: str = None, headers: dict = {}) -> Lazy[Response]',
        description: 'Make an HTTP POST request',
        parameters: [
            {
                name: 'url',
                type: 'str',
                description: 'Request URL'
            },
            {
                name: 'body',
                type: 'str | bytes | None',
                description: 'POST body content',
                optional: true
            },
            {
                name: 'headers',
                type: 'dict[str, str | bytes]',
                description: 'HTTP headers as key-value pairs',
                optional: true
            }
        ]
    },
    'gl.storage.inmem_allocate': {
        signature: 'inmem_allocate(type: Type[T], *init_args, **init_kwargs) -> T',
        description: 'Allocate a storage type in memory',
        parameters: [
            {
                name: 'type',
                type: 'Type[T]',
                description: 'Storage type class to allocate'
            },
            {
                name: 'init_args',
                type: '*args',
                description: 'Positional arguments for type constructor',
                optional: true
            },
            {
                name: 'init_kwargs',
                type: '**kwargs',
                description: 'Keyword arguments for type constructor',
                optional: true
            }
        ]
    }
};

export class GenVMSignatureHelpProvider implements vscode.SignatureHelpProvider {
    
    provideSignatureHelp(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.SignatureHelpContext
    ): vscode.ProviderResult<vscode.SignatureHelp> {
        
        // Find the function call we're inside
        const line = document.lineAt(position.line).text;
        const callInfo = this.findFunctionCall(line, position.character);
        
        if (!callInfo) {
            return null;
        }
        
        const signatureInfo = GL_SIGNATURES[callInfo.functionName];
        if (!signatureInfo) {
            return null;
        }
        
        const signatureHelp = new vscode.SignatureHelp();
        const signature = new vscode.SignatureInformation(signatureInfo.signature);
        signature.documentation = new vscode.MarkdownString(signatureInfo.description);
        
        // Add parameter information
        for (const param of signatureInfo.parameters) {
            const paramInfo = new vscode.ParameterInformation(
                param.name,
                param.description || ''
            );
            signature.parameters.push(paramInfo);
        }
        
        signatureHelp.signatures = [signature];
        signatureHelp.activeSignature = 0;
        signatureHelp.activeParameter = callInfo.activeParameter;
        
        return signatureHelp;
    }
    
    private findFunctionCall(line: string, position: number): { functionName: string, activeParameter: number } | null {
        // Work backwards from current position to find function call
        let parenCount = 0;
        let commaCount = 0;
        let callStart = -1;
        
        // Count parentheses and commas to determine active parameter
        for (let i = position - 1; i >= 0; i--) {
            const char = line[i];
            
            if (char === ')') {
                parenCount++;
            } else if (char === '(') {
                parenCount--;
                if (parenCount < 0) {
                    callStart = i;
                    break;
                }
            } else if (char === ',' && parenCount === 0) {
                commaCount++;
            }
        }
        
        if (callStart === -1) {
            return null;
        }
        
        // Extract function name before the opening parenthesis
        const beforeParen = line.substring(0, callStart);
        const funcMatch = beforeParen.match(/(?:^|\s)(gl\.[a-zA-Z._]+)$/);
        
        if (!funcMatch) {
            return null;
        }
        
        return {
            functionName: funcMatch[1],
            activeParameter: commaCount
        };
    }
}

export const GL_SIGNATURE_HELP_TRIGGER_CHARACTERS = ['(', ','];