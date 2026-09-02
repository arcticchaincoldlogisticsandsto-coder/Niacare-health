// Basemap tile source. Started out adapted from a proven fallback-chain
// pattern (a sibling project's fleet-map tile config) that led with CARTO's
// "keyless" Voyager/Dark Matter raster tiles — verified live against this
// map during implementation and CARTO now watermarks those tiles
// "API KEY REQUIRED" without one (a provider policy change since that
// reference was written, not a bug here). Removed rather than left in as a
// silently-broken first link in the chain. OpenStreetMap's own tile
// servers remain genuinely keyless and are the sole light basemap;
// mirrored across its three subdomains for basic load distribution, not a
// true multi-provider fallback (see FacilityMapModal's tileerror handling
// for what happens if OSM itself is unreachable — it falls through to the
// "map unavailable, use the list" state rather than pretending a second
// provider is standing by).
export interface TileLayerConfig {
  id: string;
  url: string;
  attribution: string;
  maxZoom?: number;
  subdomains?: string;
}

export const NIACARE_MAP_TILE_LAYERS: TileLayerConfig[] = [
  {
    id: 'osm',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
    subdomains: 'abc',
  },
];

// No free, keyless dark-styled basemap exists (this is the same reason the
// reference project gates its dark tiles behind a MapTiler key) — dark
// mode reuses the same real OSM tiles with a CSS filter applied by the
// caller (FacilityMapModal wraps the tile pane in .nc-map-dark-tiles),
// rather than shipping a second, less-detailed provider just for dark
// mode, or requiring an API key this app doesn't have configured.
export const NIACARE_MAP_TILE_LAYERS_DARK: TileLayerConfig[] = NIACARE_MAP_TILE_LAYERS;

// Satellite imagery — Esri World Imagery, a long-standing free, keyless
// public tile service (unlike CARTO's raster basemaps, its terms have not
// required a key), used the same way the reference project uses it as its
// own keyless satellite fallback.
export const NIACARE_SATELLITE_LAYER: TileLayerConfig = {
  id: 'esri-world-imagery',
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics',
  // Esri's free imagery only has true high-resolution captures up to ~z17
  // in most non-urban areas; past that it silently serves an upscaled/
  // placeholder tile rather than 404ing, so capping maxNativeZoom here
  // makes Leaflet upscale the last real tile at deeper zooms instead of
  // requesting one that doesn't meaningfully exist for rural Tanzania.
  maxZoom: 19,
};

export const NIACARE_SATELLITE_LABELS_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';
