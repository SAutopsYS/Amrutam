import {
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
  MaxLength,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class SearchDoctorsQueryDto {
  @ApiPropertyOptional({ description: 'Search keyword (name, bio, specialization)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;

  @ApiPropertyOptional({ description: 'Specialization slug', example: 'ayurveda' })
  @IsOptional()
  @IsString()
  specialization?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class ListSlotsQueryDto {
  @ApiPropertyOptional({ description: 'From date (ISO)', example: '2026-07-10T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'To date (ISO)', example: '2026-07-17T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CreateSlotDto {
  @ApiProperty({ example: '2026-07-15T10:00:00.000Z' })
  @IsDateString()
  startTime!: string;

  @ApiProperty({ example: '2026-07-15T10:30:00.000Z' })
  @IsDateString()
  endTime!: string;
}

export class CreateLeaveDto {
  @ApiProperty({ example: '2026-08-01' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-08-05' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class DoctorIdParam {
  @ApiProperty()
  @IsUUID()
  id!: string;
}
