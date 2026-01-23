import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { FoldersModule } from './folders/folders.module';

@Module({
  imports: [PrismaModule, FoldersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
