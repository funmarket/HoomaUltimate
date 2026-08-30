import { randomUUID } from "node:crypto";
import type {
  PlaceDuplicateMatch,
  PlaceSubmissionOrigin,
  PlaceSuggestionInput,
  PlaceSuggestionResult,
  PublicPlaceImage,
  PublicPlaceSummary,
} from "@hooma/contracts/places";
import { Prisma } from "@hooma/database";
import { normalizeExternalPlaceImageUrl } from "./external-place-image-url.js";

const OWNER_SUBMISSION_CLAIM_EVIDENCE = "Ownership asserted during Place submission";

type PlaceCreateInput = Omit<PlaceSuggestionInput, "submissionOrigin">;
type PlaceIdentityInput = Pick<
  PlaceCreateInput,
  "name" | "address" | "phone" | "websiteUrl" | "latitude" | "longitude"
>;

export const canonicalPlaceSelect = Prisma.validator<Prisma.PlaceSelect>()({
  id: true,
  slug: true,
  name: true,
  address: true,
  city: true,
  houma: true,
  latitude: true,
  longitude: true,
  phone: true,
  websiteUrl: true,
  description: true,
  category: true,
  email: true,
  submissionOrigin: true,
  menuItems: {
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, name: true, price: true, currency: true },
  },
});

export type CanonicalPlaceRow = Prisma.PlaceGetPayload<{ select: typeof canonicalPlaceSelect }>;
export type CanonicalPlaceImageRow = {
  id: string;
  placeId: string;
  imageUrl: string;
  sortOrder: number;
};

function slugBase(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "place"
  );
}

