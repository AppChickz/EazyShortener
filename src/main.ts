import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { HttpErrorFilter } from './common/http-error.filter';
import { configureSwagger } from './swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalFilters(new HttpErrorFilter());
  app.useStaticAssets(join(process.cwd(), 'public'));
  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('PORT');
  configureSwagger(app);

  await app.listen(port);
  console.log(`EazyShortener listening on http://localhost:${port}`);
}

void bootstrap();
