import {
  GEAR_UP_GEAR_CATEGORIES,
  GEAR_UP_SPORTSWEAR_CATEGORIES,
  type GearUpProduct,
  type GearUpProductCreateInput,
  type GearUpProductDiscoveryPage,
  type GearUpProductDiscoveryQueryInput,
  type GearUpProductUpdateInput,
  type PublicGearUpProductListing,
} from "@hooma/contracts/gear-up";
import { Prisma, type PrismaClient } from "@hooma/database";
import type { GearUpProductRepository } from "../application/gear-up-product.repository.js";

const productSelect = Prisma.validator<Prisma.GearUpProductSelect>()({
  id: true,
  shopPlaceId: true,
  title: true,
  brand: true,
  description: true,
  sports: true,
  category: true,
  price: true,
  currency: true,
  featuredAt: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  images: {
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true },
    take: 1,
  },
});

type ProductRow = Prisma.GearUpProductGetPayload<{ select: typeof productSelect }>;

const productDiscoverySelect = Prisma.validator<Prisma.GearUpProductSelect>()({
  ...productSelect,
  shop: {
    select: {
      place: {
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          houma: true,
        },
      },
    },
  },
});

type ProductDiscoveryRow = Prisma.GearUpProductGetPayload<{
  select: typeof productDiscoverySelect;
}>;

