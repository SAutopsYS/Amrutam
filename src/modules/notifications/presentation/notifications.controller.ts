import { Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/request-context.decorator';
import {
  ApiStandardErrorResponses,
  successEnvelopeExample,
} from '@common/swagger/api-responses.decorator';
import { NotificationService } from '../application/services/notification.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@ApiStandardErrorResponses()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({
    summary: 'List user notifications',
    description: 'Returns notifications for the authenticated user, newest first.',
  })
  @ApiOkResponse({ description: 'Notification list', schema: { example: successEnvelopeExample } })
  list(@CurrentUser() user: { id: string }) {
    return this.notificationService.getUserNotifications(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiOkResponse({
    description: 'Notification updated',
    schema: { example: successEnvelopeExample },
  })
  markRead(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.notificationService.markAsRead(user.id, id);
  }
}
