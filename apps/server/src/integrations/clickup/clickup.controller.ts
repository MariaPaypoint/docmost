import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ClickUpService } from './clickup.service';

@Controller('api/clickup')
@UseGuards(JwtAuthGuard)
export class ClickUpController {
  constructor(private readonly clickUpService: ClickUpService) {}

  @Get('task/:taskId')
  async getTaskDetails(@Param('taskId') taskId: string) {
    return this.clickUpService.getTaskDetails(taskId);
  }
}
