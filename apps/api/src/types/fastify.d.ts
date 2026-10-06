import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    user: {
      tenantId: string;
      role: string;
      roles: string[];
      userId: string;
    };
  }
}
