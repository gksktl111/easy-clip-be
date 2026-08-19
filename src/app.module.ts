import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ClipsModule } from './clips/clips.module';
import { FoldersModule } from './folders/folders.module';
import { MetricsModule } from './shared/metrics.module';
import { PrismaModule } from './prisma/prisma.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { TrashModule } from './trash/trash.module';
import { UsersModule } from './users/users.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { createPinoHttpOptions } from './shared/infrastructure/pino-logger.config';

const envFilePath =
  process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath,
      isGlobal: true,
    }),
    LoggerModule.forRoot({
      pinoHttp: createPinoHttpOptions(process.env),
    }),
    ScheduleModule.forRoot(),
    MetricsModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    FoldersModule,
    ClipsModule,
    WorkspacesModule,
    SubscriptionsModule,
    TrashModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
