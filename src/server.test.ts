import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { app } from "./app";

describe("API Server", () => {
  describe("POST /import", () => {
    const validXmlPayload = `
    <mcq-test-results>
        <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
            <first-name>Jane</first-name>
            <last-name>Austen</last-name>
            <student-number>521585128</student-number>
            <test-id>1234</test-id>
            <answer question="1" marks-available="1" marks-awarded="1">A</answer>
            <answer question="2" marks-available="1" marks-awarded="0">B</answer>
            <answer question="4" marks-available="1" marks-awarded="1">AC</answer>
            <summary-marks available="20" obtained="13" />
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
      const response = await app.inject({
        method: "POST",
        url: "/import",
        headers: {
          "content-type": "text/xml+markr",
        },
        payload: validXmlPayload,
      });

      expect(response.statusCode, response.body).toBe(200);
      //expect(JSON.parse(response.body)).toEqual({
      //  result: 'Hello test',
      //});
    });

    it("should reject XML missing critical information", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/import",
        headers: {
          "content-type": "text/xml+markr",
        },
        payload: xmlMissingCriticalInfo,
      });

      expect(response.statusCode, response.body).toBe(400);
      //expect(JSON.parse(response.body)).toEqual({
      //  result: 'Hello test',
      //});
    });
  });
});
