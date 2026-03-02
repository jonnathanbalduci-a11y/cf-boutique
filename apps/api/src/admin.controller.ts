import {
  BadRequestException,
  Body,
  Controller,
  Get,
  MessageEvent,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Sse,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import type { Request } from "express";
import { map, merge, of } from "rxjs";
import { OrdersEventsService } from "./orders-events.service";

const prisma = new PrismaClient();

function requireAdmin(req: Request) {
  const expected = process.env.ADMIN_KEY;
  if (!expected) {
    throw new UnauthorizedException("ADMIN_KEY nao configurada no servidor.");
  }

  const provided = req.header("x-admin-key");
  if (!provided || provided !== expected) {
    throw new UnauthorizedException("Acesso admin negado.");
  }
}

function parsePriceCents(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input) && input >= 0) {
    return Math.floor(input);
  }

  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;

  if (raw.includes(",") || raw.includes(".")) {
    const normalized = raw.replace(/\./g, "").replace(",", ".");
    const value = Number(normalized);
    if (!Number.isFinite(value) || value < 0) return null;
    return Math.round(value * 100);
  }

  const digits = Number(raw);
  if (!Number.isFinite(digits) || digits < 0) return null;
  return Math.floor(digits);
}

function parseNonNegativeInt(input: unknown): number | null {
  const value = typeof input === "string" ? Number(input.trim()) : Number(input);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.floor(value);
}

@Controller("admin")
export class AdminController {
  constructor(private readonly ordersEvents: OrdersEventsService) {}

  @Sse("orders/events")
  orderEvents(@Query("key") key?: string) {
    const expected = process.env.ADMIN_KEY;
    if (!expected) {
      throw new UnauthorizedException("ADMIN_KEY nao configurada no servidor.");
    }
    if (!key || key !== expected) {
      throw new UnauthorizedException("Acesso admin negado.");
    }

    return merge(
      of({
        type: "connected",
        orderId: "",
        at: new Date().toISOString(),
      }),
      this.ordersEvents.stream(),
    ).pipe(
      map(
        (event): MessageEvent => ({
          data: event,
        }),
      ),
    );
  }

  @Get("categories")
  async categories(@Req() req: Request) {
    requireAdmin(req);
    return prisma.category.findMany({ orderBy: { createdAt: "asc" } });
  }

