import type {
  ManagedPlaceSummary,
  PlaceExternalImageInput,
  PlaceImageOrderInput,
  PlaceOwnershipClaimInput,
  PlaceSuggestionInput,
  PlaceSuggestionResult,
  PlaceUpdateInput,
  PublicPlaceImage,
  PublicPlaceSummary,
} from "@hooma/contracts/places";
import { request, requestBinary, type HoomaTransport } from "../http";

function mediaUrl(transport: HoomaTransport, value: string | null): string | null {
  if (!value || !value.startsWith("/api/")) return value;
  return `${transport.baseUrl}${value}`;
}

export function normalizePlaceMedia<T extends PublicPlaceSummary>(
  transport: HoomaTransport,
  place: T,
): T {
  return {
    ...place,
    imageUrl: mediaUrl(transport, place.imageUrl),
    images: place.images.map((image) => ({
      ...image,
      imageUrl: mediaUrl(transport, image.imageUrl) ?? image.imageUrl,
    })),
  } as T;
}

function normalizeImage(transport: HoomaTransport, image: PublicPlaceImage): PublicPlaceImage {
  return { ...image, imageUrl: mediaUrl(transport, image.imageUrl) ?? image.imageUrl };
}

export function createPlacesApi(transport: HoomaTransport) {
  return {
    list: async () =>
      (await request<PublicPlaceSummary[]>(transport, "/api/public/v1/places")).map((place) =>
        normalizePlaceMedia(transport, place),
      ),
    get: async (placeId: string) =>
      normalizePlaceMedia(
        transport,
        await request<PublicPlaceSummary>(
          transport,
          `/api/public/v1/places/${encodeURIComponent(placeId)}`,
        ),
      ),
    manage: async (placeId: string) =>
      normalizePlaceMedia(
        transport,
        await request<ManagedPlaceSummary>(
          transport,
          `/api/v1/places/${encodeURIComponent(placeId)}/manage`,
        ),
      ),
    ownershipStatus: (placeId: string) =>
      request<{ verified: boolean }>(
        transport,
        `/api/v1/places/${encodeURIComponent(placeId)}/ownership-status`,
      ),
    suggest: async (input: PlaceSuggestionInput) => {
      const result = await request<PlaceSuggestionResult>(transport, "/api/v1/places", {
        method: "POST",
        body: JSON.stringify(input),
      });
      return { ...result, place: normalizePlaceMedia(transport, result.place) };
    },
    update: async (placeId: string, input: PlaceUpdateInput) =>
      normalizePlaceMedia(
        transport,
        await request<ManagedPlaceSummary>(
          transport,
          `/api/v1/places/${encodeURIComponent(placeId)}`,
          { method: "PATCH", body: JSON.stringify(input) },
        ),
      ),
    archive: (placeId: string) =>
      request<{ ok: true }>(transport, `/api/v1/places/${encodeURIComponent(placeId)}`, {
        method: "DELETE",
      }),
    addExternalImage: async (placeId: string, input: PlaceExternalImageInput) =>
      normalizeImage(
        transport,
        await request<PublicPlaceImage>(
          transport,
          `/api/v1/places/${encodeURIComponent(placeId)}/images/external`,
          { method: "POST", body: JSON.stringify(input) },
        ),
      ),
    uploadImage: async (placeId: string, file: File) =>
      normalizeImage(
        transport,
        await requestBinary<PublicPlaceImage>(
          transport,
          `/api/v1/places/${encodeURIComponent(placeId)}/images/upload`,
          file,
          file.type,
          { method: "POST" },
        ),
      ),
    reorderImages: (placeId: string, input: PlaceImageOrderInput) =>
      request<PublicPlaceImage[]>(
        transport,
        `/api/v1/places/${encodeURIComponent(placeId)}/images/order`,
        { method: "PUT", body: JSON.stringify(input) },
      ),
    deleteImage: (placeId: string, imageId: string) =>
      request<{ ok: true }>(
        transport,
        `/api/v1/places/${encodeURIComponent(placeId)}/images/${encodeURIComponent(imageId)}`,
        { method: "DELETE" },
      ),
    claimOwnership: (placeId: string, input: PlaceOwnershipClaimInput) =>
      request<{ id: string; status: string }>(
        transport,
        `/api/v1/places/${encodeURIComponent(placeId)}/ownership-claims`,
        { method: "POST", body: JSON.stringify(input) },
      ),
  };
}
