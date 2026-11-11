import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const rooms = sqliteTable('likolo_rooms', {
 code: text('code').primaryKey(), data: text('data').notNull(), revision: integer('revision').notNull().default(0), expires: integer('expires').notNull()
});
