import { IsArray, ValidateNested, IsInt, IsPositive, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

class MergeCartItemDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @IsPositive()
  quantity: number;

  @IsString()
  size: string;
}

export class MergeCartDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MergeCartItemDto)
  items: MergeCartItemDto[];
}
