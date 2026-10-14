const STORAGE_KEY_PASSKEY_ID = 'lernhilfen_passkey_credential_id';
const STORAGE_KEY_PASSKEY_RAW_ID = 'lernhilfen_passkey_raw_id';
const STORAGE_KEY_PASSKEY_CREATED = 'lernhilfen_passkey_created_at';
const STORAGE_KEY_PASSKEY_NAME = 'lernhilfen_passkey_device_name';

// Helper: Uint8Array to base64url
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Helper: base64url to Uint8Array
function base64ToBuffer(base64: string): Uint8Array {
  let str = base64.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Detects device friendly name (Windows Hello vs Android Fingerprint vs Apple TouchID/FaceID)
 */
export function getBiometricDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Passkey';
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return 'Windows Hello Passkey';
  if (/iPhone|iPad|Macintosh/i.test(ua)) return 'Touch ID / Face ID';
  if (/Android/i.test(ua)) return 'Fingerabdruck (Android)';
  return 'Biometrischer Passkey';
}

/**
 * Checks if WebAuthn and platform authenticator (Fingerprint, TouchID, Windows Hello) are supported.
 */
export async function isBiometricsSupported(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !window.isSecureContext) {
      return false;
    }
    if (typeof window.PublicKeyCredential === 'undefined') {
      return false;
    }
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
      return false;
    }
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (e) {
    return false;
  }
}

/**
 * Checks if a passkey has already been registered on this device.
 */
export function isPasskeyEnrolled(): boolean {
  try {
    const rawId = localStorage.getItem(STORAGE_KEY_PASSKEY_RAW_ID);
    return !!rawId && rawId.length > 0;
  } catch (e) {
    return false;
  }
}

/**
 * Returns metadata about the enrolled passkey.
 */
export function getPasskeyInfo(): {
  enrolled: boolean;
  createdAt?: string;
  deviceName?: string;
} {
  try {
    const enrolled = isPasskeyEnrolled();
    const createdAt = localStorage.getItem(STORAGE_KEY_PASSKEY_CREATED) || undefined;
    const deviceName = localStorage.getItem(STORAGE_KEY_PASSKEY_NAME) || getBiometricDeviceLabel();
    return { enrolled, createdAt, deviceName };
  } catch (e) {
    return { enrolled: false };
  }
}

/**
 * Registers a new platform passkey (Fingerprint / TouchID / Windows Hello).
 */
export async function registerPasskey(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supported = await isBiometricsSupported();
    if (!supported) {
      return {
        success: false,
        error:
          'Biometrische Authentifizierung (Fingerabdruck / Windows Hello) wird auf diesem Gerät oder Browser nicht unterstützt.',
      };
    }

    // 32-byte cryptographically random challenge
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    // Fixed user ID for Lehrkraft
    const userId = new Uint8Array([108, 101, 104, 114, 101, 114]); // 'lehrer'

    const creationOptions: CredentialCreationOptions = {
      publicKey: {
        challenge,
        rp: {
          name: 'QR-Lernhilfen',
        },
        user: {
          id: userId,
          name: 'lehrkraft',
          displayName: 'Lehrkraft (QR-Lernhilfen)',
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' }, // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // Enforce platform authenticator (Fingerprint/Face/Windows Hello)
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
      },
    };

    const credential = (await navigator.credentials.create(
      creationOptions
    )) as PublicKeyCredential | null;

    if (!credential) {
      return {
        success: false,
        error: 'Die Registrierung wurde abgebrochen oder lieferte keine Anmeldedaten zurück.',
      };
    }

    // Save credential ID and rawId
    const base64RawId = bufferToBase64(credential.rawId);
    localStorage.setItem(STORAGE_KEY_PASSKEY_ID, credential.id);
    localStorage.setItem(STORAGE_KEY_PASSKEY_RAW_ID, base64RawId);
    localStorage.setItem(STORAGE_KEY_PASSKEY_CREATED, new Date().toISOString());
    localStorage.setItem(STORAGE_KEY_PASSKEY_NAME, getBiometricDeviceLabel());

    return { success: true };
  } catch (err: any) {
    console.error('Passkey registration error:', err);
    if (err.name === 'NotAllowedError') {
      return {
        success: false,
        error:
          'Die Fingerabdruck- / Passkey-Abfrage wurde abgebrochen oder das Zeitlimit ist abgelaufen.',
      };
    }
    if (err.name === 'SecurityError') {
      return {
        success: false,
        error:
          'Sicherheitsbeschränkung im aktuellen Kontext. Tipp: Bitte öffne die App in einem regulären Tab oder installiere sie als PWA.',
      };
    }
    return {
      success: false,
      error:
        err.message || 'Passkey-Erstellung fehlgeschlagen. Bitte nutze die PIN.',
    };
  }
}

/**
 * Authenticates using the registered platform passkey.
 */
export async function authenticateWithPasskey(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const rawIdBase64 = localStorage.getItem(STORAGE_KEY_PASSKEY_RAW_ID);
    if (!rawIdBase64) {
      return {
        success: false,
        error: 'Es ist noch kein Passkey / Fingerabdruck auf diesem Gerät hinterlegt.',
      };
    }

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const rawIdBuffer = base64ToBuffer(rawIdBase64);

    const getOptions: CredentialRequestOptions = {
      publicKey: {
        challenge,
        allowCredentials: [
          {
            id: rawIdBuffer as any,
            type: 'public-key',
            transports: ['internal'],
          },
        ],
        userVerification: 'required',
        timeout: 60000,
      },
    };

    const assertion = (await navigator.credentials.get(
      getOptions
    )) as PublicKeyCredential | null;

    if (!assertion) {
      return {
        success: false,
        error: 'Authentifizierung abgebrochen.',
      };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Passkey authentication error:', err);
    if (err.name === 'NotAllowedError') {
      return {
        success: false,
        error: 'Biometrische Prüfung abgebrochen oder nicht erkannt.',
      };
    }
    if (err.name === 'SecurityError') {
      return {
        success: false,
        error:
          'Passkey-Zugriff im aktuellen Fenster nicht zugelassen. Bitte öffne die App direkt oder nutze die PIN.',
      };
    }
    return {
      success: false,
      error: err.message || 'Biometrische Prüfung fehlgeschlagen.',
    };
  }
}

/**
 * Removes the stored passkey on this device.
 */
export function removePasskey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_PASSKEY_ID);
    localStorage.removeItem(STORAGE_KEY_PASSKEY_RAW_ID);
    localStorage.removeItem(STORAGE_KEY_PASSKEY_CREATED);
    localStorage.removeItem(STORAGE_KEY_PASSKEY_NAME);
  } catch (e) {
    // ignore
  }
}
