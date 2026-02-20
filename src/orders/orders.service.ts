import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CartService } from '../cart/cart.service';
import { PaymentsService } from '../payments/payments.service';
import { Product } from '../products/entities/product.entity';
import { User } from '../auth/entities/user.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaginationDto } from '../common/dtos/pagination.dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger('OrdersService');
  private readonly frontendUrl: string;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,

    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,

    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,

    private readonly dataSource: DataSource,
    private readonly cartService: CartService,
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:4200';
  }

  async createOrder(user: User, dto: CreateOrderDto) {
    const cart = await this.cartService.getOrCreateCart(user);

    if (!cart.items || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let order: Order;
    let totalAmount = 0;

    try {
      let totalItems = 0;
      const orderItems: OrderItem[] = [];

      for (const cartItem of cart.items) {
        const product = await queryRunner.manager.findOne(Product, {
          where: { id: cartItem.product.id },
          lock: { mode: 'pessimistic_write' },
          loadEagerRelations: false,
        });

        if (!product) {
          throw new BadRequestException(`Product "${cartItem.product.title}" no longer exists`);
        }

        if (product.stock < cartItem.quantity) {
          throw new BadRequestException(
            `Not enough stock for "${product.title}". Available: ${product.stock}`,
          );
        }

        const lineTotal = product.price * cartItem.quantity;
        totalAmount += lineTotal;
        totalItems += cartItem.quantity;

        const orderItem = this.orderItemRepository.create({
          product,
          quantity: cartItem.quantity,
          size: cartItem.size,
          priceAtPurchase: product.price,
        });

        orderItems.push(orderItem);
      }

      const clientTransactionId = uuid();

      order = this.orderRepository.create({
        user,
        items: orderItems,
        totalAmount,
        totalItems,
        status: OrderStatus.PENDING,
        shippingAddress: dto.shippingAddress,
        shippingCity: dto.shippingCity,
        shippingPostalCode: dto.shippingPostalCode,
        shippingCountry: dto.shippingCountry,
        shippingPhone: dto.shippingPhone,
        clientTransactionId,
      });

      await queryRunner.manager.save(order);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof BadRequestException) throw error;
      this.logger.error(error);
      throw new InternalServerErrorException('Failed to create order');
    } finally {
      await queryRunner.release();
    }

    // PayPhone call is outside the transaction — if it fails, the order
    // stays PENDING and can be retried or cleaned up later.
    const amountInCents = Math.round(totalAmount * 100);
    const responseUrl = `${this.frontendUrl}/#/payment-result`;

    const paymentResult = await this.paymentsService.preparePayment({
      amount: amountInCents,
      clientTransactionId: order.clientTransactionId,
      reference: `Order ${order.id}`,
      responseUrl,
    });

    return {
      order: this.formatOrder(order),
      payWithCard: paymentResult.payWithCard,
      payWithPayPhone: paymentResult.payWithPayPhone,
    };
  }

  async confirmOrderPayment(
    payPhoneId: number,
    clientTransactionId: string,
  ) {
    const order = await this.orderRepository.findOne({
      where: { clientTransactionId },
    });

    if (!order) {
      throw new NotFoundException('Order not found for this transaction');
    }

    if (order.status === OrderStatus.PAID) {
      return this.formatOrder(order);
    }

    const confirmation = await this.paymentsService.confirmPayment(
      payPhoneId,
      clientTransactionId,
    );

    if (confirmation.statusCode !== 3 || confirmation.transactionStatus !== 'Approved') {
      order.status = OrderStatus.CANCELLED;
      await this.orderRepository.save(order);
      throw new BadRequestException('Payment was not approved');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const item of order.items) {
        const product = await queryRunner.manager.findOne(Product, {
          where: { id: item.product.id },
          lock: { mode: 'pessimistic_write' },
          loadEagerRelations: false,
        });

        if (product) {
          product.stock = Math.max(0, product.stock - item.quantity);
          await queryRunner.manager.save(product);
        }
      }

      order.status = OrderStatus.PAID;
      order.paidAt = new Date();
      await queryRunner.manager.save(order);

      await queryRunner.commitTransaction();

      await this.cartService.clearCart(order.user);

      return this.formatOrder(order);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(error);
      throw new InternalServerErrorException('Failed to confirm order payment');
    } finally {
      await queryRunner.release();
    }
  }

  async getUserOrders(user: User, paginationDto: PaginationDto) {
    const { limit = 10, offset = 0 } = paginationDto;

    const [orders, total] = await this.orderRepository.findAndCount({
      where: { user: { id: user.id } },
      take: limit,
      skip: offset,
      order: { createdAt: 'DESC' },
      relations: ['items', 'items.product', 'items.product.images'],
    });

    return {
      count: total,
      pages: Math.ceil(total / limit),
      orders: orders.map((order) => this.formatOrder(order)),
    };
  }

  async getOrderById(user: User, orderId: string) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, user: { id: user.id } },
      relations: ['items', 'items.product', 'items.product.images'],
    });

    if (!order) {
      throw new NotFoundException(`Order with id ${orderId} not found`);
    }

    return this.formatOrder(order);
  }

  async getAllOrders(paginationDto: PaginationDto & { status?: string }) {
    const { limit = 10, offset = 0, status } = paginationDto;

    const queryBuilder = this.orderRepository.createQueryBuilder('order')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('product.images', 'images')
      .orderBy('order.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    if (status && Object.values(OrderStatus).includes(status as OrderStatus)) {
      queryBuilder.where('order.status = :status', { status });
    }

    const [orders, total] = await queryBuilder.getManyAndCount();

    return {
      count: total,
      pages: Math.ceil(total / limit),
      orders: orders.map((order) => ({
        ...this.formatOrder(order),
        user: {
          id: order.user.id,
          fullName: order.user.fullName,
          email: order.user.email,
        },
      })),
    };
  }

  async getAdminOrderById(orderId: string) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items', 'items.product', 'items.product.images'],
    });

    if (!order) {
      throw new NotFoundException(`Order with id ${orderId} not found`);
    }

    return {
      ...this.formatOrder(order),
      user: {
        id: order.user.id,
        fullName: order.user.fullName,
        email: order.user.email,
      },
    };
  }

  async updateOrderStatus(orderId: string, status: OrderStatus) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with id ${orderId} not found`);
    }

    order.status = status;
    await this.orderRepository.save(order);

    return this.getAdminOrderById(orderId);
  }

  async deleteAllOrders() {
    const itemQuery = this.orderItemRepository.createQueryBuilder('order_item');
    await itemQuery.delete().where({}).execute();

    const orderQuery = this.orderRepository.createQueryBuilder('order');
    await orderQuery.delete().where({}).execute();
  }

  private formatOrder(order: Order) {
    return {
      id: order.id,
      totalAmount: order.totalAmount,
      totalItems: order.totalItems,
      status: order.status,
      shippingAddress: order.shippingAddress,
      shippingCity: order.shippingCity,
      shippingPostalCode: order.shippingPostalCode,
      shippingCountry: order.shippingCountry,
      shippingPhone: order.shippingPhone,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
      items: (order.items || []).map((item) => ({
        id: item.id,
        quantity: item.quantity,
        size: item.size,
        priceAtPurchase: item.priceAtPurchase,
        product: {
          id: item.product.id,
          title: item.product.title,
          slug: item.product.slug,
          images: (item.product.images || []).map((img) => img.url),
        },
      })),
    };
  }
}
