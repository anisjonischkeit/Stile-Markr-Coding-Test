import Fastify from "fastify";
import { parseXMLResults } from "./schemas/xmlResults";
import { testResultsTable } from "./db/schema";
import { eq, and } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";

type CreateAppContext = {
  db: NodePgDatabase;
};

export const createApp = async ({ db }: CreateAppContext) => {
  const app = Fastify();

  app.addContentTypeParser(
    ["*"],
    { parseAs: "string" }, // parse body as string
    (req, body, done) => {
      done(null, body); // body is a string here
    },
  );

  app.post("/import", {}, async (req, reply) => {
    let parsedBody;
    try {
      parsedBody = parseXMLResults(req.body as string);
    } catch (err) {
      app.log.info(`Failed to parse body in /import ${err}`);
      return reply.status(400).send({
        error: "Invalid XML",
      });
    }

    if (!parsedBody.success) {
      return reply.status(400).send({
        error: parsedBody.error.issues,
      });
    }

    const mcqResults = parsedBody.data;

    for (const result of mcqResults["mcq-test-results"]["mcq-test-result"]) {
      const newRecord = {
        studentNumber: result["student-number"],
        testId: result["test-id"],
        firstName: result["first-name"],
        lastName: result["last-name"],
        scannedOn: result["@_scanned-on"],
        availableMarks: result["summary-marks"]["@_available"],
        obtainedMarks: result["summary-marks"]["@_obtained"],
      };

      try {
        await db.insert(testResultsTable).values(newRecord);
      } catch (error) {
        await db.transaction(async (tx) => {
          const existing = await tx
            .select()
            .from(testResultsTable)
            .where(
              and(
                eq(testResultsTable.testId, newRecord.testId),
                eq(testResultsTable.studentNumber, newRecord.studentNumber),
              ),
            )
            .limit(1);

          if (existing.length > 0) {
            const existingRecord = existing[0]!;
            if (newRecord.obtainedMarks > existingRecord.obtainedMarks) {
              await tx
                .delete(testResultsTable)
                .where(
                  and(
                    eq(testResultsTable.testId, newRecord.testId),
                    eq(testResultsTable.studentNumber, newRecord.studentNumber),
                  ),
                );

              await tx.insert(testResultsTable).values(newRecord);
            }
          }
        });
      }
    }

    return reply.send();
  });

  return app;
};
