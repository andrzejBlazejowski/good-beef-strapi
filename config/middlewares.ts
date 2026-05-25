import type { Core } from '@strapi/strapi';

const parseCorsOrigins = (value: string | undefined): string[] => {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

export default ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Middlewares => {
  const corsOriginEnv = parseCorsOrigins(env('CORS_ORIGIN'));
  const corsOrigins =
    corsOriginEnv.length > 0
      ? corsOriginEnv
      : env('CLIENT_URL')
        ? [env('CLIENT_URL')]
        : ['http://localhost:3000'];

  return [
    'strapi::logger',
    'strapi::errors',
    'strapi::security',
    {
      name: 'strapi::cors',
      config: {
        origin: corsOrigins,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
        headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
        credentials: true,
        keepHeaderOnError: true,
      },
    },
    'strapi::poweredBy',
    'strapi::query',
    'strapi::body',
    'strapi::session',
    'strapi::favicon',
    'strapi::public',
  ];
};
