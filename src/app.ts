import Fastify from "fastify";
import { parseXMLResults } from "./schemas/xmlResults";
import { testResultsTable } from "./db/schema";
import { eq, and, sql } from "drizzle-orm";
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

      await db
        .insert(testResultsTable)
        .values(newRecord)
        .onConflictDoUpdate({
          target: [testResultsTable.testId, testResultsTable.studentNumber],
          set: {
            firstName: newRecord.firstName,
            lastName: newRecord.lastName,
            scannedOn: newRecord.scannedOn,
            availableMarks: newRecord.availableMarks,
            obtainedMarks: newRecord.obtainedMarks,
          },
          where: sql`${testResultsTable.obtainedMarks} < ${newRecord.obtainedMarks}`,
        });
    }

    return reply.send();
  });

  app.get("/results/:testId/aggregate", {}, async (req, reply) => {
    const { testId } = req.params as { testId: string };

    const result = await db.execute(sql`
      SELECT
        COUNT(*)::int                                              AS count,
        AVG(obtained_marks)::float                                 AS mean,
        MIN(obtained_marks)                                        AS min,
        MAX(obtained_marks)                                        AS max,
        percentile_disc(0.25) WITHIN GROUP (ORDER BY obtained_marks) AS p25,
        percentile_disc(0.50) WITHIN GROUP (ORDER BY obtained_marks) AS p50,
        percentile_disc(0.75) WITHIN GROUP (ORDER BY obtained_marks) AS p75
      FROM test_results
      WHERE test_id = ${testId}
    `);

    if (!result.rows[0] || result.rows[0].count === 0) {
      return reply
        .status(404)
        .send({ error: "No results found for this test" });
    }

    const stats = result.rows[0];

    return reply.send({
      mean: stats.mean,
      count: stats.count,
      p25: Number(stats.p25),
      p50: Number(stats.p50),
      p75: Number(stats.p75),
      min: stats.min,
      max: stats.max,
    });
  });

  return app;
};
