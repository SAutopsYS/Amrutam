import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '@common/decorators/auth.decorators';
import {
  ApiStandardErrorResponses,
  successEnvelopeExample,
} from '@common/swagger/api-responses.decorator';
import { RequestContextDecorator } from '@common/decorators/request-context.decorator';
import { CurrentUser } from '@common/decorators/request-context.decorator';
import { RequestContext } from '@common/interfaces/api-response.interface';
import { AuthService } from '../application/services/auth.service';
import { ProfileService } from '../application/services/profile.service';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  UpdateProfileDto,
} from '../application/dto/auth.dto';
import { JwtAuthGuard } from '../infrastructure/jwt-auth.guard';

@ApiTags('Auth')
@ApiStandardErrorResponses()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly profileService: ProfileService,
  ) {}

  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Register a new patient account' })
  @ApiCreatedResponse({
    description: 'Account created with tokens',
    schema: { example: successEnvelopeExample },
  })
  register(@Body() dto: RegisterDto, @RequestContextDecorator() ctx: RequestContext) {
    return this.authService.register(dto, ctx);
  }

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiOkResponse({
    description: 'Returns access and refresh tokens',
    schema: { example: successEnvelopeExample },
  })
  login(@Body() dto: LoginDto, @RequestContextDecorator() ctx: RequestContext) {
    return this.authService.login(dto, ctx);
  }

  @Post('refresh')
  @Public()
  @ApiOperation({ summary: 'Rotate refresh token for new access token pair' })
  @ApiOkResponse({ description: 'New token pair', schema: { example: successEnvelopeExample } })
  refresh(@Body() dto: RefreshTokenDto, @RequestContextDecorator() ctx: RequestContext) {
    return this.authService.refresh(dto.refreshToken, ctx);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke refresh token and end session' })
  logout(
    @CurrentUser() user: { id: string },
    @Body() dto: RefreshTokenDto,
    @RequestContextDecorator() ctx: RequestContext,
  ) {
    return this.authService.logout(user.id, dto.refreshToken, ctx);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@CurrentUser() user: { id: string }) {
    return this.profileService.getProfile(user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  updateProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateProfileDto,
    @RequestContextDecorator() ctx: RequestContext,
  ) {
    return this.profileService.updateProfile(user.id, dto, ctx);
  }
}
