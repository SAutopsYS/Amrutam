import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public } from '@common/decorators/auth.decorators';
import { JwtAuthGuard } from '@modules/auth/infrastructure/jwt-auth.guard';
import { RolesGuard } from '@modules/rbac/guards/roles.guard';
import { CurrentUser, RequestContextDecorator } from '@common/decorators/request-context.decorator';
import {
  ApiStandardErrorResponses,
  successEnvelopeExample,
} from '@common/swagger/api-responses.decorator';
import { PaymentService, PaymentAuthUser } from '../application/services/payment.service';
import {
  InitiatePaymentDto,
  RefundPaymentDto,
  PaymentHistoryQueryDto,
} from '../application/dto/payment.dto';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('initiate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiStandardErrorResponses()
  @ApiOperation({
    summary: 'Initiate payment for appointment',
    description:
      'Creates a payment intent via the configured provider (Mock in development). Idempotent on appointment ID.',
  })
  @ApiOkResponse({
    description: 'Payment initiated',
    schema: {
      example: {
        ...successEnvelopeExample,
        data: { paymentId: '3fa85f64-5717-4562-b3fc-2c963f66afa6', status: 'PENDING', amount: 500 },
      },
    },
  })
  initiate(
    @CurrentUser() user: PaymentAuthUser,
    @Body() dto: InitiatePaymentDto,
    @RequestContextDecorator()
    ctx: { requestId: string; correlationId: string; ip?: string; userAgent?: string },
  ) {
    return this.paymentService.initiate(user, dto, ctx);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiStandardErrorResponses()
  @ApiOperation({
    summary: 'Get payment history',
    description: 'Returns paginated payment history for the authenticated user.',
  })
  @ApiOkResponse({ description: 'Payment history', schema: { example: successEnvelopeExample } })
  history(@CurrentUser() user: PaymentAuthUser, @Query() query: PaymentHistoryQueryDto) {
    return this.paymentService.getHistory(user, query.limit ? Number(query.limit) : 20);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiStandardErrorResponses()
  @ApiOperation({ summary: 'Get payment by ID' })
  @ApiOkResponse({ description: 'Payment details', schema: { example: successEnvelopeExample } })
  getById(@CurrentUser() user: PaymentAuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.paymentService.getById(user, id);
  }

  @Post('webhook')
  @Public()
  @ApiOperation({
    summary: 'Payment provider webhook',
    description:
      'Receives payment status updates. Signature verified via `x-webhook-signature` header (HMAC-SHA256).',
  })
  @ApiUnauthorizedResponse({ description: 'Invalid webhook signature' })
  @ApiOkResponse({ description: 'Webhook processed', schema: { example: { received: true } } })
  webhook(
    @Body() body: Record<string, unknown>,
    @Headers('x-webhook-signature') signature: string,
  ) {
    const payload = JSON.stringify(body);
    const secret = process.env.PAYMENT_WEBHOOK_SECRET ?? 'webhook-secret';
    return this.paymentService.processWebhook(payload, signature ?? '', secret);
  }

  @Post(':id/refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiStandardErrorResponses()
  @ApiOperation({
    summary: 'Refund a payment',
    description: 'Initiates a partial or full refund via the payment provider.',
  })
  @ApiOkResponse({ description: 'Refund initiated', schema: { example: successEnvelopeExample } })
  refund(
    @CurrentUser() user: PaymentAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RefundPaymentDto,
    @RequestContextDecorator()
    ctx: { requestId: string; correlationId: string; ip?: string; userAgent?: string },
  ) {
    return this.paymentService.refund(user, id, dto, ctx);
  }
}
