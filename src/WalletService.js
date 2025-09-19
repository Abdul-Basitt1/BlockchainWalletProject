import * as bip39 from 'bip39';
import { HDNode } from '@ethersproject/hdnode';
import { arrayify } from '@ethersproject/bytes';

export async function deriveEvmAccountFromMnemonic(mnemonic, derivationPath) {
    const seed = await bip39.mnemonicToSeed(mnemonic); // Buffer
    const master = HDNode.fromSeed(arrayify(seed));
    const child = master.derivePath(derivationPath);
    return {
        address: child.address,
        privateKey: child.privateKey,
    };
}

export function generateMnemonic(strength = 128) {
    return bip39.generateMnemonic(strength); // 128 means 12 words
}

export function validateMnemonic(m) {
    return bip39.validateMnemonic(m);
}
