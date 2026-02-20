import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface PreparePaymentDto {
  amount: number;
  clientTransactionId: string;
  reference: string;
  responseUrl: string;
}

interface PreparePaymentResponse {
  paymentId: string;
  payWithPayPhone: string;
  payWithCard: string;
}

interface ConfirmPaymentResponse {
  statusCode: number;
  transactionStatus: string;
  clientTransactionId: string;
  authorizationCode: string;
  transactionId: number;
  amount: number;
  cardBrand: string;
  email: string;
  date: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger('PaymentsService');
  private readonly apiUrl = 'https://pay.payphonetodoesposible.com/api';
  private readonly token: string;
  private readonly storeId: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.token = this.configService.get<string>('PAYPHONE_TOKEN');
    this.storeId = this.configService.get<string>('PAYPHONE_STORE_ID');
  }

  async preparePayment(dto: PreparePaymentDto): Promise<PreparePaymentResponse> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.post<PreparePaymentResponse>(
          `${this.apiUrl}/button/Prepare`,
          {
            amount: dto.amount,
            amountWithoutTax: dto.amount,
            amountWithTax: 0,
            tax: 0,
            service: 0,
            tip: 0,
            clientTransactionId: dto.clientTransactionId,
            currency: 'USD',
            storeId: this.storeId,
            reference: dto.reference,
            responseUrl: dto.responseUrl,
          },
          {
            headers: {
              'Authorization': `Bearer ${this.token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          },
        ),
      );

      return data;
    } catch (error) {
      this.logger.error('PayPhone Prepare error:', (error as Error).message);
      throw new InternalServerErrorException('Payment gateway unavailable');
    }
  }

  async confirmPayment(
    id: number,
    clientTransactionId: string,
  ): Promise<ConfirmPaymentResponse> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.post<ConfirmPaymentResponse>(
          `${this.apiUrl}/button/V2/Confirm`,
          { id, clientTxId: clientTransactionId },
          {
            headers: {
              'Authorization': `Bearer ${this.token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          },
        ),
      );

      return data;
    } catch (error) {
      this.logger.error('PayPhone Confirm error:', (error as Error).message);
      throw new InternalServerErrorException('Failed to confirm payment');
    }
  }
}
