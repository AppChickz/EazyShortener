import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { RedisService } from '../src/cache/redis.service';
import { PrismaService } from '../src/database/prisma.service';
import { MailService } from '../src/mail/mail.service';

export class CapturingMailService {
  readonly verificationUrls: Array<{ to: string; url: string }> = [];

  sendVerificationEmail(to: string, verificationUrl: string): Promise<void> {
    this.verificationUrls.push({ to, url: verificationUrl });
    return Promise.resolve();
  }
}

export class InMemoryRedis {
  readonly values = new Map<string, string>();
  readonly deleted: string[] = [];
  private readonly counters = new Map<string, number>();

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.values.get(key) ?? null);
  }

  setEx(key: string, _ttlSeconds: number, value: string): Promise<void> {
    this.values.set(key, value);
    return Promise.resolve();
  }

  del(key: string): Promise<void> {
    this.values.delete(key);
    this.deleted.push(key);
    return Promise.resolve();
  }

  incrementWithExpiry(key: string, windowSeconds: number): Promise<{ count: number; ttlSeconds: number }> {
    const count = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, count);
    return Promise.resolve({ count, ttlSeconds: windowSeconds });
  }

  ping(): Promise<string> {
    return Promise.resolve('PONG');
  }
}

export async function startE2eApp() {
  const redis = new InMemoryRedis();
  const mail = new CapturingMailService();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(RedisService)
    .useValue(redis)
    .overrideProvider(MailService)
    .useValue(mail)
    .compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(0, '127.0.0.1');

  return {
    app,
    baseUrl: await app.getUrl(),
    prisma: moduleRef.get(PrismaService),
    redis,
    mail,
  };
}
