import { Module } from '@nestjs/common';

import { AuthModule } from './../auth/auth.module';
import { ProductsModule } from './../products/products.module';
import { CartModule } from './../cart/cart.module';
import { OrdersModule } from './../orders/orders.module';

import { SeedService } from './seed.service';
import { SeedController } from './seed.controller';

@Module({
  controllers: [SeedController],
  providers: [SeedService],
  imports: [
    ProductsModule,
    AuthModule,
    CartModule,
    OrdersModule,
  ]
})
export class SeedModule {}
