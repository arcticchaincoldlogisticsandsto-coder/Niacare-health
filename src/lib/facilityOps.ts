import { supabase } from './supabaseClient';
import { logAuditEvent } from './audit';

export interface DepartmentRow {
  id: string;
  provider_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ServiceRow {
  id: string;
  provider_id: string;
  department_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

// One fetch function serves both facility staff/admin (who see every row —
// active and inactive, via RLS's staff/admin branch) and patients (who see
// only is_active rows, via RLS's public branch) — no separate query per
// caller type; facility_departments/facility_services' own RLS (see
// supabase/schema.sql) already decides what comes back for who's asking.
export const fetchDepartments = async (providerId: string): Promise<{ departments: DepartmentRow[]; error?: string }> => {
  const { data, error } = await supabase
    .from('facility_departments')
    .select('id, provider_id, name, description, is_active, created_at')
    .eq('provider_id', providerId)
    .order('name');
  if (error) return { departments: [], error: error.message };
  return { departments: (data || []) as DepartmentRow[] };
};

export const createDepartment = async (providerId: string, name: string, description: string): Promise<{ department?: DepartmentRow; error?: string }> => {
  const { data, error } = await supabase
    .from('facility_departments')
    .insert({ provider_id: providerId, name: name.trim(), description: description.trim() || null })
    .select('id, provider_id, name, description, is_active, created_at')
    .single();
  if (error) return { error: error.message };
  logAuditEvent('DEPARTMENT_CREATED', 'facility_departments', data.id, undefined, { provider_id: providerId, name }, providerId);
  return { department: data as DepartmentRow };
};

export const updateDepartment = async (id: string, providerId: string, name: string, description: string): Promise<{ error?: string }> => {
  const { error } = await supabase
    .from('facility_departments')
    .update({ name: name.trim(), description: description.trim() || null })
    .eq('id', id);
  if (!error) logAuditEvent('DEPARTMENT_UPDATED', 'facility_departments', id, undefined, { name }, providerId);
  return { error: error?.message };
};

export const setDepartmentActive = async (id: string, providerId: string, isActive: boolean): Promise<{ error?: string }> => {
  const { error } = await supabase.from('facility_departments').update({ is_active: isActive }).eq('id', id);
  if (!error) logAuditEvent(isActive ? 'DEPARTMENT_ACTIVATED' : 'DEPARTMENT_DEACTIVATED', 'facility_departments', id, undefined, {}, providerId);
  return { error: error?.message };
};

export const fetchServices = async (providerId: string): Promise<{ services: ServiceRow[]; error?: string }> => {
  const { data, error } = await supabase
    .from('facility_services')
    .select('id, provider_id, department_id, name, description, is_active, created_at')
    .eq('provider_id', providerId)
    .order('name');
  if (error) return { services: [], error: error.message };
  return { services: (data || []) as ServiceRow[] };
};

export const createService = async (
  providerId: string,
  departmentId: string | null,
  name: string,
  description: string
): Promise<{ service?: ServiceRow; error?: string }> => {
  const { data, error } = await supabase
    .from('facility_services')
    .insert({ provider_id: providerId, department_id: departmentId, name: name.trim(), description: description.trim() || null })
    .select('id, provider_id, department_id, name, description, is_active, created_at')
    .single();
  if (error) return { error: error.message };
  logAuditEvent('SERVICE_CREATED', 'facility_services', data.id, undefined, { provider_id: providerId, name }, providerId);
  return { service: data as ServiceRow };
};

export const updateService = async (id: string, providerId: string, departmentId: string | null, name: string, description: string): Promise<{ error?: string }> => {
  const { error } = await supabase
    .from('facility_services')
    .update({ department_id: departmentId, name: name.trim(), description: description.trim() || null })
    .eq('id', id);
  if (!error) logAuditEvent('SERVICE_UPDATED', 'facility_services', id, undefined, { name }, providerId);
  return { error: error?.message };
};

export const setServiceActive = async (id: string, providerId: string, isActive: boolean): Promise<{ error?: string }> => {
  const { error } = await supabase.from('facility_services').update({ is_active: isActive }).eq('id', id);
  if (!error) logAuditEvent(isActive ? 'SERVICE_ACTIVATED' : 'SERVICE_DEACTIVATED', 'facility_services', id, undefined, {}, providerId);
  return { error: error?.message };
};

// assign_doctor_department() validates authorization and same-facility
// department server-side — see supabase/schema.sql. It also logs its own
// audit event, so this wrapper does not log a second one.
export const assignDoctorDepartment = async (doctorProfileId: string, departmentId: string | null): Promise<{ error?: string }> => {
  const { error } = await supabase.rpc('assign_doctor_department', {
    p_doctor_profile_id: doctorProfileId,
    p_department_id: departmentId,
  });
  return { error: error?.message };
};
