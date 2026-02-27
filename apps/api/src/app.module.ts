import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { HealthController } from "./health.controller";
import { CatalogController } from "./catalog.controller";
import { AdminController } from "./admin.controller";
import { OrdersController } from "./orders.controller";
import { OrdersEventsService } from "./orders-events.service";

@Module({
  imports: [],
  controllers: [AppController, HealthController, CatalogController, AdminController, OrdersController],
  providers: [AppService, OrdersEventsService],
})
export class AppModule {}
