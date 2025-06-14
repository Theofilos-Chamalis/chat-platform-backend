import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { getConfiguration } from 'src/utils/configuration';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({
      secret: getConfiguration().authCrypto.jwtSecret,
      signOptions: { expiresIn: getConfiguration().authCrypto.jwtExpiresIn },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
