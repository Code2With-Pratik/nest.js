type Environment = Record<string, unknown>;

export function validateEnvironment(environment: Environment): Environment {
  const errors: string[] = [];
  const port = Number(environment.PORT ?? 3000);
  const frontendUrl = environment.FRONTEND_URL;
  const databaseUrl = environment.DATABASE_URL;
  const accessSecret = environment.JWT_ACCESS_SECRET;
  const refreshSecret = environment.JWT_REFRESH_SECRET;
  const accessTokenTtlSeconds = parseDuration(
    environment.ACCESS_TOKEN_TTL ?? '15m',
    'ACCESS_TOKEN_TTL',
    errors,
  );
  const refreshTokenTtlSeconds = parseDuration(
    environment.REFRESH_TOKEN_TTL ?? '7d',
    'REFRESH_TOKEN_TTL',
    errors,
  );

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push('PORT must be an integer between 1 and 65535');
  }

  if (typeof frontendUrl !== 'string' || !isHttpUrl(frontendUrl)) {
    errors.push('FRONTEND_URL must be a valid HTTP or HTTPS URL');
  }

  if (typeof databaseUrl !== 'string' || !isPostgresUrl(databaseUrl)) {
    errors.push('DATABASE_URL must be a valid PostgreSQL connection URL');
  }

  if (typeof accessSecret !== 'string' || accessSecret.length < 32) {
    errors.push('JWT_ACCESS_SECRET must be at least 32 characters long');
  }

  if (typeof refreshSecret !== 'string' || refreshSecret.length < 32) {
    errors.push('JWT_REFRESH_SECRET must be at least 32 characters long');
  }

  if (
    typeof accessSecret === 'string' &&
    accessSecret === refreshSecret
  ) {
    errors.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration: ${errors.join('; ')}`);
  }

  return {
    ...environment,
    PORT: port,
    ACCESS_TOKEN_TTL_SECONDS: accessTokenTtlSeconds,
    REFRESH_TOKEN_TTL_SECONDS: refreshTokenTtlSeconds,
  };
}

function parseDuration(
  value: unknown,
  variableName: string,
  errors: string[],
): number {
  if (typeof value !== 'string') {
    errors.push(`${variableName} must be a duration in seconds, minutes, hours, or days`);
    return 0;
  }

  const match = /^([1-9]\d*)(s|m|h|d)$/.exec(value);
  if (!match) {
    errors.push(`${variableName} must be a duration in seconds, minutes, hours, or days`);
    return 0;
  }

  const amount = Number(match[1]);
  const unitSeconds = { s: 1, m: 60, h: 3600, d: 86400 } as const;
  const seconds = amount * unitSeconds[match[2] as keyof typeof unitSeconds];
  if (!Number.isSafeInteger(seconds) || seconds < 1) {
    errors.push(`${variableName} is outside the supported duration range`);
    return 0;
  }

  return seconds;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isPostgresUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'postgres:' || url.protocol === 'postgresql:';
  } catch {
    return false;
  }
}
