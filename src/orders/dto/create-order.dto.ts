import { IsString, MinLength } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  @MinLength(1)
  shippingAddress: string;

  @IsString()
  @MinLength(1)
  shippingCity: string;

  @IsString()
  @MinLength(1)
  shippingPostalCode: string;

  @IsString()
  @MinLength(1)
  shippingCountry: string;

  @IsString()
  @MinLength(1)
  shippingPhone: string;
}
