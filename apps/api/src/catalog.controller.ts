import { Controller, Get, Param, Query } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

@Controller("catalog")
export class CatalogController {
  @Get("categories")
  categories() {
    return prisma.category.findMany({
      where: { active: true },
      orderBy: { createdAt: "asc" },
    });
  }

  @Get("products")
  products(@Query("categoryId") categoryId?: string) {
    return prisma.product.findMany({
      where: { active: true, ...(categoryId ? { categoryId } : {}) },
      include: {
        category: true,
        variants: {
          where: { active: true },
          select: { id: true, priceCents: true, color: true, size: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  @Get("products/:id")
  product(@Param("id") id: string) {
    return prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        variants: { include: { inventory: true } },
      },
    });
  }
}
