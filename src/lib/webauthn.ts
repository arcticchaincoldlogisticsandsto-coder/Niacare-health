import { startRegistration, startAuthentication, WebAuthnError } from '@simplewebauthn/browser';
import { supabase } from './supabaseClient';

const getAccessToken = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
};

const authedFetch = async (path: string, body: unknown): Promise<{ data?: any; error?: string }> => {
  const token = await getAccessToken();
  if (!token) return { error: 'You must be signed in.' };

  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) return { error: data?.error || 'Request failed.' };
    return { data };
  } catch {
    return { error: 'Could not reach the server.' };
  }
};

/** Friendlier messages for the common ways a real WebAuthn ceremony can fail. */
const describeWebAuthnError = (err: unknown, isSwahili: boolean): string => {
  if (err instanceof WebAuthnError) {
    switch (err.name) {
      case 'InvalidStateError':
        return isSwahili
          ? 'Kifaa hiki tayari kimesajiliwa.'
          : 'This device is already registered.';
      case 'NotAllowedError':
        return isSwahili
          ? 'Umeghairi au muda umeisha.'
          : 'Cancelled, or the request timed out.';
      default:
        break;
    }
  }
  return isSwahili ? 'Uthibitishaji wa kibiolojia umeshindikana.' : 'Biometric authentication failed.';
};

export interface WebAuthnResult {
  success: boolean;
  error?: string;
}

/** Registers a new fingerprint/Face ID/Windows Hello credential for the signed-in patient. */
export const registerBiometric = async (
  patientName: string,
  isSwahili: boolean
): Promise<WebAuthnResult> => {
  const { data: optionsJSON, error: optionsError } = await authedFetch('/api/webauthn-register-options', {
    patientName,
  });
  if (optionsError || !optionsJSON) return { success: false, error: optionsError };

  let attestationResponse;
  try {
    attestationResponse = await startRegistration({ optionsJSON });
  } catch (err) {
    return { success: false, error: describeWebAuthnError(err, isSwahili) };
  }

  const { error: verifyError } = await authedFetch('/api/webauthn-register-verify', { attestationResponse });
  if (verifyError) return { success: false, error: verifyError };

  return { success: true };
};

/** Authenticates the signed-in patient against a previously registered credential. */
export const authenticateBiometric = async (isSwahili: boolean): Promise<WebAuthnResult> => {
  const { data: optionsJSON, error: optionsError } = await authedFetch('/api/webauthn-auth-options', {});
  if (optionsError || !optionsJSON) return { success: false, error: optionsError };

  let assertionResponse;
  try {
    assertionResponse = await startAuthentication({ optionsJSON });
  } catch (err) {
    return { success: false, error: describeWebAuthnError(err, isSwahili) };
  }

  const { error: verifyError } = await authedFetch('/api/webauthn-auth-verify', { assertionResponse });
  if (verifyError) return { success: false, error: verifyError };

  return { success: true };
};

export interface BiometricSupport {
  browserSupportsWebAuthn: boolean;
  platformAuthenticatorAvailable: boolean;
}

/** Checks whether this device/browser can actually do platform biometric auth. */
export const checkBiometricSupport = async (): Promise<BiometricSupport> => {
  const browserSupportsWebAuthn = typeof window !== 'undefined' && !!window.PublicKeyCredential;
  if (!browserSupportsWebAuthn) return { browserSupportsWebAuthn: false, platformAuthenticatorAvailable: false };

  try {
    const { platformAuthenticatorIsAvailable } = await import('@simplewebauthn/browser');
    const platformAuthenticatorAvailable = await platformAuthenticatorIsAvailable();
    return { browserSupportsWebAuthn: true, platformAuthenticatorAvailable };
  } catch {
    return { browserSupportsWebAuthn: true, platformAuthenticatorAvailable: false };
  }
};

/** Whether the signed-in patient already has at least one registered credential. */
export const hasRegisteredBiometric = async (userId: string): Promise<boolean> => {
  const { count } = await supabase
    .from('webauthn_credentials')
    .select('id', { count: 'exact', head: true })
    .eq('patient_id', userId);
  return !!count && count > 0;
};

/** Removes all of the signed-in patient's registered biometric credentials. */
export const unregisterAllBiometrics = async (userId: string): Promise<WebAuthnResult> => {
  const { error } = await supabase.from('webauthn_credentials').delete().eq('patient_id', userId);
  if (error) return { success: false, error: error.message };
  return { success: true };
};
