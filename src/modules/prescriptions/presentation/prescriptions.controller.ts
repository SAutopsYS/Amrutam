import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/jwt-auth.guard';
import { RolesGuard } from '@modules/rbac/guards/roles.guard';
import { Roles } from '@common/decorators/auth.decorators';
import { RoleName } from '@common/constants';
import {
  ApiStandardErrorResponses,
  successEnvelopeExample,
} from '@common/swagger/api-responses.decorator';
import { CurrentUser, RequestContextDecorator } from '@common/decorators/request-context.decorator';
import { AuthUser } from '@modules/consultations/application/services/consultation.services';
import { PrescriptionService } from '../application/services/prescription.service';
import {
  CreatePrescriptionDto,
  UpdatePrescriptionDto,
  CancelPrescriptionDto,
} from '../application/dto/prescription.dto';

@ApiTags('Prescriptions')
@ApiBearerAuth()
@ApiStandardErrorResponses()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class PrescriptionsController {
  constructor(private readonly prescriptionService: PrescriptionService) {}

  @Post('consultations/:id/prescription')
  @Roles(RoleName.DOCTOR)
  @ApiOperation({
    summary: 'Create prescription for consultation',
    description:
      'Doctor-only. Creates the initial prescription version linked to a completed or in-progress consultation.',
  })
  @ApiOkResponse({
    description: 'Prescription created',
    schema: { example: successEnvelopeExample },
  })
  create(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) consultationId: string,
    @Body() dto: CreatePrescriptionDto,
    @RequestContextDecorator()
    ctx: { requestId: string; correlationId: string; ip?: string; userAgent?: string },
  ) {
    return this.prescriptionService.createForConsultation(user, consultationId, dto, ctx);
  }

  @Patch('prescriptions/:id')
  @Roles(RoleName.DOCTOR)
  @ApiOperation({
    summary: 'Update prescription',
    description:
      'Creates a new immutable version. Previous versions remain in history for audit compliance.',
  })
  @ApiOkResponse({
    description: 'New prescription version created',
    schema: { example: successEnvelopeExample },
  })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePrescriptionDto,
    @RequestContextDecorator()
    ctx: { requestId: string; correlationId: string; ip?: string; userAgent?: string },
  ) {
    return this.prescriptionService.update(user, id, dto, ctx);
  }

  @Post('prescriptions/:id/cancel')
  @Roles(RoleName.DOCTOR)
  @ApiOperation({
    summary: 'Cancel prescription',
    description: 'Marks prescription as cancelled. Does not delete version history.',
  })
  @ApiOkResponse({
    description: 'Prescription cancelled',
    schema: { example: successEnvelopeExample },
  })
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelPrescriptionDto,
    @RequestContextDecorator()
    ctx: { requestId: string; correlationId: string; ip?: string; userAgent?: string },
  ) {
    return this.prescriptionService.cancel(user, id, dto, ctx);
  }

  @Get('prescriptions/:id')
  @ApiOperation({
    summary: 'Get prescription by ID',
    description: 'Returns current version with items. Access restricted by role.',
  })
  @ApiOkResponse({
    description: 'Prescription details',
    schema: { example: successEnvelopeExample },
  })
  getById(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.prescriptionService.getById(user, id);
  }

  @Get('prescriptions/history/:consultationId')
  @ApiOperation({
    summary: 'Prescription version history',
    description: 'Returns all immutable versions for a consultation.',
  })
  @ApiOkResponse({ description: 'Version history', schema: { example: successEnvelopeExample } })
  history(
    @CurrentUser() user: AuthUser,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
  ) {
    return this.prescriptionService.getConsultationHistory(user, consultationId);
  }
}
