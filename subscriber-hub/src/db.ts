import { PrismaClient } from "@prisma/client";

// Single shared Prisma client instance. Every route/service imports this
// rather than instantiating its own client, so we don't exhaust DB connections.
export const prisma = new PrismaClient();
