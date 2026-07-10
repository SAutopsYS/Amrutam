import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/jwt-auth.guard';
import { RolesGuard } from '@modules/rbac/guards/roles.guard';
import { Roles } from '@common/decorators/auth.decorators';
import { RoleName, IDEMPOTENCY_KEY_HEADER } from '@common/constants';
import {
  ApiStandardErrorResponses,
  successEnvelopeExample,
} from '@common/swagger/api-responses.decorator';
import { CurrentUser, RequestContextDecorator } from '@common/decorators/request-context.decorator';
import { RequestContext } from '@common/interfaces/api-response.interface';
import {
  CreateBookingService,
  AuthenticatedUser,
} from '../application/services/create-booking.service';
import { CancelAppointmentService } from '../application/services/cancel-appointment.service';
import { RescheduleAppointmentService } from '../application/services/reschedule-appointment.service';
import { GetAppointmentsService } from '../application/services/get-appointments.service';
import {
  CancelAppointmentDto,
  CreateAppointmentDto,
  ListAppointmentsQueryDto,
  RescheduleAppointmentDto,
} from '../application/dto/appointment.dto';

/**
 * Thin controller — all booking business logic lives in application services.
 * Authorization via guards/decorators; no inline permission checks.
 */
@ApiTags('Appointments')
@ApiBearerAuth()
@ApiStandardErrorResponses()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly createBookingService: CreateBookingService,
    private readonly cancelAppointmentService: CancelAppointmentService,
    private readonly rescheduleAppointmentService: RescheduleAppointmentService,
    private readonly getAppointmentsService: GetAppointmentsService,
  ) {}

  @Post()
  @Roles(RoleName.PATIENT)
  @ApiOperation({
    summary: 'Book an appointment',
    description:
      'Creates a new appointment with idempotent semantics. ' +
      'Send a unique `Idempotency-Key` header per booking attempt. ' +
      'Duplicate keys return the cached response; conflicting payloads return 409.',
  })
  @ApiHeader({
    name: IDEMPOTENCY_KEY_HEADER,
    required: true,
    description: 'Client-generated UUID for idempotent booking',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiCreatedResponse({
    description: 'Appointment booked successfully',
    schema: {
      example: {
        ...successEnvelopeExample,
        data: {
          appointmentId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
          bookingId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
          status: 'CONFIRMED',
          doctorId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
          slotId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
          scheduledAt: '2026-07-15T10:00:00.000Z',
        },
      },
    },
  })
  @ApiConflictResponse({
    description: 'Slot unavailable or idempotency conflict',
    schema: {
      example: {
        success: false,
        code: 'SLOT_ALREADY_BOOKED',
        message: 'Slot is no longer available',
        details: null,
        requestId: '550e8400-e29b-41d4-a716-446655440000',
        timestamp: '2026-07-09T12:00:00.000Z',
      },
    },
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAppointmentDto,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey: string,
    @RequestContextDecorator() ctx: RequestContext,
  ) {
    return this.createBookingService.execute(user, dto, idempotencyKey, ctx);
  }

  @Get('me')
  @Roles(RoleName.PATIENT)
  @ApiOperation({
    summary: 'List patient appointments',
    description: 'Cursor-paginated list for the authenticated patient.',
  })
  @ApiOkResponse({
    description: 'Paginated appointment list',
    schema: { example: successEnvelopeExample },
  })
  getMyAppointments(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAppointmentsQueryDto,
  ) {
    return this.getAppointmentsService.getPatientAppointments(user, query);
  }

  @Get('doctor/me')
  @Roles(RoleName.DOCTOR)
  @ApiOperation({ summary: 'List doctor appointments' })
  getDoctorAppointments(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAppointmentsQueryDto,
  ) {
    return this.getAppointmentsService.getDoctorAppointments(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get appointment by ID' })
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.getAppointmentsService.getById(user, id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel an appointment' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelAppointmentDto,
    @RequestContextDecorator() ctx: RequestContext,
  ) {
    return this.cancelAppointmentService.execute(user, id, dto, ctx);
  }

  @Patch(':id/reschedule')
  @Roles(RoleName.PATIENT)
  @ApiOperation({ summary: 'Reschedule an appointment to a new slot' })
  reschedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleAppointmentDto,
    @RequestContextDecorator() ctx: RequestContext,
  ) {
    return this.rescheduleAppointmentService.execute(user, id, dto, ctx);
  }
}
