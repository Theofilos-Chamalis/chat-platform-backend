import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getConfiguration } from './utils/configuration';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const bootstrapStartTimestamp = performance.now();
  const serverConfiguration = getConfiguration().server;

  const app = await NestFactory.create(AppModule);
  await app.listen(serverConfiguration.port ?? '0.0.0.0');

  const bootstrapDuration =
    Math.floor(((performance.now() - bootstrapStartTimestamp) * 100) / 1000) /
    100;

  Logger.debug(
    `Listening at ${serverConfiguration.serverUrl}:${serverConfiguration.port} in ${bootstrapDuration}s`,
  );
}
bootstrap();