function normalizeIdentityText(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function canonicalPhone(value: string | null | undefined): string | null {
  const digits = value?.replace(/[^0-9]/g, "") ?? "";
  return digits || null;
}

function canonicalWebsite(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value
    .trim()
    .replace(/^https?:\/\/(?:www\.)?/i, "")
    .replace(/\/+$/, "")
    .toLocaleLowerCase();
  return normalized || null;
}

function duplicateLockKeys(input: PlaceIdentityInput): string[] {
  const keys = [
    `place:name-address:${normalizeIdentityText(input.name)}|${normalizeIdentityText(input.address)}`,
  ];
  const phone = canonicalPhone(input.phone);
  const website = canonicalWebsite(input.websiteUrl);
  if (phone) keys.push(`place:phone:${phone}`);
  if (website) keys.push(`place:website:${website}`);
  if (input.latitude != null && input.longitude != null) {
    keys.push(
      `place:name-coordinates:${normalizeIdentityText(input.name)}|${input.latitude.toFixed(7)}|${input.longitude.toFixed(7)}`,
    );
  }
  return [...new Set(keys)].sort();
}

export async function lockCanonicalPlaceIdentity(
  tx: Prisma.TransactionClient,
  input: PlaceIdentityInput,
) {
  for (const key of duplicateLockKeys(input)) {
    await tx.$queryRaw<Array<{ locked: string }>>(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${key}))::text AS "locked"`,
    );
  }
}

export async function findCanonicalPlaceDuplicate(
  tx: Prisma.TransactionClient,
  input: PlaceIdentityInput,
  excludePlaceId?: string,
): Promise<{ id: string; matchedBy: PlaceDuplicateMatch } | null> {
  const normalizedName = normalizeIdentityText(input.name);
  const normalizedAddress = normalizeIdentityText(input.address);
  const phone = canonicalPhone(input.phone);
  const website = canonicalWebsite(input.websiteUrl);
  const exclude = excludePlaceId
    ? Prisma.sql`AND "id" <> ${excludePlaceId}`
    : Prisma.sql``;

  const nameAddress = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      SELECT "id"
      FROM "Place"
      WHERE "moderationStatus" IN ('PENDING', 'APPROVED')
        ${exclude}
        AND lower(regexp_replace(btrim("name"), '[[:space:]]+', ' ', 'g')) = ${normalizedName}
        AND lower(regexp_replace(btrim("address"), '[[:space:]]+', ' ', 'g')) = ${normalizedAddress}
      ORDER BY "createdAt" ASC, "id" ASC
      LIMIT 1
    `,
  );
  if (nameAddress[0]) return { id: nameAddress[0].id, matchedBy: "NAME_ADDRESS" };

  if (phone) {
    const phoneMatch = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT "id"
        FROM "Place"
        WHERE "moderationStatus" IN ('PENDING', 'APPROVED')
          ${exclude}
          AND "phone" IS NOT NULL
          AND regexp_replace("phone", '[^0-9]', '', 'g') = ${phone}
        ORDER BY "createdAt" ASC, "id" ASC
        LIMIT 1
      `,
    );
    if (phoneMatch[0]) return { id: phoneMatch[0].id, matchedBy: "PHONE" };
  }

  if (website) {
    const websiteMatch = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT "id"
        FROM "Place"
        WHERE "moderationStatus" IN ('PENDING', 'APPROVED')
          ${exclude}
          AND "websiteUrl" IS NOT NULL
          AND lower(
            regexp_replace(
              regexp_replace(btrim("websiteUrl"), '^https?://(www[.])?', '', 'i'),
              '/+$',
              ''
            )
          ) = ${website}
        ORDER BY "createdAt" ASC, "id" ASC
        LIMIT 1
      `,
    );
    if (websiteMatch[0]) return { id: websiteMatch[0].id, matchedBy: "WEBSITE" };
  }

  if (input.latitude != null && input.longitude != null) {
    const latitude = new Prisma.Decimal(input.latitude);
    const longitude = new Prisma.Decimal(input.longitude);
    const coordinateMatch = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT "id"
        FROM "Place"
        WHERE "moderationStatus" IN ('PENDING', 'APPROVED')
          ${exclude}
          AND "latitude" = ${latitude}
          AND "longitude" = ${longitude}
          AND lower(regexp_replace(btrim("name"), '[[:space:]]+', ' ', 'g')) = ${normalizedName}
        ORDER BY "createdAt" ASC, "id" ASC
        LIMIT 1
      `,
    );
    if (coordinateMatch[0]) {
      return { id: coordinateMatch[0].id, matchedBy: "NAME_COORDINATES" };
    }
  }

  return null;
}

export function canonicalPlaceSummary(
  place: CanonicalPlaceRow,
  images: readonly CanonicalPlaceImageRow[] = [],
): PublicPlaceSummary {
  const publicImages: PublicPlaceImage[] = images.map((image) => ({
    id: image.id,
    imageUrl: normalizeExternalPlaceImageUrl(image.imageUrl),
    sortOrder: image.sortOrder,
  }));
  return {
    id: place.id,
    slug: place.slug,
    name: place.name,
    address: place.address,
    city: place.city,
    houma: place.houma,
    latitude: place.latitude?.toNumber() ?? null,
    longitude: place.longitude?.toNumber() ?? null,
    phone: place.phone,
    websiteUrl: place.websiteUrl,
    imageUrl: publicImages[0]?.imageUrl ?? null,
    images: publicImages,
    description: place.description,
    category: place.category,
    email: place.email,
    menuItems: place.menuItems.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price.toNumber(),
      currency: item.currency,
    })),
    submissionOrigin: place.submissionOrigin,
  };
}

export function groupCanonicalPlaceImages(
  rows: readonly CanonicalPlaceImageRow[],
): Map<string, CanonicalPlaceImageRow[]> {
  const grouped = new Map<string, CanonicalPlaceImageRow[]>();
  for (const row of rows) {
    const group = grouped.get(row.placeId) ?? [];
    group.push(row);
    grouped.set(row.placeId, group);
  }
  return grouped;
}

function menuCreate(input: PlaceCreateInput["menuItems"]) {
  return input.map((item, index) => ({
    name: item.name,
    price: new Prisma.Decimal(item.price),
    currency: item.currency.toUpperCase(),
    sortOrder: index,
  }));
}

function canonicalImageUrls(input: Pick<PlaceCreateInput, "imageUrl" | "imageUrls">): string[] {
  if (input.imageUrls.length) return input.imageUrls;
  return input.imageUrl ? [input.imageUrl] : [];
}

export function canonicalPlaceImageCreate(imageUrls: readonly string[]) {
  return imageUrls.slice(0, 4).map((imageUrl, sortOrder) => ({
    imageUrl: normalizeExternalPlaceImageUrl(imageUrl),
    sortOrder,
  }));
}

export async function suggestCanonicalPlace(
  tx: Prisma.TransactionClient,
  userId: string,
  input: PlaceCreateInput,
  submissionOrigin: PlaceSubmissionOrigin,
): Promise<PlaceSuggestionResult> {
  await lockCanonicalPlaceIdentity(tx, input);
  const duplicate = await findCanonicalPlaceDuplicate(tx, input);
  if (duplicate) {
    const existing = await tx.place.findUniqueOrThrow({
      where: { id: duplicate.id },
      select: { ...canonicalPlaceSelect, moderationStatus: true, archivedAt: true },
    });
    const images = await tx.placeImage.findMany({
      where: { placeId: existing.id },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    return {
      outcome: "EXISTING",
      place: canonicalPlaceSummary(existing, images),
      status: existing.moderationStatus,
      matchedBy: duplicate.matchedBy,
      archivedAt: existing.archivedAt?.toISOString() ?? null,
    };
  }

  const imageUrls = canonicalImageUrls(input);
  const place = await tx.place.create({
    data: {
      slug: `${slugBase(input.name)}-${randomUUID().slice(0, 8)}`,
      name: input.name,
      address: input.address,
      city: input.city ?? null,
      houma: input.houma ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      phone: input.phone ?? null,
      websiteUrl: input.websiteUrl ?? null,
      description: input.description ?? null,
      category: input.category ?? null,
      email: input.email ?? null,
      submissionOrigin,
      suggestedByUserId: userId,
      menuItems: { create: menuCreate(input.menuItems) },
      ...(submissionOrigin === "OWNER"
        ? {
            ownershipClaims: {
              create: {
                claimantUserId: userId,
                evidence: OWNER_SUBMISSION_CLAIM_EVIDENCE,
              },
            },
          }
        : {}),
    },
    select: { ...canonicalPlaceSelect, moderationStatus: true },
  });
  if (imageUrls.length) {
    await tx.placeImage.createMany({
      data: canonicalPlaceImageCreate(imageUrls).map((image) => ({ ...image, placeId: place.id })),
    });
  }
  const images = await tx.placeImage.findMany({
    where: { placeId: place.id },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  return {
    outcome: "CREATED",
    place: canonicalPlaceSummary(place, images),
    status: place.moderationStatus,
    matchedBy: null,
    archivedAt: null,
  };
}
