export interface PublicKeys {
    signingPublicKey: string;
    encryptionPublicKey: string;
    format: string;
}

interface StoredKeyPair {
    publicKey: string;
    privateKey: string;
}

interface StoredKeys {
    username: string;
    createdAt: string;
    format: string;
    signing: StoredKeyPair;
    encryption: StoredKeyPair;
}

const DB_NAME = 'mesez_keys';
const STORE_NAME = 'userKeys';

/**
 * Initialize IndexedDB for key storage
 */
function initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event: any) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'username' });
            }
        };
    });
}

/**
 * Converts an ArrayBuffer to a base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Generate cryptographic key pairs for signing and encryption
 * Uses EdDSA for signing and X25519 for encryption
 */
export async function generateKeyPair(): Promise<{
    signing: { publicKey: CryptoKey; privateKey: CryptoKey };
    encryption: { publicKey: CryptoKey; privateKey: CryptoKey };
}> {
    const signingPair = await window.crypto.subtle.generateKey(
        {
            name: 'Ed25519',
        },
        true, // extractable
        ['sign', 'verify']
    );

    const encryptionPair = await window.crypto.subtle.generateKey(
        {
            name: 'X25519',
        },
        true, // extractable
        ['deriveKey', 'deriveBits']
    );

    return {
        signing: signingPair as { publicKey: CryptoKey; privateKey: CryptoKey },
        encryption: encryptionPair as { publicKey: CryptoKey; privateKey: CryptoKey },
    };
}

/**
 * Export CryptoKey to base64 format
 */
async function exportKeyToBase64(key: CryptoKey, type: 'public' | 'private'): Promise<string> {
    const format = type === 'public' ? 'spki' : 'pkcs8';
    const exported = await window.crypto.subtle.exportKey(format, key);
    return arrayBufferToBase64(exported);
}

/**
 * Generate key pair for user registration and store full pairs in IndexedDB
 * Returns only public keys to send to server
 */
export async function generateAndStoreKeys(username: string): Promise<PublicKeys> {
    const normalizedUsername = username.trim();
    if (!normalizedUsername) {
        throw new Error('Username is required for key generation');
    }

    const { signing, encryption } = await generateKeyPair();

    const signingPublicKey = await exportKeyToBase64(signing.publicKey, 'public');
    const signingPrivateKey = await exportKeyToBase64(signing.privateKey, 'private');
    const encryptionPublicKey = await exportKeyToBase64(encryption.publicKey, 'public');
    const encryptionPrivateKey = await exportKeyToBase64(encryption.privateKey, 'private');

    const payload: StoredKeys = {
        username: normalizedUsername,
        createdAt: new Date().toISOString(),
        format: 'spki-pkcs8-base64',
        signing: {
            publicKey: signingPublicKey,
            privateKey: signingPrivateKey,
        },
        encryption: {
            publicKey: encryptionPublicKey,
            privateKey: encryptionPrivateKey,
        },
    };

    // Store full key pair in IndexedDB
    try {
        const db = await initDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        await new Promise<void>((resolve, reject) => {
            const request = store.put(payload);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    } catch (err) {
        console.warn('Could not store keys in IndexedDB:', err);
    }

    return {
        signingPublicKey,
        encryptionPublicKey,
        format: payload.format,
    };
}

/**
 * Load stored keys from IndexedDB
 */
export async function loadStoredKeys(username: string): Promise<StoredKeys | null> {
    const normalizedUsername = username.trim();
    if (!normalizedUsername) {
        throw new Error('Username is required to load keys');
    }

    try {
        const db = await initDB();
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.get(normalizedUsername);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result || null);
        });
    } catch (err) {
        console.error('Error loading stored keys:', err);
        return null;
    }
}
