import { Buffer } from "node:buffer";
import { Router, raw } from "express";
import {
  gearUpListQuerySchema,
  gearUpProductCreateSchema,
  gearUpProductExternalImageInputSchema,
  gearUpProductImageOrderSchema,
  gearUpProductUpdateSchema,
  gearUpShopSuggestionSchema,
  gearUpShopUpdateSchema,
} from "@hooma/contracts/gear-up";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import { getAuth } from "../../identity/http/auth-request.js";
import type { GearUpProductMediaService } from "../application/gear-up-product-media.service.js";
import type { GearUpProductService } from "../application/gear-up-product.service.js";
import type { GearUpService } from "../application/gear-up.service.js";
import type { GearUpSettingsService } from "../application/gear-up-settings.service.js";

export function createGearUpPublicRouter(
  shops: GearUpService,
  products: GearUpProductService,
  media: GearUpProductMediaService,
): Router {
  const router = Router();

  router.get(
    "/",
    asyncHandler(async (request, response) => {
      response.json(await shops.listPublic(gearUpListQuerySchema.parse(request.query)));
    }),
  );

  router.get(
    "/shops/:placeId/products",
    asyncHandler(async (request, response) => {
      response.json(await products.listPublicByShop(String(request.params.placeId)));
    }),
  );

  router.get(
    "/shops/:placeId",
    asyncHandler(async (request, response) => {
      response.json(await shops.getPublic(String(request.params.placeId)));
    }),
  );

  router.get(
    "/products/:productId/images/:imageId/delivery",
    asyncHandler(async (request, response) => {
      response.setHeader("cache-control", "private, no-store");
      response.json(
        await media.deliveryPublic(String(request.params.productId), String(request.params.imageId)),
      );
    }),
  );

  router.get(
    "/products/:productId/images",
    asyncHandler(async (request, response) => {
      response.json(await media.listPublic(String(request.params.productId)));
    }),
  );

  router.get(
    "/products/:productId",
    asyncHandler(async (request, response) => {
      response.json(await products.getPublic(String(request.params.productId)));
    }),
  );

  return router;
}

export function createGearUpMemberRouter(
  shops: GearUpService,
  products: GearUpProductService,
  media: GearUpProductMediaService,
  settings: GearUpSettingsService,
): Router {
  const router = Router();

  router.get(
    "/settings",
    asyncHandler(async (_request, response) => {
      response.json(await settings.get());
    }),
  );

  router.post(
    "/shops",
    asyncHandler(async (request, response) => {
      const result = await shops.suggest(
        getAuth(request).userId,
        gearUpShopSuggestionSchema.parse(request.body),
      );
      response.status(result.outcome === "CREATED" ? 201 : 200).json(result);
    }),
  );

  router.get(
    "/shops/:placeId/manage",
    asyncHandler(async (request, response) => {
      response.json(
        await shops.getManaged(getAuth(request).userId, String(request.params.placeId)),
      );
    }),
  );

  router.patch(
    "/shops/:placeId",
    asyncHandler(async (request, response) => {
      response.json(
        await shops.updateShop(
          getAuth(request).userId,
          String(request.params.placeId),
          gearUpShopUpdateSchema.parse(request.body),
        ),
      );
    }),
  );

  router.get(
    "/shops/:placeId/products/manage",
    asyncHandler(async (request, response) => {
      response.json(
        await products.listManagedByShop(getAuth(request).userId, String(request.params.placeId)),
      );
    }),
  );

  router.post(
    "/shops/:placeId/products",
    asyncHandler(async (request, response) => {
      response
        .status(201)
        .json(
          await products.create(
            getAuth(request).userId,
            String(request.params.placeId),
            gearUpProductCreateSchema.parse(request.body),
          ),
        );
    }),
  );

  router.patch(
    "/shops/:placeId/products/:productId",
    asyncHandler(async (request, response) => {
      response.json(
        await products.update(
          getAuth(request).userId,
          String(request.params.placeId),
          String(request.params.productId),
          gearUpProductUpdateSchema.parse(request.body),
        ),
      );
    }),
  );

  router.post(
    "/shops/:placeId/products/:productId/feature",
    asyncHandler(async (request, response) => {
      response.json(
        await products.feature(
          getAuth(request).userId,
          String(request.params.placeId),
          String(request.params.productId),
        ),
      );
    }),
  );

  router.post(
    "/shops/:placeId/products/:productId/unfeature",
    asyncHandler(async (request, response) => {
      response.json(
        await products.unfeature(
          getAuth(request).userId,
          String(request.params.placeId),
          String(request.params.productId),
        ),
      );
    }),
  );

  router.post(
    "/shops/:placeId/products/:productId/archive",
    asyncHandler(async (request, response) => {
      response.json(
        await products.archive(
          getAuth(request).userId,
          String(request.params.placeId),
          String(request.params.productId),
        ),
      );
    }),
  );

  router.post(
    "/shops/:placeId/products/:productId/restore",
    asyncHandler(async (request, response) => {
      response.json(
        await products.restore(
          getAuth(request).userId,
          String(request.params.placeId),
          String(request.params.productId),
        ),
      );
    }),
  );

  router.get(
    "/shops/:placeId/products/:productId/images",
    asyncHandler(async (request, response) => {
      response.json(
        await media.listManaged(
          getAuth(request).userId,
          String(request.params.placeId),
          String(request.params.productId),
        ),
      );
    }),
  );

  router.post(
    "/shops/:placeId/products/:productId/images/external",
    asyncHandler(async (request, response) => {
      response
        .status(201)
        .json(
          await media.addExternalUrl(
            getAuth(request).userId,
            String(request.params.placeId),
            String(request.params.productId),
            gearUpProductExternalImageInputSchema.parse(request.body),
          ),
        );
    }),
  );

  router.post(
    "/shops/:placeId/products/:productId/images/upload",
    raw({ type: "*/*", limit: "5mb" }),
    asyncHandler(async (request, response) => {
      const body = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
      response
        .status(201)
        .json(
          await media.addUpload(
            getAuth(request).userId,
            String(request.params.placeId),
            String(request.params.productId),
            {
              contentType: request.get("content-type") ?? "",
              body,
            },
          ),
        );
    }),
  );

  router.put(
    "/shops/:placeId/products/:productId/images/order",
    asyncHandler(async (request, response) => {
      response.json(
        await media.reorder(
          getAuth(request).userId,
          String(request.params.placeId),
          String(request.params.productId),
          gearUpProductImageOrderSchema.parse(request.body),
        ),
      );
    }),
  );

  router.get(
    "/shops/:placeId/products/:productId/images/:imageId/delivery",
    asyncHandler(async (request, response) => {
      response.setHeader("cache-control", "private, no-store");
      response.json(
        await media.deliveryManaged(
          getAuth(request).userId,
          String(request.params.placeId),
          String(request.params.productId),
          String(request.params.imageId),
        ),
      );
    }),
  );

  router.delete(
    "/shops/:placeId/products/:productId/images/:imageId",
    asyncHandler(async (request, response) => {
      await media.delete(
        getAuth(request).userId,
        String(request.params.placeId),
        String(request.params.productId),
        String(request.params.imageId),
      );
      response.json({ ok: true });
    }),
  );

  return router;
}
