export interface EventMemberContentAuthorizer {
  requireMemberContent(userId: string, eventId: string): Promise<void>;
}
