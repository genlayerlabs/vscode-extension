'use strict';

// Intentionally failing regressions for bugs found on v0.3-dev.

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const Module = require('node:module');
const os = require('node:os');
const { EventEmitter } = require('node:events');
const test = require('node:test');

const configuration = {
    get(key, fallback) {
        if (key === 'linterPath') {
            return '/bin/false';
        }
        return fallback;
    }
};

const vscodeMock = {
    languages: {
        createDiagnosticCollection() {
            return { set() {}, dispose() {} };
        }
    },
    workspace: {
        getConfiguration() {
            return configuration;
        }
    },
    DiagnosticSeverity: {
        Error: 0,
        Warning: 1,
        Information: 2
    }
};

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
    if (request === 'vscode') {
        return vscodeMock;
    }
    return originalLoad.call(this, request, parent, isMain);
};

const { GenVMDiagnosticsProvider } = require('../out/diagnostics-provider');
const { GenVMLinter, resolveLintSeverity } = require('../out/genvm-linter');
Module._load = originalLoad;

const outputChannel = { appendLine() {} };

test('modern linter severity keeps GL-S03 visible in error-only mode', () => {
    assert.equal(resolveLintSeverity({ code: 'GL-S03' }), 'error');
    assert.equal(
        resolveLintSeverity({ code: 'GL-W01', severity: 'error' }),
        'error'
    );
    assert.equal(resolveLintSeverity({ code: 'GL-W01' }), 'warning');
});

test('workspace lint recognizes the documented multiline Seq dependency header', () => {
    const lines = [
        '# {',
        '#   "Seq": [',
        '#     { "Depends": "py-genlayer:test" }',
        '#   ]',
        '# }',
        'class Example(gl.Contract):',
        '    pass'
    ];
    const document = {
        fileName: '/workspace/example.py',
        lineCount: lines.length,
        lineAt(index) {
            return { text: lines[index] };
        }
    };
    const provider = new GenVMDiagnosticsProvider(outputChannel);

    assert.equal(
        provider.isGenVMFile(document),
        true,
        'lintWorkspace currently checks only line 1 for an inline Depends entry, so modern multiline headers are skipped'
    );
});

test('lintDocument removes its temporary file when the linter process errors', async () => {
    const marker = 'bug-hunt-v03-temp.py';
    const tempDir = os.tmpdir();
    const matchingFiles = () => new Set(
        fs.readdirSync(tempDir).filter(name => name.startsWith('genvm_') && name.endsWith(marker))
    );
    const before = matchingFiles();
    const originalSpawn = childProcess.spawn;

    childProcess.spawn = () => {
        const process = new EventEmitter();
        setImmediate(() => process.emit('error', new Error('intentional spawn failure')));
        return process;
    };

    let assertionError;
    try {
        const linter = new GenVMLinter(outputChannel);
        const results = await linter.lintDocument({
            fileName: `/workspace/${marker}`,
            getText() {
                return '# { "Depends": "py-genlayer:test" }\n';
            }
        });
        assert.deepEqual(results, []);

        const leaked = [...matchingFiles()].filter(name => !before.has(name));
        try {
            assert.deepEqual(
                leaked,
                [],
                'cleanupTempFile is only called after runLinter resolves, not from a finally block'
            );
        } catch (error) {
            assertionError = error;
        } finally {
            for (const name of leaked) {
                fs.unlinkSync(`${tempDir}/${name}`);
            }
        }
    } finally {
        childProcess.spawn = originalSpawn;
    }

    if (assertionError) {
        throw assertionError;
    }
});
