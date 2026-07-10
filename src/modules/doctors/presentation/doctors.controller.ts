import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public, Roles } from '@common/decorators/auth.decorators';
import { RoleName, ErrorCode } from '@common/constants';
import { DomainException } from '@common/exceptions/domain.exception';
import {
  ApiStandardErrorResponses,
  successEnvelopeExample,
} from '@common/swagger/api-responses.decorator';
import { CurrentUser } from '@common/decorators/request-context.decorator';
import { JwtAuthGuard } from '@modules/auth/infrastructure/jwt-auth.guard';
import { RolesGuard } from '@modules/rbac/guards/roles.guard';
import { DoctorSearchService } from '../application/services/doctor-search.service';
import { AvailabilityService } from '../application/services/availability.service';
import { LeaveService } from '../application/services/leave.service';
import {
  SearchDoctorsQueryDto,
  ListSlotsQueryDto,
  CreateSlotDto,
  CreateLeaveDto,
} from '../application/dto/doctor.dto';

@ApiTags('Doctors')
@ApiStandardErrorResponses()
@Controller('doctors')
export class DoctorsController {
  constructor(
    private readonly searchService: DoctorSearchService,
    private readonly availabilityService: AvailabilityService,
    private readonly leaveService: LeaveService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Search verified doctors',
    description: 'Cached for 60s. Filter by keyword or specialization.',
  })
  @ApiOkResponse({ description: 'Doctor list', schema: { example: successEnvelopeExample } })
  search(@Query() query: SearchDoctorsQueryDto) {
    return this.searchService.search(query);
  }

  @Post('me/slots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.DOCTOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an availability slot (doctor only)' })
  createSlot(@CurrentUser() user: { doctorId?: string }, @Body() dto: CreateSlotDto) {
    this.requireDoctor(user);
    return this.availabilityService.createSlot(user.doctorId!, dto);
  }

  @Get('me/leaves')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.DOCTOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List leave periods (doctor only)' })
  listLeaves(@CurrentUser() user: { doctorId?: string }) {
    this.requireDoctor(user);
    return this.leaveService.listLeaves(user.doctorId!);
  }

  @Post('me/leaves')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.DOCTOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create leave period (doctor only)' })
  createLeave(@CurrentUser() user: { doctorId?: string }, @Body() dto: CreateLeaveDto) {
    this.requireDoctor(user);
    return this.leaveService.createLeave(user.doctorId!, dto);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get doctor profile by ID' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.availabilityService.getDoctorProfile(id);
  }

  @Get(':id/slots')
  @Public()
  @ApiOperation({ summary: 'List available slots for a doctor' })
  listSlots(@Param('id', ParseUUIDPipe) id: string, @Query() query: ListSlotsQueryDto) {
    return this.availabilityService.listAvailableSlots(id, query);
  }

  private requireDoctor(user: { doctorId?: string }) {
    if (!user.doctorId) {
      throw new DomainException(ErrorCode.FORBIDDEN, 'User is not a doctor', HttpStatus.FORBIDDEN);
    }
  }
}
