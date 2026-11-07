import {
  pgTable,
  uuid,
  text,
  timestamp,
  unique,
  pgEnum,
  boolean,
  integer,
} from "drizzle-orm/pg-core";

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
export const expenses = pgTable("expenses", {
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

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),

  // Soft deletion
  deletedAt: timestamp("deleted_at"),

  deletedBy: uuid("deleted_by").references(() => users.id),
});
