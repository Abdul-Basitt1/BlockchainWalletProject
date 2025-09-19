import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import 'react-native-get-random-values';
import { initDB, insertWallet, getWallets, getChains, insertAccounts, getAccountsByWallet, deleteWallet } from './db';
import { generateMnemonic, validateMnemonic, deriveEvmAccountFromMnemonic } from './WalletService';

const CHAINS_TO_SHOW = [1, 137, 56]; // ETH, Polygon, BNB respectively

export default function WalletScreen() {
    const [ready, setReady] = useState(false);
    const [tab, setTab] = useState('create'); // 'create' | 'import' | 'portfolio' tabs
    const [wallets, setWallets] = useState([]);
    const [selectedWalletId, setSelectedWalletId] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [chains, setChains] = useState([]);

    // Create form
    const [newName, setNewName] = useState('My Wallet');
    const [generatedMnemonic, setGeneratedMnemonic] = useState('');

    // Import form
    const [importName, setImportName] = useState('Imported Wallet');
    const [importMnemonic, setImportMnemonic] = useState('');

    useEffect(() => {
        (async () => {
            await initDB();
            const cs = await getChains();
            setChains(cs);
            const ws = await getWallets();
            setWallets(ws);
            if (ws[0]) {
                setSelectedWalletId(ws[0].id);
                const accts = await getAccountsByWallet(ws[0].id);
                setAccounts(accts);
            }
            setReady(true);
        })();
    }, []);

    const selectedWallet = useMemo(() => wallets.find(w => w.id === selectedWalletId) || null, [wallets, selectedWalletId]);

    async function refreshWalletsAndAccounts(targetWalletId) {
        const ws = await getWallets();
        setWallets(ws);
        const wid = targetWalletId || (ws[0] ? ws[0].id : null);
        setSelectedWalletId(wid);
        if (wid) {
            const accts = await getAccountsByWallet(wid);
            setAccounts(accts);
        } else {
            setAccounts([]);
        }
    }

    function onGenerateMnemonic() {
        const m = generateMnemonic();
        setGeneratedMnemonic(m);
    }

    async function onCreateWallet() {
        try {
            const mnemonic = generatedMnemonic || generateMnemonic();
            const walletId = await insertWallet({ name: newName.trim() || 'My Wallet', mnemonic });

            // derive accounts for all supported chains (EVM)
            const usedChains = chains.filter(c => CHAINS_TO_SHOW.includes(c.id));
            const derived = usedChains.map(c => {
                const { address, privateKey } = deriveEvmAccountFromMnemonic(mnemonic, c.derivation_path);
                return { chain_id: c.id, address, private_key: privateKey };
                // (Balances are left for later; you can fetch via RPC/Alchemy/etc.)
            });

            await insertAccounts(walletId, derived);
            await refreshWalletsAndAccounts(walletId);
            setTab('portfolio');
            Alert.alert('Success', 'Wallet created successfully.');
        } catch (e) {
            console.log(e);
            Alert.alert('Error', e.message || 'Failed to create wallet');
        }
    }

    async function onImportWallet() {
        try {
            const phrase = importMnemonic.trim().toLowerCase();
            if (!validateMnemonic(phrase)) {
                Alert.alert('Invalid Mnemonic', 'Please enter a valid 12/24-word recovery phrase.');
                return;
            }
            const walletId = await insertWallet({ name: importName.trim() || 'Imported Wallet', mnemonic: phrase });

            const usedChains = chains.filter(c => CHAINS_TO_SHOW.includes(c.id));
            const derived = usedChains.map(c => {
                const { address, privateKey } = deriveEvmAccountFromMnemonic(phrase, c.derivation_path);
                return { chain_id: c.id, address, private_key: privateKey };
            });

            await insertAccounts(walletId, derived);
            await refreshWalletsAndAccounts(walletId);
            setTab('portfolio');
            Alert.alert('Success', 'Wallet imported successfully.');
        } catch (e) {
            console.log(e);
            Alert.alert('Error', e.message || 'Failed to import wallet');
        }
    }

    async function onSelectWallet(id) {
        setSelectedWalletId(id);
        const accts = await getAccountsByWallet(id);
        setAccounts(accts);
        setTab('portfolio');
    }

    async function onDeleteWallet(id) {
        Alert.alert('Delete Wallet', 'This will remove the wallet and its accounts from this device. Make sure you have your seed phrase backed up.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    await deleteWallet(id);
                    await refreshWalletsAndAccounts();
                },
            },
        ]);
    }

    if (!ready) {
        return (
            <SafeAreaView style={styles.center}>
                <Text style={styles.title}>Initializing…</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Tabs */}
            <View style={styles.tabs}>
                <Tab label="Create" active={tab === 'create'} onPress={() => setTab('create')} />
                <Tab label="Import" active={tab === 'import'} onPress={() => setTab('import')} />
                <Tab label="Portfolio" active={tab === 'portfolio'} onPress={() => setTab('portfolio')} />
            </View>

            {tab === 'create' && (
                <View style={styles.section}>
                    <Text style={styles.h2}>Create a New Wallet</Text>

                    <Text style={styles.label}>Wallet Name</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="My Wallet"
                        value={newName}
                        onChangeText={setNewName}
                    />

                    <Text style={styles.label}>Mnemonic (auto-generated)</Text>
                    <TextInput
                        style={[styles.input, { height: 90 }]}
                        placeholder="Tap Generate to create a 12-word phrase"
                        value={generatedMnemonic}
                        onChangeText={setGeneratedMnemonic}
                        multiline
                    />

                    <View style={styles.row}>
                        <Button label="Generate" onPress={onGenerateMnemonic} />
                        <View style={{ width: 12 }} />
                        <Button label="Create" onPress={onCreateWallet} />
                    </View>

                    <Text style={styles.hint}>
                        Save your seed phrase safely. Anyone with it can control your funds.
                    </Text>
                </View>
            )}

            {tab === 'import' && (
                <View style={styles.section}>
                    <Text style={styles.h2}>Import Wallet</Text>

                    <Text style={styles.label}>Wallet Name</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Imported Wallet"
                        value={importName}
                        onChangeText={setImportName}
                    />

                    <Text style={styles.label}>Recovery Phrase (12/24 words)</Text>
                    <TextInput
                        style={[styles.input, { height: 100 }]}
                        placeholder="Enter your mnemonic phrase"
                        value={importMnemonic}
                        onChangeText={setImportMnemonic}
                        multiline
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                    <Button label="Import" onPress={onImportWallet} />
                </View>
            )}

            {tab === 'portfolio' && (
                <View style={styles.section}>
                    <Text style={styles.h2}>Your Wallets</Text>

                    <FlatList
                        data={wallets}
                        keyExtractor={item => String(item.id)}
                        ItemSeparatorComponent={() => <View style={styles.divider} />}
                        renderItem={({ item }) => (
                            <TouchableOpacity onPress={() => onSelectWallet(item.id)} style={[styles.walletItem, selectedWalletId === item.id && styles.walletItemActive]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.textBold}>{item.name}</Text>
                                    <Text style={styles.walletSub}>Created: {new Date(item.created_at).toLocaleString()}</Text>
                                </View>
                                <TouchableOpacity onPress={() => onDeleteWallet(item.id)}>
                                    <Text style={styles.delete}>Delete</Text>
                                </TouchableOpacity>
                            </TouchableOpacity>
                        )}
                    />

                    <View style={{ height: 16 }} />

                    {selectedWallet && (
                        <>
                            <Text style={styles.h2}>Chains / Accounts</Text>
                            <FlatList
                                data={accounts.filter(a => CHAINS_TO_SHOW.includes(a.chain_id))}
                                keyExtractor={item => String(item.id)}
                                ItemSeparatorComponent={() => <View style={styles.divider} />}
                                renderItem={({ item }) => (
                                    <View style={styles.accountRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.textBold}>{item.chain_name} ({item.chain_symbol})</Text>
                                            <Text style={styles.address}>{item.address}</Text>
                                        </View>
                                        {/* Balance placeholder — wire your RPC here */}
                                        <Text style={styles.textBold}>—</Text>
                                    </View>
                                )}
                            />
                            <Text style={styles.hint}>Balances not fetched in this demo. Plug your RPC/Alchemy/Infura to show live balances.</Text>
                        </>
                    )}
                </View>
            )}
        </SafeAreaView>
    );
}

