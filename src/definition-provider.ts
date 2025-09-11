import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class GenVMDefinitionProvider implements vscode.DefinitionProvider {
    
    private contractCache = new Map<string, vscode.Location[]>();
    
    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Definition | vscode.LocationLink[] | undefined> {
        
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }
        
        const word = document.getText(wordRange);
        const line = document.lineAt(position.line).text;
        
        // Check different types of definitions
        const definitions: vscode.Location[] = [];
        
        // 1. Contract definitions (gl.ContractAt, inheritance)
        if (this.isContractReference(line, word)) {
            const contractDef = await this.findContractDefinition(word);
            if (contractDef) {
                definitions.push(...contractDef);
            }
        }
        
        // 2. Method definitions (self.method_name, contract.method_name)
        if (this.isMethodCall(line, word)) {
            const methodDef = await this.findMethodDefinition(document, word, line);
            if (methodDef) {
                definitions.push(...methodDef);
            }
        }
        
        // 3. Variable definitions (self.attribute, local variables)
        if (this.isVariableReference(line, word)) {
            const varDef = this.findVariableDefinition(document, word, position);
            if (varDef) {
                definitions.push(...varDef);
            }
        }
        
        // 4. Import definitions (from module import ...)
        if (this.isImportReference(line, word)) {
            const importDef = await this.findImportDefinition(word, document);
            if (importDef) {
                definitions.push(...importDef);
            }
        }
        
        // 5. GenVM API definitions (gl.*, Address, etc.)
        if (this.isGenVMAPI(line, word)) {
            const apiDef = this.getGenVMAPIDefinition(word);
            if (apiDef) {
                definitions.push(...apiDef);
            }
        }
        
        return definitions.length > 0 ? definitions : undefined;
    }
    
    private isContractReference(line: string, word: string): boolean {
        return line.includes('gl.ContractAt') ||
               line.includes(`class ${word}`) ||
               line.includes(`(${word})`) ||
               /extends\s+/.test(line);
    }
    
    private isMethodCall(line: string, word: string): boolean {
        return line.includes(`.${word}(`) ||
               line.includes(`self.${word}`) ||
               line.match(new RegExp(`\\b${word}\\s*\\(`)) !== null;
    }
    
    private isVariableReference(line: string, word: string): boolean {
        return line.includes(`self.${word}`) ||
               line.includes(`${word}.`) ||
               line.includes(`${word}[`) ||
               line.match(new RegExp(`\\b${word}\\b`)) !== null;
    }
    
    private isImportReference(line: string, word: string): boolean {
        return line.includes(`from ${word}`) ||
               line.includes(`import ${word}`) ||
               line.includes(`from .${word}`);
    }
    
    private isGenVMAPI(line: string, word: string): boolean {
        const genvmAPIs = [
            'gl', 'Address', 'u8', 'u16', 'u32', 'u64', 'u128', 'u256',
            'i8', 'i16', 'i32', 'i64', 'i128', 'i256',
            'TreeMap', 'DynArray', 'Contract', 'ContractAt'
        ];
        return genvmAPIs.includes(word);
    }
    
    private async findContractDefinition(contractName: string): Promise<vscode.Location[]> {
        // Check cache first
        if (this.contractCache.has(contractName)) {
            return this.contractCache.get(contractName)!;
        }
        
        const locations: vscode.Location[] = [];
        
        // Search in workspace
        const files = await vscode.workspace.findFiles('**/*.py', '**/node_modules/**');
        
        for (const file of files) {
            const document = await vscode.workspace.openTextDocument(file);
            const text = document.getText();
            
            // Look for class definition
            const classPattern = new RegExp(`class\\s+${contractName}\\s*\\(.*gl\\.Contract.*\\)`, 'g');
            let match;
            
            while ((match = classPattern.exec(text)) !== null) {
                const position = document.positionAt(match.index);
                locations.push(new vscode.Location(file, position));
            }
        }
        
        // Cache the result
        this.contractCache.set(contractName, locations);
        
        return locations;
    }
    
    private async findMethodDefinition(
        document: vscode.TextDocument,
        methodName: string,
        line: string
    ): Promise<vscode.Location[]> {
        const locations: vscode.Location[] = [];
        
        // First check in current document
        const currentFileLocations = this.findInDocument(document, `def ${methodName}\\s*\\(`);
        locations.push(...currentFileLocations);
        
        // If it's a method call on another object, try to find the class
        const objectMatch = line.match(/(\w+)\.${methodName}/);
        if (objectMatch) {
            const objectName = objectMatch[1];
            
            // Find the type of the object
            const objectType = await this.inferObjectType(document, objectName);
            if (objectType) {
                // Find the class definition and its methods
                const classDef = await this.findContractDefinition(objectType);
                for (const loc of classDef) {
                    const classDoc = await vscode.workspace.openTextDocument(loc.uri);
                    const methodLocs = this.findInDocument(classDoc, `def ${methodName}\\s*\\(`);
                    locations.push(...methodLocs);
                }
            }
        }
        
        return locations;
    }
    
    private findVariableDefinition(
        document: vscode.TextDocument,
        varName: string,
        position: vscode.Position
    ): vscode.Location[] {
        const locations: vscode.Location[] = [];
        
        // Search backwards for variable assignment
        for (let i = position.line - 1; i >= 0; i--) {
            const line = document.lineAt(i).text;
            
            // Variable assignment
            if (line.match(new RegExp(`\\b${varName}\\s*=`))) {
                locations.push(new vscode.Location(
                    document.uri,
                    new vscode.Position(i, line.indexOf(varName))
                ));
                break;
            }
            
            // Function parameter
            if (line.includes('def ') && line.includes(varName)) {
                const paramMatch = line.match(new RegExp(`\\b${varName}\\b`));
                if (paramMatch) {
                    locations.push(new vscode.Location(
                        document.uri,
                        new vscode.Position(i, paramMatch.index!)
                    ));
                    break;
                }
            }
            
            // Class attribute
            if (line.match(new RegExp(`^\\s+${varName}\\s*:`))) {
                locations.push(new vscode.Location(
                    document.uri,
                    new vscode.Position(i, line.indexOf(varName))
                ));
                break;
            }
        }
        
        // Check for self.attribute in __init__
        if (varName.startsWith('self.')) {
            const attrName = varName.substring(5);
            const initLocs = this.findInDocument(document, `self\\.${attrName}\\s*=`);
            locations.push(...initLocs);
        }
        
        return locations;
    }
    
    private async findImportDefinition(
        moduleName: string,
        document: vscode.TextDocument
    ): Promise<vscode.Location[]> {
        const locations: vscode.Location[] = [];
        
        // Check if it's a relative import
        if (moduleName.startsWith('.')) {
            const currentDir = path.dirname(document.uri.fsPath);
            const relativePath = path.join(currentDir, moduleName.substring(1) + '.py');
            
            if (fs.existsSync(relativePath)) {
                locations.push(new vscode.Location(
                    vscode.Uri.file(relativePath),
                    new vscode.Position(0, 0)
                ));
            }
        } else {
            // Search for the module in workspace
            const files = await vscode.workspace.findFiles(`**/${moduleName}.py`, '**/node_modules/**');
            for (const file of files) {
                locations.push(new vscode.Location(file, new vscode.Position(0, 0)));
            }
        }
        
        return locations;
    }
    
    private getGenVMAPIDefinition(apiName: string): vscode.Location[] {
        // These would ideally point to actual GenVM library files
        // For now, we'll create virtual locations or point to stub files
        const locations: vscode.Location[] = [];
        
        // Try to find type stub files
        const stubPatterns: { [key: string]: string } = {
            'gl': '**/genlayer/gl/__init__.py',
            'Address': '**/genlayer/py/types.py',
            'Contract': '**/genlayer/gl/genvm_contracts.py',
            'ContractAt': '**/genlayer/gl/genvm_contracts.py',
        };
        
        if (stubPatterns[apiName]) {
            vscode.workspace.findFiles(stubPatterns[apiName], '**/node_modules/**').then(files => {
                for (const file of files) {
                    locations.push(new vscode.Location(file, new vscode.Position(0, 0)));
                }
            });
        }
        
        return locations;
    }
    
    private findInDocument(document: vscode.TextDocument, pattern: string): vscode.Location[] {
        const locations: vscode.Location[] = [];
        const regex = new RegExp(pattern, 'g');
        const text = document.getText();
        let match;
        
        while ((match = regex.exec(text)) !== null) {
            const position = document.positionAt(match.index);
            locations.push(new vscode.Location(document.uri, position));
        }
        
        return locations;
    }
    
    private async inferObjectType(document: vscode.TextDocument, objectName: string): Promise<string | null> {
        const text = document.getText();
        
        // Look for type annotations
        const typePattern = new RegExp(`${objectName}\\s*:\\s*(\\w+)`);
        const typeMatch = text.match(typePattern);
        if (typeMatch) {
            return typeMatch[1];
        }
        
        // Look for assignments
        const assignPattern = new RegExp(`${objectName}\\s*=\\s*([\\w.]+)\\(`);
        const assignMatch = text.match(assignPattern);
        if (assignMatch) {
            const value = assignMatch[1];
            // Handle gl.ContractAt
            if (value === 'gl.ContractAt') {
                return 'ContractProxy';
            }
            // Handle class instantiation
            return value;
        }
        
        return null;
    }
}