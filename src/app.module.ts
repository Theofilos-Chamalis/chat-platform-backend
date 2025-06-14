import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ChatsModule } from './chats/chats.module';
import { GroupsModule } from './groups/groups.module';
import { ConfigModule } from '@nestjs/config';
import { getConfiguration } from './utils/configuration';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from './common/common.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `.env.${getConfiguration().server.environment}`,
      isGlobal: true,
    }),
    MongooseModule.forRoot(getConfiguration().database.connectionUrl),
    AuthModule,
    UsersModule,
    GroupsModule,
    ChatsModule,
    CommonModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
