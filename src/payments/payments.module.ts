import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { PaymentsService } from './payments.service';

@Module({
  imports: [ConfigModule, HttpModule],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
