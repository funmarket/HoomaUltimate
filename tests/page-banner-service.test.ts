import assert from "node:assert/strict";
import test from "node:test";
import { PageBannerService } from "../apps/api/src/modules/page-banner/application/page-banner.service.ts";
import type { PageBannerRepository } from "../apps/api/src/modules/page-banner/application/page-banner.repository.ts";

test("public artwork version follows replacement media rather than the retained slide id", async () => {
  let mediaId = "artwork-one";
  let enabled = true;
  const repository = {
    async get() {
      return {
        id: "HOME_TOP",
        enabled,
        slides: [
          {
            id: "retained-slide",
            placementId: "HOME_TOP",
            mediaId,
            sortOrder: 0,
            enabled: true,
            isDecorative: true,
            altText: null,
            destinationKind: null,
            destinationUrl: null,
            variants: [
              {
                variant: "mobile",
                objectKey: `private/${mediaId}`,
                contentType: "image/webp",
                sizeBytes: 100,
                widthPx: 720,
                heightPx: 300,
              },
            ],
          },
        ],
      };
    },
  } as unknown as PageBannerRepository;
  const storage = { createReadUrl: async () => "https://media.test/signed" };
  const service = new PageBannerService(repository, {} as never, storage as never, "staging");
  const first = await service.publicRead("HOME_TOP");
  assert.equal(first.slides[0]?.artworkVersion, "artwork-one");
  assert.equal((await service.publicRead("HOME_TOP")).slides[0]?.artworkVersion, "artwork-one");
  mediaId = "artwork-two";
  const replaced = await service.publicRead("HOME_TOP");
  assert.equal(replaced.slides[0]?.id, "retained-slide");
  assert.equal(replaced.slides[0]?.artworkVersion, "artwork-two");
  assert.equal(JSON.stringify(replaced).includes("private/"), false);
  enabled = false;
  assert.deepEqual((await service.publicRead("HOME_TOP")).slides, []);
});
