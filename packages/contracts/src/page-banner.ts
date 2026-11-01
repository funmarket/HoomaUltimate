import { z } from "zod";

export const PAGE_BANNER_PLACEMENT_IDS = [
  "HOME_TOP",
  "PLAY_TOP",
  "WATCH_TOP",
  "HOOMA_TOP",
  "TEAMS_TOP",
  "PITCH_TOP",
  "PLACES_TOP",
  "REQUESTS_TOP",
  "GEAR_UP_TOP",
  "RIDE_TOP",
  "ATHLETES_TOP",
] as const;

export const PAGE_BANNER_MAX_SLIDES = 3;
export const PAGE_BANNER_MAX_BYTES = 5 * 1024 * 1024;
export const PAGE_BANNER_RECONCILE_TOPIC = "page-banner.reconcile-object";
export const PAGE_BANNER_CLEANUP_TOPIC = "page-banner.cleanup-object";
export const PAGE_BANNER_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const pageBannerPlacementIdSchema = z.enum(PAGE_BANNER_PLACEMENT_IDS);
export const pageBannerDestinationSchema = z
  .object({
    kind: z.enum(["INTERNAL", "EXTERNAL"]),
    url: z.string().trim().min(1).max(2000),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.kind === "EXTERNAL") {
      let parsed: URL;
      try {
        parsed = new URL(value.url);
      } catch {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "External URL is invalid" });
        return;
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "External URL must use http or https",
        });
      }
      if (parsed.username || parsed.password) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "External URL cannot contain credentials",
        });
      }
    }
  });

export const pageBannerSlideMetadataSchema = z
  .object({
    enabled: z.boolean().optional(),
    isDecorative: z.boolean().default(false),
    altText: z.string().trim().max(500).optional().nullable(),
    destination: pageBannerDestinationSchema.optional().nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.isDecorative && !value.altText?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["altText"],
        message: "Informational banners require alt text",
      });
    }
    if (value.isDecorative && value.altText?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["altText"],
        message: "Decorative banners must not provide alt text",
      });
    }
  });

export const pageBannerPlacementToggleSchema = z.object({ enabled: z.boolean() }).strict();
export const pageBannerReorderSchema = z
  .object({ slideIds: z.array(z.string().trim().min(1)).min(1).max(PAGE_BANNER_MAX_SLIDES) })
  .strict();
export const pageBannerReconcilePayloadSchema = z
  .object({
    placementId: pageBannerPlacementIdSchema,
    mediaId: z.string().trim().min(1),
    objectKeys: z.array(z.string().trim().min(1)).min(1).max(3),
  })
  .strict();

export const pageBannerCleanupPayloadSchema = z
  .object({
    placementId: pageBannerPlacementIdSchema,
    slideId: z.string().trim().min(1),
    mediaId: z.string().trim().min(1),
    objectKeys: z.array(z.string().trim().min(1)).min(1).max(3),
  })
  .strict();

export type PageBannerPlacementId = z.infer<typeof pageBannerPlacementIdSchema>;
export type PageBannerDestination = z.infer<typeof pageBannerDestinationSchema>;
export type PageBannerSlideMetadata = z.infer<typeof pageBannerSlideMetadataSchema>;
