import { z } from 'zod';
import type {
  NotificationPayloadMap,
  NotificationType,
  ChannelPayloadMap,
  ChannelType,
  ChannelProps,
} from './types';

export type NotificationChannel = ChannelType;

export type ChannelSender<Payload> = (payload: Payload) => Promise<void>;

export interface NotificationDefinition<Schema extends z.ZodTypeAny> {
  type: string;
  schema: Schema;
  // Each channel sender receives combined event + channel props (without the `channel` field)
  channels: {
    [K in ChannelType]?: (
      data: z.infer<Schema> & ChannelPayloadMap[K],
    ) => Promise<void>;
  };
}

// Registry stores definitions keyed by type. Using `z.ZodTypeAny` keeps full schema typing
// without resorting to `any`, maintaining type-safety across the system.
const registry: Record<string, NotificationDefinition<z.ZodTypeAny>> = {};

export function defineNotification<Schema extends z.ZodTypeAny>(
  def: NotificationDefinition<Schema>,
) {
  if (registry[def.type]) {
    throw new Error(`Notification type '${def.type}' already defined`);
  }
  registry[def.type] = def as unknown as NotificationDefinition<z.ZodTypeAny>;

  // Return a strongly-typed sender helper for the notification
  return async function sendNotification(
    payload: z.infer<Schema>,
    channel: NotificationChannel = 'email',
  ) {
    // Validate payload via schema
    def.schema.parse(payload);

    const sender = def.channels[channel];
    if (!sender) {
      throw new Error(
        `Channel '${channel}' not supported for notification type '${def.type}'`,
      );
    }
    await sender(payload);
  };
}

export async function notify<T extends NotificationType>(
  type: T,
  payload: NotificationPayloadMap[T],
  channels: ChannelProps,
) {
  const def = registry[type];
  if (!def) throw new Error(`Unknown notification type '${type}'`);

  // Validate event payload first
  def.schema.parse(payload);

  for (const channelKey of Object.keys(channels) as ChannelType[]) {
    const sender = def.channels[channelKey];
    if (!sender) {
      throw new Error(`Channel '${channelKey}' not supported for '${type}'`);
    }

    const channelSpecificData = channels[
      channelKey
    ] as ChannelPayloadMap[typeof channelKey];
    await sender({ ...payload, ...channelSpecificData });
  }
}
