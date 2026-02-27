import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Limpa dados (somente ambiente de desenvolvimento)
  await prisma.inventory.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  await prisma.category.createMany({
    data: [
      { name: "Bolsas Pequenas" },
      { name: "Bolsas Medias" },
      { name: "Bolsas Grandes" },
      { name: "Bolsas Gourmet" },
    ],
  });

  const [pequenas, medias, grandes, gourmet] = await prisma.category.findMany({
    orderBy: { createdAt: "asc" },
  });

  async function createProduct(input: {
    categoryId: string;
    name: string;
    description?: string;
    imageUrl?: string;
    variants: Array<{
      sku: string;
      color: string;
      size: string;
      priceCents: number;
      stock: number;
      weightGrams: number;
      lengthCm: number;
      widthCm: number;
      heightCm: number;
    }>;
  }) {
    await prisma.product.create({
      data: {
        categoryId: input.categoryId,
        name: input.name,
        description: input.description,
        imageUrl: input.imageUrl,
        variants: {
          create: input.variants.map((v) => ({
            sku: v.sku,
            color: v.color,
            size: v.size,
            priceCents: v.priceCents,
            weightGrams: v.weightGrams,
            lengthCm: v.lengthCm,
            widthCm: v.widthCm,
            heightCm: v.heightCm,
            inventory: { create: { onHand: v.stock, reserved: 0 } },
          })),
        },
      },
    });
  }

  await createProduct({
    categoryId: pequenas.id,
    name: "Bolsa Pequena CF Classic",
    description: "Bolsa pequena elegante para o dia a dia.",
    variants: [
      {
        sku: "CF-PQ-CLA-PT-U",
        color: "Preto",
        size: "Unico",
        priceCents: 15990,
        stock: 10,
        weightGrams: 600,
        lengthCm: 25,
        widthCm: 20,
        heightCm: 10,
      },
      {
        sku: "CF-PQ-CLA-NU-U",
        color: "Nude",
        size: "Unico",
        priceCents: 15990,
        stock: 8,
        weightGrams: 600,
        lengthCm: 25,
        widthCm: 20,
        heightCm: 10,
      },
    ],
  });

  await createProduct({
    categoryId: medias.id,
    name: "Bolsa Media CF Urban",
    description: "Espacosa e sofisticada.",
    variants: [
      {
        sku: "CF-MD-URB-PT-U",
        color: "Preto",
        size: "Unico",
        priceCents: 19990,
        stock: 6,
        weightGrams: 900,
        lengthCm: 30,
        widthCm: 25,
        heightCm: 12,
      },
      {
        sku: "CF-MD-URB-VM-U",
        color: "Vermelho",
        size: "Unico",
        priceCents: 19990,
        stock: 5,
        weightGrams: 900,
        lengthCm: 30,
        widthCm: 25,
        heightCm: 12,
      },
    ],
  });

  await createProduct({
    categoryId: grandes.id,
    name: "Bolsa Grande CF Prime",
    description: "Ideal para trabalho e viagens curtas.",
    variants: [
      {
        sku: "CF-GR-PRI-PT-U",
        color: "Preto",
        size: "Unico",
        priceCents: 24990,
        stock: 4,
        weightGrams: 1300,
        lengthCm: 35,
        widthCm: 30,
        heightCm: 15,
      },
    ],
  });

  await createProduct({
    categoryId: gourmet.id,
    name: "Bolsa Gourmet CF Lux",
    description: "Linha premium com acabamento sofisticado.",
    variants: [
      {
        sku: "CF-GO-LUX-PT-U",
        color: "Preto",
        size: "Unico",
        priceCents: 28990,
        stock: 3,
        weightGrams: 1100,
        lengthCm: 32,
        widthCm: 28,
        heightCm: 14,
      },
    ],
  });

  console.log("Seed concluido.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
