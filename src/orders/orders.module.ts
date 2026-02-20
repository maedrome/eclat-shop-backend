import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { ProductsModule } from '../products/products.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService],
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Order, OrderItem]),
    AuthModule,
    CartModule,
    ProductsModule,
    PaymentsModule,
  ],
  exports: [OrdersService, TypeOrmModule],
})
export class OrdersModule {}
