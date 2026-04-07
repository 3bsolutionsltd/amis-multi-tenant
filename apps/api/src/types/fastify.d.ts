import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    user: {
      tenantId: string;
      role: string;
      userId: string;
    };
  }
}