  @Get("products")
  async products(@Req() req: Request) {
    requireAdmin(req);
    return prisma.product.findMany({
      include: {
        category: true,
        variants: {
          include: { inventory: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  @Post("products")
  async createProduct(
    @Req() req: Request,
    @Body()
    body: {
      name?: string;
      description?: string;
      imageUrl?: string;
      categoryId?: string;
      priceCents?: number | string;
      color?: string;
      size?: string;
      sku?: string;
      stock?: number | string;
    },
  ) {
    requireAdmin(req);

    const name = (body.name ?? "").trim();
    const categoryId = (body.categoryId ?? "").trim();
    const priceCents = parsePriceCents(body.priceCents);
    const stock = parseNonNegativeInt(body.stock);

    if (!name) throw new BadRequestException("Nome do produto obrigatorio.");
    if (!categoryId) throw new BadRequestException("Categoria obrigatoria.");
    if (priceCents === null || priceCents <= 0) throw new BadRequestException("Valor invalido.");
    if (stock === null) throw new BadRequestException("Estoque invalido.");

    const sku = (body.sku ?? "").trim() || `CF-${Date.now()}`;

    return prisma.product.create({
      data: {
        name,
        description: (body.description ?? "").trim() || null,
        imageUrl: (body.imageUrl ?? "").trim() || null,
        categoryId,
        variants: {
          create: {
            sku,
            color: (body.color ?? "Unica").trim() || "Unica",
            size: (body.size ?? "Unico").trim() || "Unico",
            priceCents,
            weightGrams: 500,
            lengthCm: 30,
            widthCm: 20,
            heightCm: 10,
            inventory: { create: { onHand: stock, reserved: 0 } },
          },
        },
      },
      include: {
        category: true,
        variants: {
          include: { inventory: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }

  @Patch("products/:id")
  async updateProduct(
    @Req() req: Request,
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      imageUrl?: string;
      categoryId?: string;
      active?: boolean;
    },
  ) {
    requireAdmin(req);

    const data: {
      name?: string;
      description?: string | null;
      imageUrl?: string | null;
      categoryId?: string;
      active?: boolean;
    } = {};

    if (typeof body.name === "string") data.name = body.name.trim();
    if (typeof body.description === "string") data.description = body.description.trim() || null;
    if (typeof body.imageUrl === "string") data.imageUrl = body.imageUrl.trim() || null;
    if (typeof body.categoryId === "string") data.categoryId = body.categoryId.trim();
    if (typeof body.active === "boolean") data.active = body.active;

    return prisma.product.update({
      where: { id },
      data,
      include: {
        category: true,
        variants: { include: { inventory: true } },
      },
    });
  }

  @Patch("variants/:id")
  async updateVariant(
    @Req() req: Request,
    @Param("id") id: string,
    @Body()
    body: {
      color?: string;
      size?: string;
      priceCents?: number | string;
      active?: boolean;
      stock?: number | string;
    },
  ) {
    requireAdmin(req);

    const data: {
      color?: string;
      size?: string;
      priceCents?: number;
      active?: boolean;
    } = {};

    if (typeof body.color === "string") data.color = body.color.trim();
    if (typeof body.size === "string") data.size = body.size.trim();
    const parsedPrice = parsePriceCents(body.priceCents);
    if (parsedPrice !== null) data.priceCents = parsedPrice;
    if (typeof body.active === "boolean") data.active = body.active;

    const parsedStock = parseNonNegativeInt(body.stock);
    if (parsedStock !== null) {
      await prisma.inventory.upsert({
        where: { variantId: id },
        update: { onHand: parsedStock },
        create: { variantId: id, onHand: parsedStock, reserved: 0 },
      });
    }

    return prisma.productVariant.update({
      where: { id },
      data,
      include: { inventory: true },
    });
  }

  @Get("dashboard")
  async dashboard(@Req() req: Request) {
    requireAdmin(req);

    const [ordersCount, paidOrdersCount, totalSales, paidSales] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { paymentStatus: "paid" } }),
      prisma.order.aggregate({ _sum: { totalCents: true } }),
      prisma.order.aggregate({ where: { paymentStatus: "paid" }, _sum: { totalCents: true } }),
    ]);

    return {
      ordersCount,
      paidOrdersCount,
      totalSalesCents: totalSales._sum.totalCents ?? 0,
      paidSalesCents: paidSales._sum.totalCents ?? 0,
    };
  }

  @Get("orders")
  async orders(@Req() req: Request) {
    requireAdmin(req);
    return prisma.order.findMany({
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
  }

  @Patch("orders/:id/payment")
  async setOrderPaymentStatus(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { paid?: boolean },
  ) {
    requireAdmin(req);

    if (typeof body.paid !== "boolean") {
      throw new BadRequestException("Campo 'paid' obrigatorio.");
    }

    if (!body.paid) {
      const updatedOrder = await prisma.order.update({
        where: { id },
        data: { paymentStatus: "pending", paidAt: null },
        include: { items: true },
      });
      this.ordersEvents.emit("payment_updated", updatedOrder.id);
      return updatedOrder;
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!order) throw new BadRequestException("Pedido nao encontrado.");

      if (!order.stockDeducted) {
        for (const item of order.items) {
          if (!item.variantId) continue;
          const inventory = await tx.inventory.findUnique({ where: { variantId: item.variantId } });
          if (!inventory) continue;

          const nextOnHand = Math.max(0, inventory.onHand - item.quantity);
          await tx.inventory.update({
            where: { variantId: item.variantId },
            data: { onHand: nextOnHand },
          });
        }
      }

      return tx.order.update({
        where: { id },
        data: {
          paymentStatus: "paid",
          paidAt: new Date(),
          stockDeducted: true,
        },
        include: { items: true },
      });
    });

    this.ordersEvents.emit("payment_updated", updatedOrder.id);
    return updatedOrder;
  }

  @Patch("orders/:id/delivery")
  async setOrderDeliveryStatus(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { delivered?: boolean },
  ) {
    requireAdmin(req);

    if (typeof body.delivered !== "boolean") {
      throw new BadRequestException("Campo 'delivered' obrigatorio.");
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        deliveryStatus: body.delivered ? "delivered" : "pending",
        deliveredAt: body.delivered ? new Date() : null,
      },
      include: { items: true },
    });

    this.ordersEvents.emit("delivery_updated", updatedOrder.id);
    return updatedOrder;
  }

  @Patch("orders/:id/cancel")
  async setOrderCancelledStatus(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { cancelled?: boolean },
  ) {
    requireAdmin(req);

    if (typeof body.cancelled !== "boolean") {
      throw new BadRequestException("Campo 'cancelled' obrigatorio.");
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        deliveryStatus: body.cancelled ? "cancelled" : "pending",
        deliveredAt: null,
      },
      include: { items: true },
    });

    this.ordersEvents.emit("delivery_updated", updatedOrder.id);
    return updatedOrder;
  }
}
