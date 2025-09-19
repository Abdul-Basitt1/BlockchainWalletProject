import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

const DB_NAME = 'walletapp.db';

export async function getDB() {
    return SQLite.openDatabase({ name: DB_NAME, location: 'default' });
}

export async function initDB() {
    const db = await getDB();

    // create tables
    await db.executeSql(`
    CREATE TABLE IF NOT EXISTS wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      mnemonic TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

    await db.executeSql(`
    CREATE TABLE IF NOT EXISTS chains (
      id INTEGER PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      derivation_path TEXT NOT NULL
    );
  `);

    await db.executeSql(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_id INTEGER NOT NULL,
      chain_id INTEGER NOT NULL,
      address TEXT NOT NULL,
      private_key TEXT NOT NULL,
      FOREIGN KEY(wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
      FOREIGN KEY(chain_id) REFERENCES chains(id) ON DELETE CASCADE
    );
  `);

    // Seed supported EVM chains once (same derivation path for demo)
    const seedChains = [
        { id: 1, key: 'ethereum', name: 'Ethereum', symbol: 'ETH', path: `m/44'/60'/0'/0/0` },
        { id: 137, key: 'polygon', name: 'Polygon', symbol: 'MATIC', path: `m/44'/60'/0'/0/0` },
        { id: 56, key: 'bsc', name: 'BNB Smart Chain', symbol: 'BNB', path: `m/44'/60'/0'/0/0` },
    ];

    // insert if missing
    for (const c of seedChains) {
        await db.executeSql(
            `INSERT OR IGNORE INTO chains (id, key, name, symbol, derivation_path) VALUES (?, ?, ?, ?, ?)`,
            [c.id, c.key, c.name, c.symbol, c.path]
        );
    }

    return db;
}

export async function insertWallet({ name, mnemonic }) {
    const db = await getDB();
    const createdAt = Date.now();
    const [res] = await db.executeSql(
        `INSERT INTO wallets (name, mnemonic, created_at) VALUES (?, ?, ?)`,
        [name || 'My Wallet', mnemonic, createdAt]
    );
    return res.insertId;
}

export async function getWallets() {
    const db = await getDB();
    const [res] = await db.executeSql(`SELECT * FROM wallets ORDER BY created_at DESC`);
    const rows = [];
    for (let i = 0; i < res.rows.length; i++) rows.push(res.rows.item(i));
    return rows;
}

export async function getChains() {
    const db = await getDB();
    const [res] = await db.executeSql(`SELECT * FROM chains ORDER BY id`);
    const rows = [];
    for (let i = 0; i < res.rows.length; i++) rows.push(res.rows.item(i));
    return rows;
}

export async function insertAccounts(walletId, accounts) {
    const db = await getDB();
    await db.transaction(async tx => {
        for (const a of accounts) {
            await tx.executeSql(
                `INSERT INTO accounts (wallet_id, chain_id, address, private_key) VALUES (?, ?, ?, ?)`,
                [walletId, a.chain_id, a.address, a.private_key]
            );
        }
    });
}

export async function getAccountsByWallet(walletId) {
    const db = await getDB();
    const [res] = await db.executeSql(
        `SELECT a.*, c.name as chain_name, c.symbol as chain_symbol, c.key as chain_key
     FROM accounts a
     JOIN chains c ON c.id = a.chain_id
     WHERE a.wallet_id = ?
     ORDER BY a.chain_id`,
        [walletId]
    );
    const rows = [];
    for (let i = 0; i < res.rows.length; i++) rows.push(res.rows.item(i));
    return rows;
}

export async function deleteWallet(walletId) {
    const db = await getDB();
    await db.executeSql(`DELETE FROM accounts WHERE wallet_id = ?`, [walletId]);
    await db.executeSql(`DELETE FROM wallets WHERE id = ?`, [walletId]);
}
