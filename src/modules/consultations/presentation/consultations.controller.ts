import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
import {
  StartConsultationService,
  CompleteConsultationService,
  GetConsultationService,
  ClinicalNoteService,
  AuthUser,
} from '../application/services/consultation.services';
import {
  UpsertClinicalNoteDto,
  CompleteConsultationDto,
  ConsultationHistoryQueryDto,
} from '../application/dto/consultation.dto';

@ApiTags('Consultations')
@ApiBearerAuth()
@ApiStandardErrorResponses()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('consultations')
export class ConsultationsController {
  constructor(
    private readonly startService: StartConsultationService,
    private readonly completeService: CompleteConsultationService,
    private readonly getService: GetConsultationService,
    private readonly noteService: ClinicalNoteService,
  ) {}

  @Post(':id/start')
  @Roles(RoleName.DOCTOR)
  @ApiOperation({
    summary: 'Start a consultation',
    description: 'Transitions consultation from SCHEDULED to IN_PROGRESS. Doctor-only.',
  })
  @ApiOkResponse({
    description: 'Consultation started',
    schema: { example: successEnvelopeExample },
  })
  start(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @RequestContextDecorator()
    ctx: { requestId: string; correlationId: string; ip?: string; userAgent?: string },
  ) {
    return this.startService.execute(user, id, ctx);
  }

  @Post(':id/complete')
  @Roles(RoleName.DOCTOR)
  @ApiOperation({ summary: 'Complete a consultation' })
  complete(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteConsultationDto,
    @RequestContextDecorator()
    ctx: { requestId: string; correlationId: string; ip?: string; userAgent?: string },
  ) {
    return this.completeService.execute(user, id, dto, ctx);
  }

  @Get('history')
  @ApiOperation({ summary: 'Search consultation history' })
  history(@CurrentUser() user: AuthUser, @Query() query: ConsultationHistoryQueryDto) {
    return this.getService.getHistory(user, query);
  }

  @Get('me')
  @ApiOperation({ summary: 'List my consultations' })
  myConsultations(@CurrentUser() user: AuthUser, @Query() query: ConsultationHistoryQueryDto) {
    return this.getService.getMyConsultations(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get consultation by ID' })
  getById(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.getService.getById(user, id);
  }

  @Post(':id/notes')
  @Roles(RoleName.DOCTOR)
  @ApiOperation({ summary: 'Create clinical notes (new version)' })
  createNotes(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertClinicalNoteDto,
    @RequestContextDecorator()
    ctx: { requestId: string; correlationId: string; ip?: string; userAgent?: string },
  ) {
    return this.noteService.upsert(user, id, dto, ctx);
  }

  @Patch(':id/notes')
  @Roles(RoleName.DOCTOR)
  @ApiOperation({ summary: 'Update clinical notes (creates new version)' })
  updateNotes(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertClinicalNoteDto,
    @RequestContextDecorator()
    ctx: { requestId: string; correlationId: string; ip?: string; userAgent?: string },
  ) {
    return this.noteService.upsert(user, id, dto, ctx);
  }
}
