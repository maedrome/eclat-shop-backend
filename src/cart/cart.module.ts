import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { AuthModule } from '../auth/auth.module';
import { ProductsModule } from '../products/products.module';

@Module({
  controllers: [CartController],
  providers: [CartService],
  imports: [
    TypeOrmModule.forFeature([Cart, CartItem]),
    AuthModule,
    ProductsModule,
  ],
  exports: [CartService, TypeOrmModule],
})
export class CartModule {}
