import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(createUserDto: CreateUserDto): Promise<Omit<User, 'password'>> {
    const { email, password } = createUserDto;
    this.logger.debug(`Attempting to create user with email: ${email}`);

    const existingUser = await this.userModel.findOne({ email }).exec();
    if (existingUser) {
      this.logger.warn(`User with email ${email} already exists.`);
      throw new ConflictException(
        `A user with email '${email}' already exists.`,
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const createdUser = new this.userModel({
      email,
      password: hashedPassword,
    });

    const user = await createdUser.save();
    this.logger.log(
      `Successfully created user with ID: ${user._id.toString()}`,
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...result } = user.toObject();
    return result;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    this.logger.debug(`Searching for user with email: ${email}`);
    return this.userModel.findOne({ email }).exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    this.logger.debug(`Searching for user with ID: ${id}`);
    return this.userModel.findById(id).exec();
  }
}
