import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Unique,
  CreateDateColumn,
} from 'typeorm';
import { Cart } from './cart.entity';
import { Product } from '../../products/entities/product.entity';

@Entity('cart_items')
@Unique(['cart', 'product', 'size'])
export class CartItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Cart, (cart) => cart.items, { onDelete: 'CASCADE' })
  cart: Cart;

  @ManyToOne(() => Product, { eager: true })
  product: Product;

  @Column('int', { default: 1 })
  quantity: number;

  @Column('text')
  size: string;

  @CreateDateColumn()
  createdAt: Date;
}
