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
import { MfaService } from '../application/services/mfa.service';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  UpdateProfileDto,
  VerifyMfaSetupDto,
  MfaChallengeDto,
  DisableMfaDto,
} from '../application/dto/auth.dto';
import { JwtAuthGuard } from '../infrastructure/jwt-auth.guard';

@ApiTags('Auth')
@ApiStandardErrorResponses()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly profileService: ProfileService,
    private readonly mfaService: MfaService,
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
  @ApiOperation({
    summary: 'Login with email and password',
    description:
      'If MFA is enabled for the account, returns `{ mfaRequired: true, mfaToken }` instead of access tokens. Complete login via POST /auth/mfa/verify.',
  })
  @ApiOkResponse({
    description: 'Tokens or MFA challenge',
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

  @Get('mfa/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get MFA enrollment status' })
  mfaStatus(@CurrentUser() user: { id: string }) {
    return this.mfaService.getStatus(user.id);
  }

  @Post('mfa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Begin MFA enrollment',
    description:
      'Generates encrypted TOTP secret, QR code (data URL), and one-time backup recovery codes. Confirm with POST /auth/mfa/verify-setup.',
  })
  @ApiOkResponse({ description: 'Secret + QR + recovery codes' })
  enableMfa(
    @CurrentUser() user: { id: string; email: string },
    @RequestContextDecorator() ctx: RequestContext,
  ) {
    return this.mfaService.beginSetup(user.id, user.email, ctx);
  }

  @Post('mfa/verify-setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm MFA setup with TOTP code' })
  verifyMfaSetup(
    @CurrentUser() user: { id: string },
    @Body() dto: VerifyMfaSetupDto,
    @RequestContextDecorator() ctx: RequestContext,
  ) {
    return this.mfaService.verifySetup(user.id, dto, ctx);
  }

  @Post('mfa/verify')
  @Public()
  @ApiOperation({
    summary: 'Complete MFA challenge after login',
    description: 'Exchange mfaToken + OTP (or recovery code) for access/refresh tokens.',
  })
  @ApiOkResponse({ description: 'Access and refresh tokens' })
  verifyMfaChallenge(@Body() dto: MfaChallengeDto, @RequestContextDecorator() ctx: RequestContext) {
    return this.authService.completeMfaLogin(dto, ctx);
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable MFA (requires password + OTP or recovery code)' })
  disableMfa(
    @CurrentUser() user: { id: string },
    @Body() dto: DisableMfaDto,
    @RequestContextDecorator() ctx: RequestContext,
  ) {
    return this.mfaService.disable(user.id, dto, ctx);
  }
}
