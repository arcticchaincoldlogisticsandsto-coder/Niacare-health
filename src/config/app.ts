export const APP_NAME = import.meta.env.VITE_APP_NAME || 'NiaCare Health';
export const DEFAULT_COUNTRY = import.meta.env.VITE_DEFAULT_COUNTRY || 'TZ';
export const IS_DEV = import.meta.env.DEV === true;
export const ENABLE_DEMO_HELPERS = import.meta.env.VITE_ENABLE_DEMO_HELPERS === 'true' || IS_DEV;

export const SUPPORT = {
  emergencyTollFree: '112',
  ambulanceHotline: '+255 22 215 1367',
  supportEmail: 'support@niacare.go.tz',
} as const;

export const FEATURE_FLAGS = {
  showDemoFill: ENABLE_DEMO_HELPERS,
  enableBiometric: true,
  enableTelehealth: true,
  enableEmergencyDispatch: true,
} as const;
