import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async signIn(email: string, pass: string): Promise<{ access_token: string }> {
    this.logger.debug(`Attempting to sign in user with email: ${email}`);
    const user = await this.usersService.findByEmail(email);

    if (!user || !(await bcrypt.compare(pass, user.password))) {
      this.logger.warn(`Failed sign-in attempt for email: ${email}`);
      throw new UnauthorizedException('Invalid email or password.');
    }

    const payload = { sub: user._id.toString(), email: user.email };
    this.logger.log(`User ${email} signed in successfully.`);
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }

  async validateUser(userId: string) {
    this.logger.debug(`Validating user with ID: ${userId}`);
    const user = await this.usersService.findById(userId);
    if (!user) {
      this.logger.error(`Validation failed: User with ID ${userId} not found.`);
      throw new UnauthorizedException('User not found.');
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user.toObject();
    return result;
  }
}
