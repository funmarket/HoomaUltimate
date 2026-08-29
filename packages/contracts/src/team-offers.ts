import { z } from "zod";

export const teamPlayerOfferStatusSchema = z.enum(["PENDING", "ACCEPTED", "DECLINED"]);

export type TeamPlayerOfferStatus = z.infer<typeof teamPlayerOfferStatusSchema>;
