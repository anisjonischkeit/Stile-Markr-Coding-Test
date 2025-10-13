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

  app.get("/results/:testId/aggregate", {}, async (req, reply) => {
    const { testId } = req.params as { testId: string };

    const results = await db
      .select({ obtainedMarks: testResultsTable.obtainedMarks })
      .from(testResultsTable)
      .where(eq(testResultsTable.testId, testId));

    if (results.length === 0) {
      return reply
        .status(404)
        .send({ error: "No results found for this test" });
    }

    const count = results.length;
    let sum = 0;
    let sumSquares = 0;
    let min = Infinity;
    let max = -Infinity;
    const marks = new Array(count);
    for (let i = 0; i < count; i++) {
      const mark = results[i]!.obtainedMarks;
      marks[i] = mark;
      sum += mark;
      sumSquares += mark * mark;
      if (mark < min) min = mark;
      if (mark > max) max = mark;
    }

    const mean = sum / count;

    marks.sort((a, b) => a - b);

    const p25Index = Math.ceil(count * 0.25) - 1;
    const p50Index = Math.ceil(count * 0.5) - 1;
    const p75Index = Math.ceil(count * 0.75) - 1;

    const p25 = marks[p25Index];
    const p50 = marks[p50Index];
    const p75 = marks[p75Index];

    return reply.send({
      mean,
      count,
      p25,
      p50,
      p75,
      min,
      max,
    });
  });

  return app;
};
