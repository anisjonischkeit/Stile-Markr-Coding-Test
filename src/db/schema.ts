import { integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

export const testResultsTable = pgTable(
  "test_results",
  {
    studentNumber: text("student_number").notNull(),
    testId: text("test_id").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    scannedOn: text("scanned_on"),
    availableMarks: integer("available_marks").notNull(),
    obtainedMarks: integer("obtained_marks").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.testId, table.studentNumber] }),
  }),
);
