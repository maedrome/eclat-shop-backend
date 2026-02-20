import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { MergeCartDto } from './dto/merge-cart.dto';
import { Auth, GetUser } from '../auth/decorators';
import { User } from '../auth/entities/user.entity';

@ApiTags('Cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @Auth()
  getCart(@GetUser() user: User) {
    return this.cartService.getCart(user);
  }

  @Post('items')
  @Auth()
  addItem(@GetUser() user: User, @Body() dto: AddToCartDto) {
    return this.cartService.addItem(user, dto);
  }

  @Patch('items/:id')
  @Auth()
  updateItemQuantity(
    @GetUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItemQuantity(user, id, dto);
  }

  @Delete('items/:id')
  @Auth()
  removeItem(@GetUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.cartService.removeItem(user, id);
  }

  @Delete()
  @Auth()
  clearCart(@GetUser() user: User) {
    return this.cartService.clearCart(user);
  }

  @Post('merge')
  @Auth()
  mergeGuestCart(@GetUser() user: User, @Body() dto: MergeCartDto) {
    return this.cartService.mergeGuestCart(user, dto);
  }
}
