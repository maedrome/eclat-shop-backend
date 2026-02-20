import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsPositive, IsString, Min } from 'class-validator';

export class PaginationDto {
  @ApiProperty({
    default: 10,
    description: 'How many rows do you need',
  })
  @IsOptional()
  @IsPositive()
  @Type(() => Number) // enableImplicitConversions: true
  limit?: number;

  @ApiProperty({
    default: 0,
    description: 'How many rows do you want to skip',
  })
  @IsOptional()
  @Min(0)
  @Type(() => Number) // enableImplicitConversions: true
  offset?: number;

  @ApiProperty({
    default: '',
    description: 'Filter results by gender',
  })
  @IsOptional()
  gender: 'men' | 'women' | 'unisex' | 'kid';

  @ApiProperty({
    default: '',
    description: 'Filter by sizes (comma-separated: M,L,XL)',
  })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiProperty({
    default: '',
    description: 'Filter by tags (comma-separated: shirt,hoodie)',
  })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiProperty({
    default: '',
    description: 'Sort by column (price, stock)',
  })
  @IsOptional()
  @IsIn(['price', 'stock', ''])
  sortBy?: string;

  @ApiProperty({
    default: 'ASC',
    description: 'Sort direction (ASC or DESC)',
  })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}
