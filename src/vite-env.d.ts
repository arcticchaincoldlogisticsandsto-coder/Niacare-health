/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Optional. URL to a prepared anatomical GLB — see docs/body-map-assets.md and src/components/body-map/bodyModelAdapter.ts. Unset in this project today (no licensed asset has been cleared for shipping). */
  readonly VITE_ANATOMICAL_MODEL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
