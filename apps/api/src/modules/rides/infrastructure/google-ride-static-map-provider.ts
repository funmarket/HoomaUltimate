import type {
  RideMapPreviewCoordinates,
  RideMapPreviewImage,
  RideStaticMapProvider,
} from "../application/ride-map-preview.js";

type Fetcher = typeof fetch;

export interface GoogleRideStaticMapProviderOptions {
  readonly apiKey: string;
  readonly fetcher?: Fetcher;
}

const STATIC_MAP_URL = "https://maps.googleapis.com/maps/api/staticmap";
const STATIC_MAP_SIZE = "640x360";
const STATIC_MAP_SCALE = "2";
const PUBLIC_DESTINATION_ZOOM = "13";
const PRIVATE_MEETING_POINT_ZOOM = "16";
const PUBLIC_MARKER_COLOR = "0xd9bf71";
const PRIVATE_MARKER_COLOR = "green";
const FETCH_TIMEOUT_MS = 4500;

export class GoogleRideStaticMapProvider implements RideStaticMapProvider {
  private readonly fetcher: Fetcher;

  constructor(private readonly options: GoogleRideStaticMapProviderOptions) {
    this.fetcher = options.fetcher ?? fetch;
  }

  async renderPublicDestinationMap(input: {
    readonly searchText: string;
  }): Promise<RideMapPreviewImage | null> {
    const searchText = input.searchText.trim();
    if (!searchText) return null;

    return this.renderStaticMap(
      searchText,
      PUBLIC_DESTINATION_ZOOM,
      PUBLIC_MARKER_COLOR,
    );
  }

  async renderPrivateMeetingPointMap(input: {
    readonly coordinates: RideMapPreviewCoordinates | null;
  }): Promise<RideMapPreviewImage | null> {
    if (!input.coordinates) return null;
    if (
      !Number.isFinite(input.coordinates.latitude) ||
      !Number.isFinite(input.coordinates.longitude)
    ) {
      return null;
    }

    const center = `${input.coordinates.latitude},${input.coordinates.longitude}`;
    return this.renderStaticMap(
      center,
      PRIVATE_MEETING_POINT_ZOOM,
      PRIVATE_MARKER_COLOR,
    );
  }

  private async renderStaticMap(
    center: string,
    zoom: string,
    markerColor: string,
  ): Promise<RideMapPreviewImage | null> {
    const url = new URL(STATIC_MAP_URL);
    url.searchParams.set("center", center);
    url.searchParams.set("zoom", zoom);
    url.searchParams.set("size", STATIC_MAP_SIZE);
    url.searchParams.set("scale", STATIC_MAP_SCALE);
    url.searchParams.set("maptype", "roadmap");
    url.searchParams.set("markers", `color:${markerColor}|${center}`);
    url.searchParams.set("key", this.options.apiKey);

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
      return await this.fetcher(url, { signal: controller.signal });
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
