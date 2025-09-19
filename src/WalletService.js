import * as bip39 from 'bip39';
import { HDNode } from '@ethersproject/hdnode';
import { arrayify } from '@ethersproject/bytes';

/**
 * Derive an EVM account (address + pk) from mnemonic + derivation path.
 * We keep it simple: same path for EVM chains so the address matches across ETH/Polygon/BSC.
 */
export function deriveEvmAccountFromMnemonic(mnemonic, derivationPath) {
    const seed = bip39.mnemonicToSeedSync(mnemonic); // Buffer
    const master = HDNode.fromSeed(arrayify(seed));
    const child = master.derivePath(derivationPath);
    return {
        address: child.address,
        privateKey: child.privateKey,
    };
}

export function generateMnemonic(strength = 128) {
    return bip39.generateMnemonic(strength); // 12 words by default
}

export function validateMnemonic(m) {
    return bip39.validateMnemonic(m);
}
