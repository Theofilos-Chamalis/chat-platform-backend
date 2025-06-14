import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { UserDocument } from 'src/users/schemas/user.schema';

interface AuthenticatedRequest extends Request {
  user?: UserDocument;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() === 'http') {
      const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
      const { method, url, user } = request;
      const userContext = user?._id ? ` (User: ${user._id.toString()})` : '';
      const message = `--> ${method} ${url}${userContext}`;
      this.logger.log(message);

      const now = Date.now();
      return next.handle().pipe(
        tap(() => {
          const response = context.switchToHttp().getResponse<Response>();
          const delay = Date.now() - now;
          this.logger.log(
            `<-- ${method} ${url} - ${response.statusCode} (${delay}ms)`,
          );
        }),
      );
    }
    return next.handle();
  }
}
