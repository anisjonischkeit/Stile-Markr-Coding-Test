import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createApp } from "./app";
import { db } from "./db/db.ts";
import { testResultsTable } from "./db/schema.ts";

describe("API Server", () => {
  describe("POST /import", () => {
    beforeEach(async () => {
      // clear the testResultsTable before running tests
      await db.delete(testResultsTable);
    });

    const validXmlPayload = ({
      marksObtained = 13,
      scannedOn = "2017-12-04T12:12:10+11:00",
    } = {}) => `
    <mcq-test-results>
        <mcq-test-result scanned-on="${scannedOn}">
            <first-name>Jane</first-name>
            <last-name>Austen</last-name>
            <student-number>521585128</student-number>
            <test-id>1234</test-id>
            <answer question="1" marks-available="1" marks-awarded="1">A</answer>
            <answer question="2" marks-available="1" marks-awarded="0">B</answer>
            <answer question="4" marks-available="1" marks-awarded="1">AC</answer>
            <summary-marks available="20" obtained="${marksObtained}" />
        </mcq-test-result>
    </mcq-test-results>`;

    const xmlMissingCriticalInfo = `
    <mcq-test-results>
        <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
            <first-name>Jane</first-name>
            <last-name>Austen</last-name>
            <test-id>1234</test-id>
            <summary-marks available="20" obtained="13" />
        </mcq-test-result>
    </mcq-test-results>`;

    it("should handle valid XML request", async () => {
      const app = await createApp({ db });
      const response = await app.inject({
        method: "POST",
        url: "/import",
        headers: {
          "content-type": "text/xml+markr",
        },
        payload: validXmlPayload(),
      });

      expect(response.statusCode, response.body).toBe(200);

      const results = await db.select().from(testResultsTable);
      expect(results.length).toBe(1);
      expect(results[0]).toMatchInlineSnapshot(`
        {
          "availableMarks": 20,
          "firstName": "Jane",
          "lastName": "Austen",
          "obtainedMarks": 13,
          "scannedOn": "2017-12-04T12:12:10+11:00",
          "studentNumber": "521585128",
          "testId": "1234",
        }
      `);
    });

    it("should take the first import if the first import has higher obtained marks", async () => {
      const app = await createApp({ db });
      await app.inject({
        method: "POST",
        url: "/import",
        headers: {
          "content-type": "text/xml+markr",
        },
        payload: validXmlPayload({
          marksObtained: 15,
          scannedOn: "2017-12-04T12:12:10+11:00",
        }),
      });

      await app.inject({
        method: "POST",
        url: "/import",
        headers: {
          "content-type": "text/xml+markr",
        },
        payload: validXmlPayload({
          marksObtained: 13,
          scannedOn: "2017-12-04T12:13:10+11:00",
        }),
      });

      const results = await db.select().from(testResultsTable);
      expect(results[0]).toMatchInlineSnapshot(`
        {
          "availableMarks": 20,
          "firstName": "Jane",
          "lastName": "Austen",
          "obtainedMarks": 15,
          "scannedOn": "2017-12-04T12:12:10+11:00",
          "studentNumber": "521585128",
          "testId": "1234",
        }
      `);
    });

    it("should take the second import if the second import has higher obtained marks", async () => {
      const app = await createApp({ db });
      await app.inject({
        method: "POST",
        url: "/import",
        headers: {
          "content-type": "text/xml+markr",
        },
        payload: validXmlPayload({
          marksObtained: 13,
          scannedOn: "2017-12-04T12:12:10+11:00",
        }),
      });

      await app.inject({
        method: "POST",
        url: "/import",
        headers: {
          "content-type": "text/xml+markr",
        },
        payload: validXmlPayload({
          marksObtained: 15,
          scannedOn: "2017-12-04T12:13:10+11:00",
        }),
      });

      const results = await db.select().from(testResultsTable);
      expect(results[0]).toMatchInlineSnapshot(`
        {
          "availableMarks": 20,
          "firstName": "Jane",
          "lastName": "Austen",
          "obtainedMarks": 15,
          "scannedOn": "2017-12-04T12:13:10+11:00",
          "studentNumber": "521585128",
          "testId": "1234",
        }
      `);
    });

    it("should reject XML missing critical information", async () => {
      const app = await createApp({ db });
      const response = await app.inject({
        method: "POST",
        url: "/import",
        headers: {
          "content-type": "text/xml+markr",
        },
        payload: xmlMissingCriticalInfo,
      });

      expect(response.statusCode, response.body).toBe(400);
    });
  });
});
