import { Injectable } from "@nestjs/common";
import { Observable, Subject } from "rxjs";

type OrderEventType = "connected" | "created" | "payment_updated" | "delivery_updated";

export type OrderEventPayload = {
  type: OrderEventType;
  orderId: string;
  at: string;
};

@Injectable()
export class OrdersEventsService {
  private readonly events$ = new Subject<OrderEventPayload>();

  emit(type: Exclude<OrderEventType, "connected">, orderId: string) {
    this.events$.next({
      type,
      orderId,
      at: new Date().toISOString(),
    });
  }

  stream(): Observable<OrderEventPayload> {
    return this.events$.asObservable();
  }
}
