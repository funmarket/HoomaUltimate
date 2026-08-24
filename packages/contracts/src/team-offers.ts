import { z } from "zod";

export const teamPlayerOfferCreateSchema = z.object({
  listingId: z.string().min(1),
  message: z.string().trim().max(240).optional().nullable(),
});

export const teamPlayerOfferStatusSchema = z.enum(["PENDING", "ACCEPTED", "DECLINED"]);

export type TeamPlayerOfferCreateInput = z.infer<typeof teamPlayerOfferCreateSchema>;
export type TeamPlayerOfferStatus = z.infer<typeof teamPlayerOfferStatusSchema>;
