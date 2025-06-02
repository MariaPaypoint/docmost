import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClickUpService } from './clickup.service';
import { ClickUpController } from './clickup.controller';

@Module({
  imports: [
    ConfigModule,
  ],
  controllers: [ClickUpController],
  providers: [ClickUpService],
  exports: [ClickUpService],
})
export class ClickUpModule {}
