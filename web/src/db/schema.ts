import {
  bigint,
  boolean,
  date,
  datetime,
  double,
  index,
  int,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';

/**
 * Az adatbázis-séma: a Java backend (Flyway V1–V20) táblái, Drizzle-ben. Az oszlopnevek és a típusok megegyeznek az
 * eredetivel, így a meglévő adatok SQL-ből átvihetők, és a dashboard/widget API-szerződése változatlan marad.
 * Az időpontok UTC-ben, ezredmásodperc pontossággal tárolódnak (a kapcsolat `timezone: 'Z'`-vel nyílik).
 */

const ts = (name: string) => datetime(name, { mode: 'date', fsp: 3 });
const id = () => int('id').autoincrement().primaryKey();

export const users = mysqlTable('users', {
  id: id(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  createdAt: ts('created_at').notNull().$defaultFn(() => new Date()),
  /** Az ennél korábban kiadott bejelentkezési tokenek érvénytelenek (jelszó-visszaállítás után). */
  passwordChangedAt: ts('password_changed_at'),
  notifyEmail: boolean('notify_email').notNull().default(true),
  emailVerifiedAt: ts('email_verified_at'),
  emailVerifyHash: varchar('email_verify_hash', { length: 64 }).unique(),
  emailVerifyExpiresAt: ts('email_verify_expires_at'),
  emailVerifySentAt: ts('email_verify_sent_at'),
  /** OFF, DAILY vagy WEEKLY. */
  digestFrequency: varchar('digest_frequency', { length: 10 }).notNull().default('OFF'),
  digestLastSentAt: ts('digest_last_sent_at'),
  totpSecret: varchar('totp_secret', { length: 64 }),
  totpEnabledAt: ts('totp_enabled_at'),
  totpLastStep: bigint('totp_last_step', { mode: 'number' }),
  totpRecoveryHashes: varchar('totp_recovery_hashes', { length: 700 }),
});

export const passwordResetTokens = mysqlTable(
  'password_reset_tokens',
  {
    id: id(),
    userId: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    expiresAt: ts('expires_at').notNull(),
    usedAt: ts('used_at'),
    createdAt: ts('created_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('idx_password_reset_user').on(t.userId, t.createdAt)],
);

export const projects = mysqlTable('projects', {
  id: id(),
  ownerId: int('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 160 }).notNull(),
  siteUrl: varchar('site_url', { length: 500 }).notNull(),
  shareToken: varchar('share_token', { length: 64 }).notNull().unique(),
  createdAt: ts('created_at').notNull().$defaultFn(() => new Date()),
  webhookUrl: varchar('webhook_url', { length: 500 }),
  webhookSecret: varchar('webhook_secret', { length: 32 }),
  widgetColor: varchar('widget_color', { length: 7 }),
  /** RIGHT vagy LEFT. */
  widgetPosition: varchar('widget_position', { length: 5 }).notNull().default('RIGHT'),
  /** hu vagy en. */
  widgetLang: varchar('widget_lang', { length: 2 }).notNull().default('hu'),
  archivedAt: ts('archived_at'),
});

export const projectMembers = mysqlTable(
  'project_members',
  {
    id: id(),
    projectId: int('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    userId: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: ts('created_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex('uk_project_members').on(t.projectId, t.userId)],
);

export const projectInvites = mysqlTable(
  'project_invites',
  {
    id: id(),
    projectId: int('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    invitedBy: int('invited_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: ts('created_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex('uk_project_invites').on(t.projectId, t.email), index('idx_project_invites_email').on(t.email)],
);

export const rounds = mysqlTable(
  'rounds',
  {
    id: id(),
    projectId: int('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    number: int('number').notNull(),
    /** OPEN vagy CLOSED. */
    status: varchar('status', { length: 20 }).notNull().default('OPEN'),
    createdAt: ts('created_at').notNull().$defaultFn(() => new Date()),
    closedAt: ts('closed_at'),
    approvedAt: ts('approved_at'),
    approvedBy: varchar('approved_by', { length: 120 }),
    dueDate: date('due_date', { mode: 'string' }),
  },
  (t) => [uniqueIndex('uk_rounds_project_number').on(t.projectId, t.number)],
);

export const comments = mysqlTable(
  'comments',
  {
    id: id(),
    roundId: int('round_id').notNull().references(() => rounds.id, { onDelete: 'cascade' }),
    authorName: varchar('author_name', { length: 120 }).notNull(),
    body: text('body').notNull(),
    pageUrl: varchar('page_url', { length: 1000 }).notNull(),
    cssSelector: varchar('css_selector', { length: 1000 }),
    posX: double('pos_x'),
    posY: double('pos_y'),
    areaWidth: double('area_width'),
    areaHeight: double('area_height'),
    viewportWidth: int('viewport_width'),
    viewportHeight: int('viewport_height'),
    userAgent: varchar('user_agent', { length: 500 }),
    screenshotPath: varchar('screenshot_path', { length: 500 }),
    /** OPEN, IN_PROGRESS vagy DONE. */
    status: varchar('status', { length: 20 }).notNull().default('OPEN'),
    createdAt: ts('created_at').notNull().$defaultFn(() => new Date()),
    customerEmail: varchar('customer_email', { length: 254 }),
    notifyToken: varchar('notify_token', { length: 32 }).unique(),
    customerApprovedAt: ts('customer_approved_at'),
    assigneeId: int('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    editTokenHash: varchar('edit_token_hash', { length: 64 }),
    editedAt: ts('edited_at'),
    /** LOW, NORMAL, HIGH vagy URGENT. */
    priority: varchar('priority', { length: 10 }).notNull().default('NORMAL'),
    /** Vesszővel elválasztott, kisbetűs címkék. */
    labels: varchar('labels', { length: 255 }).notNull().default(''),
  },
  (t) => [index('idx_comments_round').on(t.roundId), index('idx_comments_assignee').on(t.assigneeId)],
);

export const replies = mysqlTable(
  'replies',
  {
    id: id(),
    commentId: int('comment_id').notNull().references(() => comments.id, { onDelete: 'cascade' }),
    authorName: varchar('author_name', { length: 120 }).notNull(),
    /** DESIGNER (csapat) vagy CUSTOMER. */
    authorType: varchar('author_type', { length: 20 }).notNull(),
    userId: int('user_id').references(() => users.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    createdAt: ts('created_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('idx_replies_comment').on(t.commentId)],
);

export const attachments = mysqlTable(
  'attachments',
  {
    id: id(),
    commentId: int('comment_id').notNull().references(() => comments.id, { onDelete: 'cascade' }),
    /** A tárolóhoz viszonyított útvonal. */
    path: varchar('path', { length: 500 }).notNull(),
    contentType: varchar('content_type', { length: 50 }).notNull(),
    sizeBytes: int('size_bytes').notNull(),
    createdAt: ts('created_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('idx_attachments_comment').on(t.commentId)],
);

export const activity = mysqlTable(
  'activity',
  {
    id: id(),
    projectId: int('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    /** USER vagy CUSTOMER. */
    actorType: varchar('actor_type', { length: 10 }).notNull(),
    actorName: varchar('actor_name', { length: 120 }).notNull(),
    event: varchar('event', { length: 40 }).notNull(),
    commentId: int('comment_id').references(() => comments.id, { onDelete: 'set null' }),
    summary: varchar('summary', { length: 500 }).notNull(),
    createdAt: ts('created_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('idx_activity_project').on(t.projectId, t.id)],
);

export const apiKeys = mysqlTable(
  'api_keys',
  {
    id: id(),
    userId: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 80 }).notNull(),
    prefix: varchar('prefix', { length: 12 }).notNull(),
    keyHash: varchar('key_hash', { length: 64 }).notNull().unique(),
    createdAt: ts('created_at').notNull().$defaultFn(() => new Date()),
    lastUsedAt: ts('last_used_at'),
  },
  (t) => [index('idx_api_keys_user').on(t.userId)],
);
