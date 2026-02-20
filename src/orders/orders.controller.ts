import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaginationDto } from '../common/dtos/pagination.dto';
import { Auth, GetUser } from '../auth/decorators';
import { User } from '../auth/entities/user.entity';
import { ValidRoles } from '../auth/interfaces';
import { OrderStatus } from './entities/order.entity';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Auth()
  createOrder(@GetUser() user: User, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(user, dto);
  }

  @Post('confirm')
  @Auth()
  confirmPayment(
    @Body() body: { id: number; clientTransactionId: string },
  ) {
    return this.ordersService.confirmOrderPayment(body.id, body.clientTransactionId);
  }

  // Admin endpoints — must be before :id to avoid route conflict
  @Get('admin')
  @Auth(ValidRoles.admin)
  getAllOrders(@Query() paginationDto: PaginationDto & { status?: string }) {
    return this.ordersService.getAllOrders(paginationDto);
  }

  @Get('admin/:id')
  @Auth(ValidRoles.admin)
  getAdminOrderById(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.getAdminOrderById(id);
  }

  @Patch('admin/:id/status')
  @Auth(ValidRoles.admin)
  updateOrderStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: OrderStatus,
  ) {
    return this.ordersService.updateOrderStatus(id, status);
  }

  @Get()
  @Auth()
  getUserOrders(@GetUser() user: User, @Query() paginationDto: PaginationDto) {
    return this.ordersService.getUserOrders(user, paginationDto);
  }

  @Get(':id')
  @Auth()
  getOrderById(
    @GetUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.getOrderById(user, id);
  }
}
