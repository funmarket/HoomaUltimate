import assert from "node:assert/strict";
import test from "node:test";
import { PlaceMediaService } from "../apps/api/src/modules/places/application/place-media.service.js";

function dependencies({
  admin = false,
  owner = true,
  count = 0,
}: {
  admin?: boolean;
  owner?: boolean;
  count?: number;
} = {}) {
  const images: Array<{ id: string; imageUrl: string; sortOrder: number }> = Array.from(
    { length: count },
    (_, index) => ({
      id: `existing-${index}`,
      imageUrl: `https://images.example.com/${index}.webp`,
      sortOrder: index,
    }),
  );
  const calls = { puts: [] as string[] };
  const places = {
    getApproved: async () => ({ id: "place-1" }),
    hasVerifiedOwnership: async () => owner,
    canManageOwnerMedia: async () => owner,
    getImage: async (_placeId: string, imageId: string) =>
      images.find((image) => image.id === imageId) ?? null,
    addImage: async (_placeId: string, imageId: string, imageUrl: string, maxImages: number) => {
      if (images.length >= maxImages) throw new Error("PLACE_IMAGE_LIMIT_REACHED");
      const image = { id: imageId, imageUrl, sortOrder: images.length };
      images.push(image);
      return image;
    },
    deleteImage: async () => null,
    reorderImages: async () => images,
  };
  const storage = {
    put: async (key: string) => {
      calls.puts.push(key);
      return { key, contentType: "image/webp", sizeBytes: 3 };
    },
    get: async () => {
      throw new Error("unused");
    },
    remove: async () => undefined,
    createReadUrl: async (key: string) => `https://signed.example.com/${key}`,
  };
  const service = new PlaceMediaService(
    places as never,
    { isPlatformAdmin: async () => admin } as never,
    { resolve: async (value: string) => value } as never,
    storage as never,
    { process: async () => ({ body: new Uint8Array([1, 2, 3]), contentType: "image/webp" }) },
  );
  return { service, images, calls };
}

test("verified owner accepts photos 1-3 and rejects the fourth", async () => {
  const { service, images } = dependencies({ owner: true, count: 2 });
  await service.addExternal("owner-1", "place-1", {
    url: "https://images.example.com/three.webp",
  });
  assert.equal(images.length, 3);
  await assert.rejects(
    () =>
      service.addExternal("owner-1", "place-1", {
        url: "https://images.example.com/four.webp",
      }),
    (error: unknown) => (error as { code?: string }).code === "PLACE_IMAGE_LIMIT_REACHED",
  );
});

test("App Admin may extend the same canonical gallery to six but not seven", async () => {
  const { service, images } = dependencies({ admin: true, owner: false, count: 5 });
  await service.addExternal("admin-1", "place-1", {
    url: "https://images.example.com/six.webp",
  });
  assert.equal(images.length, 6);
  await assert.rejects(
    () =>
      service.addExternal("admin-1", "place-1", {
        url: "https://images.example.com/seven.webp",
      }),
    (error: unknown) => (error as { code?: string }).code === "PLACE_IMAGE_LIMIT_REACHED",
  );
});

test("managed upload and external URL both create canonical gallery entries", async () => {
  const { service, images, calls } = dependencies();
  await service.addExternal("owner-1", "place-1", {
    url: "https://cdn.example.com/pitch.webp",
  });
  await service.addUpload("owner-1", "place-1", {
    contentType: "image/jpeg",
    body: new Uint8Array([9, 8, 7]),
  });
  assert.equal(images.length, 2);
  assert.equal(images[0]?.imageUrl, "https://cdn.example.com/pitch.webp");
  assert.match(
    images[1]?.imageUrl ?? "",
    /^\/api\/public\/v1\/places\/place-1\/images\/.+\/content$/,
  );
  assert.equal(calls.puts.length, 1);
  assert.match(calls.puts[0] ?? "", /^place-images\/place-1\//);
});
