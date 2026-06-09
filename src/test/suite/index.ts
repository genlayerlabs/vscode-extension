import * as assert from 'assert';
import { extractContractAddress } from '../../helpers/contract-address';

export async function run(): Promise<void> {
    const transactionHash = `Deployment Transaction Hash: 0x${'a'.repeat(64)}`;
    assert.strictEqual(
        extractContractAddress(transactionHash),
        undefined,
        'transaction hash prefixes must not be treated as contract addresses'
    );

    const contractAddress = `Contract address: 0x${'b'.repeat(40)}`;
    assert.strictEqual(
        extractContractAddress(contractAddress),
        `0x${'b'.repeat(40)}`
    );
}
