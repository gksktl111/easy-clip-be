import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ClipsModule } from './clips/clips.module';
import { FoldersModule } from './folders/folders.module';
import { PrismaModule } from './prisma/prisma.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { TrashModule } from './trash/trash.module';
import { UsersModule } from './users/users.module';
import { WorkspacesModule } from './workspaces/workspaces.module';

const envFilePath =
  process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath,
      isGlobal: true,
    }),
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