function productRecord(row: ProductRow): GearUpProduct {
  return {
    id: row.id,
    shopPlaceId: row.shopPlaceId,
    title: row.title,
    brand: row.brand,
    description: row.description,
    sports: row.sports,
    category: row.category,
    price: row.price?.toNumber() ?? null,
    currency: row.currency,
    coverImageId: row.images[0]?.id ?? null,
    featuredAt: row.featuredAt?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function productListing(row: ProductDiscoveryRow): PublicGearUpProductListing {
  return {
    ...productRecord(row),
    shop: {
      placeId: row.shop.place.id,
      name: row.shop.place.name,
      address: row.shop.place.address,
      city: row.shop.place.city,
      houma: row.shop.place.houma,
    },
  };
}

export class PrismaGearUpProductRepository implements GearUpProductRepository {
  constructor(private readonly db: PrismaClient) {}

  async listPublic(input: GearUpProductDiscoveryQueryInput): Promise<GearUpProductDiscoveryPage> {
    const offerCategories =
      input.offer === "SPORTSWEAR"
        ? GEAR_UP_SPORTSWEAR_CATEGORIES
        : input.offer === "GEAR"
          ? GEAR_UP_GEAR_CATEGORIES
          : null;

    const rows = await this.db.gearUpProduct.findMany({
      where: {
        archivedAt: null,
        ...(input.q
          ? {
              OR: [
                { title: { contains: input.q, mode: "insensitive" } },
                { brand: { contains: input.q, mode: "insensitive" } },
                { description: { contains: input.q, mode: "insensitive" } },
                { shop: { place: { name: { contains: input.q, mode: "insensitive" } } } },
              ],
            }
          : {}),
        ...(input.sport ? { sports: { has: input.sport } } : {}),
        ...(input.category
          ? { category: input.category }
          : offerCategories
            ? { category: { in: [...offerCategories] } }
            : {}),
        ...(input.featured ? { featuredAt: { not: null } } : {}),
        shop: {
          moderationStatus: "APPROVED",
          place: {
            moderationStatus: "APPROVED",
            archivedAt: null,
            discoveries: { some: { kind: "GEAR_UP" } },
            ...(input.city ? { city: { equals: input.city, mode: "insensitive" } } : {}),
            ...(input.houma ? { houma: { equals: input.houma, mode: "insensitive" } } : {}),
          },
        },
      },
      select: productDiscoverySelect,
      orderBy: [{ featuredAt: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: input.limit + 1,
    });

    const hasMore = rows.length > input.limit;
    const items = rows.slice(0, input.limit).map(productListing);
    return {
      items,
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async listPublicByShop(placeId: string): Promise<readonly GearUpProduct[]> {
    const rows = await this.db.gearUpProduct.findMany({
      where: {
        shopPlaceId: placeId,
        archivedAt: null,
        shop: {
          moderationStatus: "APPROVED",
          place: {
            moderationStatus: "APPROVED",
            archivedAt: null,
            discoveries: { some: { kind: "GEAR_UP" } },
          },
        },
      },
      select: productSelect,
      orderBy: [{ featuredAt: "desc" }, { createdAt: "desc" }, { id: "asc" }],
    });
    return rows.map(productRecord);
  }

  async getPublic(productId: string): Promise<GearUpProduct | null> {
    const row = await this.db.gearUpProduct.findFirst({
      where: {
        id: productId,
        archivedAt: null,
        shop: {
          moderationStatus: "APPROVED",
          place: {
            moderationStatus: "APPROVED",
            archivedAt: null,
            discoveries: { some: { kind: "GEAR_UP" } },
          },
        },
      },
      select: productSelect,
    });
    return row ? productRecord(row) : null;
  }

  async listManagedByShop(placeId: string): Promise<readonly GearUpProduct[]> {
    const rows = await this.db.gearUpProduct.findMany({
      where: { shopPlaceId: placeId },
      select: productSelect,
      orderBy: [{ archivedAt: "asc" }, { featuredAt: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(productRecord);
  }

  async getManaged(productId: string): Promise<GearUpProduct | null> {
    const row = await this.db.gearUpProduct.findUnique({
      where: { id: productId },
      select: productSelect,
    });
    return row ? productRecord(row) : null;
  }

  async create(placeId: string, input: GearUpProductCreateInput): Promise<GearUpProduct> {
    const row = await this.db.gearUpProduct.create({
      data: {
        shopPlaceId: placeId,
        title: input.title,
        brand: input.brand ?? null,
        description: input.description,
        sports: input.sports,
        category: input.category,
        price: input.price == null ? null : new Prisma.Decimal(input.price),
        currency: input.currency.toUpperCase(),
      },
      select: productSelect,
    });
    return productRecord(row);
  }

  async update(productId: string, input: GearUpProductUpdateInput): Promise<GearUpProduct> {
    const row = await this.db.gearUpProduct.update({
      where: { id: productId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.brand !== undefined ? { brand: input.brand } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.sports !== undefined ? { sports: input.sports } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.price !== undefined
          ? { price: input.price == null ? null : new Prisma.Decimal(input.price) }
          : {}),
        ...(input.currency !== undefined ? { currency: input.currency.toUpperCase() } : {}),
      },
      select: productSelect,
    });
    return productRecord(row);
  }

  async feature(productId: string): Promise<GearUpProduct> {
    const existing = await this.db.gearUpProduct.findUniqueOrThrow({
      where: { id: productId },
      select: { featuredAt: true },
    });
    const row = existing.featuredAt
      ? await this.db.gearUpProduct.findUniqueOrThrow({
          where: { id: productId },
          select: productSelect,
        })
      : await this.db.gearUpProduct.update({
          where: { id: productId },
          data: { featuredAt: new Date() },
          select: productSelect,
        });
    return productRecord(row);
  }

  async unfeature(productId: string): Promise<GearUpProduct> {
    const row = await this.db.gearUpProduct.update({
      where: { id: productId },
      data: { featuredAt: null },
      select: productSelect,
    });
    return productRecord(row);
  }

  async archive(productId: string): Promise<GearUpProduct> {
    const existing = await this.db.gearUpProduct.findUniqueOrThrow({
      where: { id: productId },
      select: { archivedAt: true },
    });
    const row = existing.archivedAt
      ? await this.db.gearUpProduct.findUniqueOrThrow({
          where: { id: productId },
          select: productSelect,
        })
      : await this.db.gearUpProduct.update({
          where: { id: productId },
          data: { archivedAt: new Date() },
          select: productSelect,
        });
    return productRecord(row);
  }

  async restore(productId: string): Promise<GearUpProduct> {
    const row = await this.db.gearUpProduct.update({
      where: { id: productId },
      data: { archivedAt: null },
      select: productSelect,
    });
    return productRecord(row);
  }
}
