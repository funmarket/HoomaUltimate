import type {
  GearUpProductCreateInput,
  GearUpProductUpdateInput,
} from "@hooma/contracts/gear-up";
import { Prisma, type PrismaClient } from "@hooma/database";
import type {
  GearUpProductRecord,
  GearUpProductRepository,
} from "../application/gear-up-product.repository.js";

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
});

type ProductRow = Prisma.GearUpProductGetPayload<{ select: typeof productSelect }>;

function productRecord(row: ProductRow): GearUpProductRecord {
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
    featuredAt: row.featuredAt?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class PrismaGearUpProductRepository implements GearUpProductRepository {
  constructor(private readonly db: PrismaClient) {}

  async listPublicByShop(placeId: string): Promise<readonly GearUpProductRecord[]> {
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

  async getPublic(productId: string): Promise<GearUpProductRecord | null> {
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

  async listManagedByShop(placeId: string): Promise<readonly GearUpProductRecord[]> {
    const rows = await this.db.gearUpProduct.findMany({
      where: { shopPlaceId: placeId },
      select: productSelect,
      orderBy: [{ archivedAt: "asc" }, { featuredAt: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(productRecord);
  }

  async getManaged(productId: string): Promise<GearUpProductRecord | null> {
    const row = await this.db.gearUpProduct.findUnique({
      where: { id: productId },
      select: productSelect,
    });
    return row ? productRecord(row) : null;
  }

  async create(
    placeId: string,
    input: GearUpProductCreateInput,
  ): Promise<GearUpProductRecord> {
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

  async update(
    productId: string,
    input: GearUpProductUpdateInput,
  ): Promise<GearUpProductRecord> {
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

  async feature(productId: string): Promise<GearUpProductRecord> {
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

  async unfeature(productId: string): Promise<GearUpProductRecord> {
    const row = await this.db.gearUpProduct.update({
      where: { id: productId },
      data: { featuredAt: null },
      select: productSelect,
    });
    return productRecord(row);
  }

  async archive(productId: string): Promise<GearUpProductRecord> {
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

  async restore(productId: string): Promise<GearUpProductRecord> {
    const row = await this.db.gearUpProduct.update({
      where: { id: productId },
      data: { archivedAt: null },
      select: productSelect,
    });
    return productRecord(row);
  }
}
