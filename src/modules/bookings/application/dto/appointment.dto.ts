import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAppointmentDto {
  @ApiProperty({
    description: 'Doctor UUID',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @IsUUID()
  doctorId!: string;

  @ApiProperty({
    description: 'Availability slot UUID',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  @IsUUID()
  slotId!: string;

  @ApiPropertyOptional({ description: 'Reason for consultation' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class RescheduleAppointmentDto {
  @ApiProperty({ description: 'New availability slot UUID' })
  @IsUUID()
  @IsNotEmpty()
  newSlotId!: string;

  @ApiPropertyOptional({ description: 'Reason for rescheduling' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CancelAppointmentDto {
  @ApiPropertyOptional({ description: 'Cancellation reason' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ListAppointmentsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ enum: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] })
  @IsOptional()
  @IsString()
  status?: string;
}