function Tab({ label, active, onPress }) {
    return (
        <TouchableOpacity onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
        </TouchableOpacity>
    );
}

function Button({ label, onPress }) {
    return (
        <TouchableOpacity onPress={onPress} style={styles.button}>
            <Text style={styles.buttonText}>{label}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0B1220'
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0B1220'
    },
    title: {
        color: 'white',
        fontSize: 20,
        fontWeight: '600'
    },
    tabs: {
        flexDirection: 'row',
        padding: 12,
        gap: 8,
        zIndex: 1,
        paddingTop: 60
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 10,
        backgroundColor: '#121A2A',
    },
    tabActive: {
        backgroundColor: '#1E2A44'
    },
    tabText: {
        color: '#9FB0CF',
        fontWeight: '600'
    },
    tabTextActive: {
        color: 'white'
    },
    section: {
        flex: 1,
        padding: 16
    },
    h2: {
        color: 'white',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 12
    },
    label: {
        color: '#9FB0CF',
        marginTop: 10,
        marginBottom: 4
    },
    input: {
        backgroundColor: '#111827',
        color: 'white',
        borderWidth: 1,
        borderColor: '#23314F',
        borderRadius: 10,
        padding: 12,
    },
    row: {
        flexDirection: 'row',
        marginTop: 12
    },
    button: {
        backgroundColor: '#2563EB',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 10,
        alignSelf: 'flex-start',
    },
    buttonText: {
        color: 'white',
        fontWeight: '700'
    },
    hint: {
        color: '#9FB0CF',
        marginTop: 10,
        fontSize: 12
    },
    divider: {
        height: 1,
        backgroundColor: '#1E2A44',
        marginVertical: 8
    },
    walletItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10
    },
    walletItemActive: {
        backgroundColor: 'rgba(37,99,235,0.08)',
        borderRadius: 8,
        paddingHorizontal: 8
    },
    walletSub: {
        color: '#9FB0CF',
        fontSize: 12
    },
    delete: {
        color: '#EF4444',
        fontWeight: '700',
        padding: 8
    },
    accountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8
    },
    textBold: {
        color: 'white',
        fontWeight: '700'
    },
    address: {
        color: '#9FB0CF',
        fontSize: 12,
        marginTop: 4
    },
});
