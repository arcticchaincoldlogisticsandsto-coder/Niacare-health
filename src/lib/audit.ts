import { supabase } from './supabaseClient';

/**
 * Records a security-relevant action via public.log_audit_event(), a
 * SECURITY DEFINER function that stamps actor_id from the caller's own
 * auth.uid() — never a client-supplied value, so this can't be spoofed to
 * frame another user. Failures are swallowed (audit logging must never
 * block the action it's describing).
 */
export const logAuditEvent = async (
  action: string,
  resourceType: string,
  resourceId?: string,
  patientId?: string,
  metadata: Record<string, unknown> = {},
  facilityId?: string
): Promise<void> => {
  try {
    await supabase.rpc('log_audit_event', {
      p_action: action,
      p_resource_type: resourceType,
      p_resource_id: resourceId || null,
      p_patient_id: patientId || null,
      p_metadata: metadata,
      p_facility_id: facilityId || null,
    });
  } catch {
    // Best-effort — never let audit logging break the primary action.
  }
};
