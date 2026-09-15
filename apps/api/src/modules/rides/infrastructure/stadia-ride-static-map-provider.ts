import type {
  RideMapPreviewCoordinates,
  RideMapPreviewImage,
  RideStaticMapProvider,
} from "../application/ride-map-preview.js";

type Fetcher = typeof fetch;

type StadiaGeocodeFeature = {
  readonly geometry?: {
    readonly coordinates?: readonly [number, number] | readonly number[];
  };
};

type StadiaGeocodeResponse = {
  readonly features?: readonly StadiaGeocodeFeature[];
};

export interface StadiaRideStaticMapProviderOptions {
  readonly apiKey: string;
  readonly style?: string;
  readonly fetcher?: Fetcher;
}

const STADIA_API_BASE_URL = "https://api.stadiamaps.com";
const STADIA_TILES_BASE_URL = "https://tiles.stadiamaps.com";
const DEFAULT_STYLE = "alidade_smooth_dark";
const STATIC_MAP_SIZE = "640x360@2x";
const PUBLIC_DESTINATION_ZOOM = "13";
const PRIVATE_MEETING_POINT_ZOOM = "16";
const FETCH_TIMEOUT_MS = 4500;

export class StadiaRideStaticMapProvider implements RideStaticMapProvider {
  private readonly style: string;
  private readonly fetcher: Fetcher;

  constructor(private readonly options: StadiaRideStaticMapProviderOptions) {
    this.style = options.style?.trim() || DEFAULT_STYLE;
    this.fetcher = options.fetcher ?? fetch;
  }

  async renderPublicDestinationMap(input: {
    readonly searchText: string;
  }): Promise<RideMapPreviewImage | null> {
    const coordinates = await this.geocode(input.searchText);
    if (!coordinates) return null;
    return this.renderStaticMap(coordinates, PUBLIC_DESTINATION_ZOOM, "d9bf71");
  }

  async renderPrivateMeetingPointMap(input: {
    readonly coordinates: RideMapPreviewCoordinates | null;
  }): Promise<RideMapPreviewImage | null> {
    if (!input.coordinates) return null;
    return this.renderStaticMap(input.coordinates, PRIVATE_MEETING_POINT_ZOOM, "c7f46b");
  }

  private async geocode(searchText: string): Promise<RideMapPreviewCoordinates | null> {
    const text = searchText.trim();
    if (!text) return null;

    const url = new URL("/geocoding/v1/search", STADIA_API_BASE_URL);
    url.searchParams.set("text", text);
    url.searchParams.set("size", "1");
    const response = await this.request(url);
    if (!response?.ok) return null;

    const payload = (await response.json()) as StadiaGeocodeResponse;
    const coordinates = payload.features?.[0]?.geometry?.coordinates;
    const longitude = coordinates?.[0];
    const latitude = coordinates?.[1];
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude: Number(latitude), longitude: Number(longitude) };
  }

  private async renderStaticMap(
    coordinates: RideMapPreviewCoordinates,
    zoom: string,
    markerColor: string,
  ): Promise<RideMapPreviewImage | null> {
    const url = new URL(`/static/${encodeURIComponent(this.style)}.png`, STADIA_TILES_BASE_URL);
    const center = `${coordinates.latitude},${coordinates.longitude}`;
    url.searchParams.set("center", center);
    url.searchParams.set("zoom", zoom);
    url.searchParams.set("size", STATIC_MAP_SIZE);
    url.searchParams.append("m", `${center},,${markerColor}`);

    const response = await this.request(url);
    if (!response?.ok) return null;

    const contentType = response.headers.get("content-type") ?? "image/png";
    if (!contentType.startsWith("image/")) return null;

    return {
      contentType,
      body: new Uint8Array(await response.arrayBuffer()),
    };
  }

  private async request(url: URL): Promise<Response | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      return await this.fetcher(url, {
        headers: { authorization: `Stadia-Auth ${this.options.apiKey}` },
        signal: controller.signal,
      });
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
