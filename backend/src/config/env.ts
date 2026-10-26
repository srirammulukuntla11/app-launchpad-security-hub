import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment variables from backend/.env or cwd .env
const possibleEnvPaths = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(process.cwd(), 'backend/.env'),
  path.resolve(process.cwd(), '.env'),
];

for (const envPath of possibleEnvPaths) {
  dotenv.config({ path: envPath });
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().positive()).default('5000'),
  CLIENT_ORIGIN: z
    .string()
    .refine((val) => !val.split(',').map((s) => s.trim()).includes('*'), {
      message: 'CLIENT_ORIGIN must not include wildcard "*" when credentials are enabled',
    })
    .default('http://localhost:5173'),
  MONGODB_URI: z.string().transform((val) => (val.trim() === '' ? undefined : val.trim())).optional(),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters').default('development_jwt_access_secret_min_32_chars_long!'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_DAYS: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().positive()).default('7'),
  COOKIE_SECRET: z.string().min(16, 'COOKIE_SECRET must be at least 16 characters').default('development_cookie_signing_secret_min_32_chars!'),
});

export type EnvConfig = z.infer<typeof envSchema>;

let parsedEnv: EnvConfig;

try {
  parsedEnv = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    const formattedErrors = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
    throw new Error(`Environment validation failed: ${formattedErrors}`);
  }
  throw error;
}

export const env = parsedEnv;
export { envSchema };
