import {
  pgTable,
  uuid,
  text,
  timestamp,
  unique,
  pgEnum,
  boolean,
  integer,
  check,
  jsonb,
  index,
  uniqueIndex,
  date,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const expenseAuditActionEnum = pgEnum("expense_audit_action", [
  "CREATE",
  "UPDATE",
  "DELETE",
  "RESTORE",
]);

export const spaceRoleEnum = pgEnum("space_role", ["admin", "member"]);
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "rejected",
  "revoked",
  "expired",
]);
export const spaces = pgTable("spaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const space_members = pgTable(
  "space_members",
  {
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id),
    space_id: uuid("space_id")
      .notNull()
      .references(() => spaces.id),
    role: spaceRoleEnum("role").notNull(),
  },
  (table) => [unique().on(table.user_id, table.space_id)],
);
export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id),

    title: text("title").notNull(),

    // Amount stored in paisa
    amount: integer("amount").notNull(),

    // Who created the expense in Roomio?
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),

    // Who actually paid?
    paidBy: uuid("paid_by")
      .notNull()
      .references(() => users.id),

    spentOn: date("spent_on").notNull().defaultNow(),
    version: integer("version").notNull().default(1),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),

    // Soft deletion
    deletedAt: timestamp("deleted_at", { withTimezone: true }),

    deletedBy: uuid("deleted_by").references(() => users.id),
  },
  (table) => [
    check("expenses_amount_positive", sql`${table.amount} > 0`),
    check(
      "expenses_deletion_metadata_consistent",
      sql`(${table.deletedAt} IS NULL AND ${table.deletedBy} IS NULL)
          OR (${table.deletedAt} IS NOT NULL AND ${table.deletedBy} IS NOT NULL)`,
    ),
    index("expenses_space_spent_on_idx").on(table.spaceId, table.spentOn),
  ],
);
export const expense_splits = pgTable(
  "expense_splits",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),

    // This user's share, stored in paisa
    amount: integer("amount").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique().on(table.expenseId, table.userId),
    check("expense_splits_amount_positive", sql`${table.amount} > 0`),
  ],
);
export const expenseAuditLogs = pgTable(
  "expense_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id),

    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),

    action: expenseAuditActionEnum("action").notNull(),

    oldValues: jsonb("old_values").$type<Record<string, unknown>>(),

    newValues: jsonb("new_values").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("expense_audit_logs_expense_id_idx").on(table.expenseId),
    index("expense_audit_logs_actor_id_idx").on(table.actorId),
  ],
);
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id),

    // Stored lowercase, so "Sita@X.com" and "sita@x.com" are the same invite.
    email: text("email").notNull(),

    // SHA-256 of the token. The token itself is never stored.
    tokenHash: text("token_hash").notNull().unique(),

    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => users.id),

    status: invitationStatusEnum("status").notNull().default("pending"),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    respondedAt: timestamp("responded_at", { withTimezone: true }),

    acceptedBy: uuid("accepted_by").references(() => users.id),
  },
  (table) => [
    // At most one pending invite per email per space.
    uniqueIndex("invitations_one_pending_per_email")
      .on(table.spaceId, table.email)
      .where(sql`${table.status} = 'pending'`),

    check(
      "invitations_accepted_has_user",
      sql`(${table.status} = 'accepted') = (${table.acceptedBy} IS NOT NULL)`,
    ),

    check(
      "invitations_email_lowercase",
      sql`${table.email} = lower(${table.email})`,
    ),
  ],
);
