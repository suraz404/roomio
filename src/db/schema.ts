import {
  pgTable,
  uuid,
  text,
  timestamp,
  unique,
  pgEnum,
} from "drizzle-orm/pg-core";

export const spaceRoleEnum = pgEnum("space_role", ["admin", "member"]);
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
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
