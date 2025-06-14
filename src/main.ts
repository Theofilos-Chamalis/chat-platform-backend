import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { getConfiguration } from './utils/configuration';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import * as compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configuration = getConfiguration();
  const logger = new Logger('Bootstrap');

  app.use(helmet());
  app.use(compression());

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Chat Platform API')
    .setDescription('The API documentation for the Chat Platform.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(configuration.server.port ?? '0.0.0.0');
  logger.log(
    `Application is running on: http://localhost:${configuration.server.port}`,
  );
  logger.log(
    `Swagger is running on: http://localhost:${configuration.server.port}/swagger`,
  );
}
bootstrap();
