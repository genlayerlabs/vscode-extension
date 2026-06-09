const addressPattern = '0x[0-9a-fA-F]{40}(?![0-9a-fA-F])';
const addressRegex = new RegExp(addressPattern);
const labelledAddressRegex = new RegExp(`(?:contract\\s*address|contractAddress)\\s*[:=]\\s*(${addressPattern})`, 'i');

export function extractContractAddress(output: string): string | undefined {
    const labelledAddressMatch = output
        .split(/\r?\n/)
        .map(line => line.match(labelledAddressRegex))
        .find((match): match is RegExpMatchArray => !!match);

    if (labelledAddressMatch) {
        return labelledAddressMatch[1];
    }

    return output.match(addressRegex)?.[0];
}
