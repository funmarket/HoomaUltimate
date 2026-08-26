import type { TelegramIdentityInput } from "@hooma/auth";
import type {
  PlayerProfileInput,
  ProfileIdentity,
  ProfileUpdateInput,
} from "@hooma/contracts/profile";

export interface WebCredentialRecord {
  readonly userId: string;
  readonly passwordHash: string;
  readonly failedLoginCount: number;
  readonly lockedUntil: Date | null;
}

export interface SessionRecord {
  readonly userId: string;
}

export interface LoginMethodsRecord {
  readonly web: {
    readonly loginUsername: string;
    readonly email: string | null;
  } | null;
  readonly telegram: {
    readonly telegramUsername: string | null;
  } | null;
}

export type TelegramLinkResult =
  | { readonly kind: "linked"; readonly userId: string }
  | { readonly kind: "telegram_conflict" }
  | { readonly kind: "account_conflict" };

export interface PublicProfileRecord {
  readonly presentation: {
    readonly username: string;
    readonly displayName: string;
    readonly photoUrl: string | null;
    readonly bio: string | null;
  };
  readonly identities: readonly ProfileIdentity[];
  readonly player: {
    readonly skillLevel: PlayerProfileInput["skillLevel"];
    readonly preferredPositions: readonly string[];
    readonly overallRating: number;
  } | null;
  readonly teams: readonly {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly badgeUrl: string | null;
  }[];
}

export interface ProfileRecord {
  readonly id: string;
  readonly presentation: {
    readonly username: string;
    readonly displayName: string;
    readonly photoUrl: string | null;
    readonly bio: string | null;
  };
  readonly identities: readonly ProfileIdentity[];
  readonly player: {
    readonly skillLevel: PlayerProfileInput["skillLevel"];
    readonly preferredPositions: readonly string[];
    readonly overallRating: number;
  } | null;
}

export interface ProfileWriteInput {
  readonly username: string;
  readonly displayName: string;
  readonly photoUrl: string | null;
  readonly bio: string | null;
  readonly identities: ProfileUpdateInput["identities"];
  readonly player: ProfileUpdateInput["player"];
}

export interface MeRecord {
  readonly id: string;
  readonly presentation: {
    readonly username: string;
    readonly displayName: string;
    readonly photoUrl: string | null;
    readonly bio: string | null;
  };
  readonly platformRoles: readonly "PLATFORM_ADMIN"[];
  readonly communities: readonly {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly role: "FOUNDER" | "COACH" | "MEMBER";
  }[];
  readonly teams: readonly {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly badgeUrl: string | null;
    readonly isPlayer: boolean;
    readonly responsibilities: readonly ("COACH" | "ASSISTANT")[];
    readonly capabilities: readonly (
      | "EDIT_TEAM"
      | "MANAGE_ROSTER"
      | "MANAGE_LINEUP"
      | "CREATE_CHALLENGE"
      | "RESPOND_TO_CHALLENGE"
      | "MANAGE_TEAM_EVENTS"
    )[];
  }[];
}

export interface IdentityRepository {
  createWebIdentity(input: {
    loginUsername: string;
    passwordHash: string;
    email: string | null;
    displayUsername: string;
    displayName: string;
  }): Promise<string>;
  createWebCredentialForUser(input: {
    userId: string;
    loginUsername: string;
    passwordHash: string;
    email: string | null;
  }): Promise<void>;
  findWebCredential(loginUsername: string): Promise<WebCredentialRecord | null>;
  recordLoginFailure(
    userId: string,
    failedLoginCount: number,
    lockedUntil: Date | null,
  ): Promise<void>;
  recordLoginSuccess(userId: string): Promise<void>;
  createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findActiveSession(tokenHash: string): Promise<SessionRecord | null>;
  revokeSession(tokenHash: string): Promise<void>;
  findTelegramUserId(telegramUserId: bigint): Promise<string | null>;
  upsertTelegramIdentity(input: TelegramIdentityInput): Promise<string>;
  findLoginMethods(userId: string): Promise<LoginMethodsRecord | null>;
  attachTelegramIdentityToUser(
    userId: string,
    identity: TelegramIdentityInput,
  ): Promise<TelegramLinkResult>;
  findPublicProfile(username: string): Promise<PublicProfileRecord | null>;
  findProfile(userId: string): Promise<ProfileRecord | null>;
  addProfileIdentity(userId: string, identity: ProfileIdentity): Promise<void>;
  updateProfile(userId: string, input: ProfileWriteInput): Promise<void>;
  updatePresentation(
    userId: string,
    input: {
      username: string;
      displayName: string;
      photoUrl: string | null;
      bio: string | null;
    },
  ): Promise<void>;
  findMe(userId: string): Promise<MeRecord | null>;
}
