type RideMapPreviewCoordinates = {
  readonly latitude: number;
  readonly longitude: number;
};

export interface RideMapPreviewInput {
  readonly badge: string;
  readonly title: string;
  readonly subtitle: string;
  readonly callout: string;
  readonly privacyNote: string;
  readonly coordinates?: RideMapPreviewCoordinates | null;
}

export function renderRideMapPreviewSvg(input: RideMapPreviewInput): string {
  const point = input.coordinates
    ? projectPoint(input.coordinates.latitude, input.coordinates.longitude)
    : { x: 68, y: 40 };
  const routeStart = input.coordinates ? { x: 18, y: 78 } : { x: 18, y: 74 };
  const routePath = `M ${routeStart.x} ${routeStart.y} C ${routeStart.x + 18} ${routeStart.y - 8}, ${point.x - 14} ${point.y + 10}, ${point.x} ${point.y}`;
  const coordinateLabel = input.coordinates
    ? `Coordinates ${formatCoordinate(input.coordinates.latitude)}, ${formatCoordinate(input.coordinates.longitude)}`
    : "Approximate public preview";
  const pinLabel = input.coordinates ? input.callout : input.callout;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-labelledby="title desc">
  <title>${escapeXml(input.title)}</title>
  <desc>${escapeXml(input.subtitle)}. ${escapeXml(input.privacyNote)}</desc>
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#0c1110" />
      <stop offset="100%" stop-color="#15110d" />
    </linearGradient>
    <linearGradient id="panel" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#191715" />
      <stop offset="100%" stop-color="#090807" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.55" />
    </filter>
  </defs>
  <rect x="0" y="0" width="100" height="100" rx="14" fill="url(#bg)" />
  <g opacity="0.5" stroke="#f1d081" stroke-opacity="0.18">
    <path d="M 8 18 H 92" />
    <path d="M 8 34 H 92" />
    <path d="M 8 50 H 92" />
    <path d="M 8 66 H 92" />
    <path d="M 8 82 H 92" />
    <path d="M 18 10 V 90" />
    <path d="M 36 10 V 90" />
    <path d="M 54 10 V 90" />
    <path d="M 72 10 V 90" />
    <path d="M 90 10 V 90" />
  </g>
  <path d="${routePath}" fill="none" stroke="#c7f46b" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="0" />
  <circle cx="${routeStart.x}" cy="${routeStart.y}" r="3.2" fill="#d9bf71" opacity="0.92" />
  <g filter="url(#shadow)">
    <circle cx="${point.x}" cy="${point.y}" r="7.2" fill="#e1b34e" opacity="0.22" />
    <path d="M ${point.x} ${point.y - 8} C ${point.x + 4.4} ${point.y - 8}, ${point.x + 8.4} ${point.y - 4.2}, ${point.x + 8.4} ${point.y + 0.7} C ${point.x + 8.4} ${point.y + 6.7}, ${point.x} ${point.y + 12.2}, ${point.x} ${point.y + 18} C ${point.x} ${point.y + 12.2}, ${point.x - 8.4} ${point.y + 6.7}, ${point.x - 8.4} ${point.y + 0.7} C ${point.x - 8.4} ${point.y - 4.2}, ${point.x - 4.4} ${point.y - 8}, ${point.x} ${point.y - 8} Z" fill="#f0cb73" stroke="#090807" stroke-width="1.2" />
    <circle cx="${point.x}" cy="${point.y - 0.9}" r="2.6" fill="#090807" />
  </g>
  <rect x="8" y="8" width="46" height="12" rx="6" fill="url(#panel)" stroke="#f1d081" stroke-opacity="0.32" />
  <text x="11" y="16" fill="#f0cb73" font-size="4.2" font-weight="700" letter-spacing="0.08em">${escapeXml(input.badge)}</text>
  <rect x="8" y="74" width="84" height="18" rx="9" fill="rgba(0,0,0,0.58)" stroke="#f1d081" stroke-opacity="0.18" />
  <text x="12" y="81" fill="#faf6ea" font-size="4.9" font-weight="700">${escapeXml(input.title)}</text>
  <text x="12" y="87.5" fill="#d7dbd6" font-size="3.4">${escapeXml(input.subtitle)}</text>
  <text x="12" y="93" fill="#d7dbd6" font-size="3.1">${escapeXml(input.privacyNote)}</text>
  <text x="58" y="61" fill="#d9bf71" font-size="3.4" font-weight="700" text-anchor="middle">${escapeXml(pinLabel)}</text>
  <text x="58" y="67" fill="#9ea7a0" font-size="2.8" text-anchor="middle">${escapeXml(coordinateLabel)}</text>
</svg>`;
}

function projectPoint(latitude: number, longitude: number): { x: number; y: number } {
  const x = clamp(50 + longitude * 1.35, 14, 86);
  const y = clamp(50 - latitude * 0.9, 14, 78);
  return { x, y };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatCoordinate(value: number): string {
  return value.toFixed(5);
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
