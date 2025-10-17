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

    const records = mcqResults["mcq-test-results"]["mcq-test-result"].map((result) => ({
      studentNumber: result["student-number"],
      testId: result["test-id"],
      firstName: result["first-name"],
      lastName: result["last-name"],
      scannedOn: result["@_scanned-on"],
      availableMarks: result["summary-marks"]["@_available"],
      obtainedMarks: result["summary-marks"]["@_obtained"],
    }));

    await db
      .insert(testResultsTable)
      .values(records)
      .onConflictDoUpdate({
        target: [testResultsTable.testId, testResultsTable.studentNumber],
        set: {
          firstName: sql.raw("excluded.first_name"),
          lastName: sql.raw("excluded.last_name"),
          scannedOn: sql.raw("excluded.scanned_on"),
          availableMarks: sql.raw("excluded.available_marks"),
          obtainedMarks: sql.raw("excluded.obtained_marks"),
        },
        where: sql`${testResultsTable.obtainedMarks} < excluded.obtained_marks OR ${testResultsTable.availableMarks} < excluded.available_marks`,
      });

    return reply.send("ok");
  });

  app.get("/results/:testId/aggregate", {}, async (req, reply) => {
    const { testId } = req.params as { testId: string };

    const result = await db.execute(sql`
      WITH percentages AS (
        SELECT (obtained_marks::float / available_marks * 100) as percentage
        FROM test_results
        WHERE test_id = ${testId}
      )
      SELECT
        COUNT(*)::int                                              AS count,
        AVG(percentage)::float                                     AS mean,
        MIN(percentage)                                            AS min,
        MAX(percentage)                                            AS max,
        percentile_disc(0.25) WITHIN GROUP (ORDER BY percentage) AS p25,
        percentile_disc(0.50) WITHIN GROUP (ORDER BY percentage) AS p50,
        percentile_disc(0.75) WITHIN GROUP (ORDER BY percentage) AS p75
      FROM percentages
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
