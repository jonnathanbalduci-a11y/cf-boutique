import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { OrdersEventsService } from "./orders-events.service";

const prisma = new PrismaClient();

type CreateOrderItem = {
  productId?: string;
  variantId?: string;
  productName?: string;
  sku?: string;
  color?: string;
  size?: string;
  imageUrl?: string;
  quantity?: number;
  priceCents?: number;
};

@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersEvents: OrdersEventsService) {}

  @Post()
  async createOrder(
    @Body()
    body: {
      customerName?: string;
      customerPhone?: string;
      customerAddress?: string;
      paymentMethod?: string;
      notes?: string;
      totalCents?: number;
      items?: CreateOrderItem[];
    },
  ) {
    const customerName = (body.customerName ?? "").trim();
    const customerPhone = (body.customerPhone ?? "").trim();
    const customerAddress = (body.customerAddress ?? "").trim();
    const paymentMethod = (body.paymentMethod ?? "").trim();
    const notes = (body.notes ?? "").trim();

    if (!customerName || !customerPhone || !customerAddress || !paymentMethod) {
      throw new BadRequestException("Dados do cliente incompletos.");
    }

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      throw new BadRequestException("Pedido sem itens.");
    }

    const normalizedItems = items.map((item) => {
      const quantity = Number(item.quantity ?? 0);
      const priceCents = Number(item.priceCents ?? 0);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new BadRequestException("Quantidade invalida em item do pedido.");
      }

      if (!Number.isFinite(priceCents) || priceCents < 0) {
        throw new BadRequestException("Valor invalido em item do pedido.");
      }

      return {
        productId: item.productId || null,
        variantId: item.variantId || null,
        productName: (item.productName ?? "").trim() || "Produto",
        sku: item.sku || null,
        color: (item.color ?? "").trim() || "N/A",
        size: (item.size ?? "").trim() || "N/A",
        imageUrl: item.imageUrl || null,
        quantity: Math.floor(quantity),
        priceCents: Math.floor(priceCents),
      };
    });

    const computedTotal = normalizedItems.reduce((acc, item) => acc + item.priceCents * item.quantity, 0);
    const requestedTotal = Number(body.totalCents ?? computedTotal);

    if (!Number.isFinite(requestedTotal) || requestedTotal < 0) {
      throw new BadRequestException("Total invalido.");
    }

    const totalCents = Math.floor(requestedTotal);

    const order = await prisma.order.create({
      data: {
        customerName,
        customerPhone,
        customerAddress,
        paymentMethod,
        notes: notes || null,
        totalCents,
        items: {
          create: normalizedItems,
        },
      },
      include: { items: true },
    });

    this.ordersEvents.emit("created", order.id);

    return {
      id: order.id,
      totalCents: order.totalCents,
      createdAt: order.createdAt,
    };
  }
}
