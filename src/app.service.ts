import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): { status: string; message: string } {
    return { status: 'OK', message: 'Application is up and running' };
  }
}
