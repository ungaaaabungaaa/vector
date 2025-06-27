// ---- Event payload types ---------------------------------------------------
import type { InvitePayload } from "./events/invite";

export interface NotificationPayloadMap {
  "organization.invite": InvitePayload;
  // add new mappings here
}

export type NotificationType = keyof NotificationPayloadMap;

// ---- Channel payload types -------------------------------------------------

export interface ChannelPayloadMap {
  email: {
    to: string;
  };
  // webhook: { url: string }; // example future channel
  // sms: { phone: string };
}

export type ChannelType = keyof ChannelPayloadMap;

export type ChannelProps = Partial<{
  [K in ChannelType]: ChannelPayloadMap[K];
}>;
