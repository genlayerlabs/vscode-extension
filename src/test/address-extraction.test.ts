import * as assert from 'assert';
import { extractContractAddress } from '../helpers/contract-address';

const transactionHash = `Deployment Transaction Hash: 0x${'a'.repeat(64)}`;
assert.strictEqual(
    extractContractAddress(transactionHash),
    undefined,
    'transaction hash prefixes must not be treated as contract addresses'
);

const labelledAddress = `Contract address: 0x${'b'.repeat(40)}`;
assert.strictEqual(
    extractContractAddress(labelledAddress),
    `0x${'b'.repeat(40)}`
);

const camelCaseAddress = `contractAddress=0x${'c'.repeat(40)}`;
assert.strictEqual(
    extractContractAddress(camelCaseAddress),
    `0x${'c'.repeat(40)}`
);
