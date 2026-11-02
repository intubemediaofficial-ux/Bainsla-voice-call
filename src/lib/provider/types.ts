export type ProviderCallStatus = "SUBMITTED" | "RINGING" | "IN_PROGRESS" | "COMPLETED" | "NO_ANSWER" | "BUSY" | "FAILED" | "REJECTED" | "CANCELLED";

export type ParsedWebhook = {
  providerCallId: string;
  eventId: string;
  status: ProviderCallStatus;
  durationSeconds?: number;
  dtmf?: string;
  reason?: string;
  transient?: boolean;
  redacted: Record<string, unknown>;
};

export type CreateCallInput = {
  to: string;
  verifiedCallerId: string;
  approvedAudioUrl: string;
  audioDurationSeconds: number;
  idempotencyKey: string;
  statusCallbackUrl: string;
  attemptId: string;
};

export class ProviderError extends Error {
  constructor(
    message: string,
    public transient: boolean,
  ) {
    super(message);
  }
}

export interface TelephonyProvider {
  key: string;
  label: string;
  configured(): boolean;
  listVerifiedCallerIds(tenantId: string): Promise<{ phone: string; ref: string }[]>;
  createVoiceCall(input: CreateCallInput): Promise<{ providerCallId: string; status: ProviderCallStatus }>;
  verifyWebhook(headers: Record<string, string>, rawBody: Buffer, url: URL): boolean;
  parseWebhook(rawBody: Buffer, headers: Record<string, string>): ParsedWebhook;
}
