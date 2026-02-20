import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../auth/entities/user.entity';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { MergeCartDto } from './dto/merge-cart.dto';

@Injectable()
export class CartService {
  private readonly logger = new Logger('CartService');

  constructor(
    @InjectRepository(Cart)
    private readonly cartRepository: Repository<Cart>,

    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,

    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async getOrCreateCart(user: User): Promise<Cart> {
    let cart = await this.cartRepository.findOne({
      where: { user: { id: user.id } },
      relations: ['items', 'items.product', 'items.product.images'],
      order: { items: { createdAt: 'ASC' } },
    });

    if (!cart) {
      cart = this.cartRepository.create({ user, items: [] });
      await this.cartRepository.save(cart);
    }

    return cart;
  }

  async getCart(user: User) {
    const cart = await this.getOrCreateCart(user);
    return this.formatCart(cart);
  }

  async addItem(user: User, dto: AddToCartDto) {
    const { productId, quantity, size } = dto;

    const product = await this.productRepository.findOneBy({ id: productId });
    if (!product) throw new NotFoundException(`Product with id ${productId} not found`);

    if (!product.sizes.includes(size)) {
      throw new BadRequestException(`Size "${size}" is not available for this product`);
    }

    if (product.stock < quantity) {
      throw new BadRequestException(`Not enough stock. Available: ${product.stock}`);
    }

    const cart = await this.getOrCreateCart(user);

    let existingItem = await this.cartItemRepository.findOne({
      where: {
        cart: { id: cart.id },
        product: { id: productId },
        size,
      },
    });

    if (existingItem) {
      existingItem.quantity += quantity;
      if (existingItem.quantity > product.stock) {
        throw new BadRequestException(`Not enough stock. Available: ${product.stock}`);
      }
      await this.cartItemRepository.save(existingItem);
    } else {
      existingItem = this.cartItemRepository.create({
        cart,
        product,
        quantity,
        size,
      });
      await this.cartItemRepository.save(existingItem);
    }

    return this.getCart(user);
  }

  async updateItemQuantity(user: User, cartItemId: string, dto: UpdateCartItemDto) {
    const cart = await this.getOrCreateCart(user);

    const item = await this.cartItemRepository.findOne({
      where: { id: cartItemId, cart: { id: cart.id } },
      relations: ['product'],
    });

    if (!item) throw new NotFoundException(`Cart item not found`);

    if (dto.quantity > item.product.stock) {
      throw new BadRequestException(`Not enough stock. Available: ${item.product.stock}`);
    }

    item.quantity = dto.quantity;
    await this.cartItemRepository.save(item);

    return this.getCart(user);
  }

  async removeItem(user: User, cartItemId: string) {
    const cart = await this.getOrCreateCart(user);

    const item = await this.cartItemRepository.findOne({
      where: { id: cartItemId, cart: { id: cart.id } },
    });
    if (!item) throw new NotFoundException(`Cart item not found`);

    await this.cartItemRepository.remove(item);

    return this.getCart(user);
  }

  async clearCart(user: User) {
    const cart = await this.getOrCreateCart(user);
    await this.cartItemRepository.delete({ cart: { id: cart.id } });
    return this.getCart(user);
  }

  async mergeGuestCart(user: User, dto: MergeCartDto) {
    for (const guestItem of dto.items) {
      try {
        await this.addItem(user, {
          productId: guestItem.productId,
          quantity: guestItem.quantity,
          size: guestItem.size,
        });
      } catch (error:any) {
        this.logger.warn(`Could not merge item ${guestItem.productId}: ${error.message}`);
      }
    }

    return this.getCart(user);
  }

  async deleteAllCarts() {
    const query = this.cartItemRepository.createQueryBuilder('cart_item');
    await query.delete().where({}).execute();

    const cartQuery = this.cartRepository.createQueryBuilder('cart');
    await cartQuery.delete().where({}).execute();
  }

  private formatCart(cart: Cart) {
    return {
      id: cart.id,
      items: (cart.items || []).map((item) => ({
        id: item.id,
        quantity: item.quantity,
        size: item.size,
        product: {
          id: item.product.id,
          title: item.product.title,
          price: item.product.price,
          slug: item.product.slug,
          stock: item.product.stock,
          sizes: item.product.sizes,
          images: (item.product.images || [])
            .sort((a, b) => a.id - b.id)
            .map((img) => img.url),
        },
      })),
    };
  }
}
