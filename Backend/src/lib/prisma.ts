import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '../../prisma/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Load Backend/.env from an absolute path so scripts (e.g. seeds run from
// .opencode/ or any other cwd) resolve DATABASE_URL regardless of the working directory.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
