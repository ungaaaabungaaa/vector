import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';
import { authComponent, createAuth } from './auth';

const http = httpRouter();

http.route({
  path: '/webhooks/github',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    await ctx.runAction(internal.github.actions.processWebhook, {
      body,
      event: request.headers.get('x-github-event') ?? 'unknown',
      deliveryId: request.headers.get('x-github-delivery') ?? undefined,
      signature: request.headers.get('x-hub-signature-256') ?? undefined,
    });

    return new Response('ok', { status: 200 });
  }),
});

authComponent.registerRoutes(http, createAuth, {
  cors: true,
});

export default http;
