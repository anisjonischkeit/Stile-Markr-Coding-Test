import { XMLParser } from "fast-xml-parser";
import z from "zod";

const XMLResultsSchema = z.object({
  "mcq-test-results": z.object({
    "mcq-test-result": z.array(
      z.object({
        "@_scanned-on": z.string().optional(),
        "first-name": z.string(),
        "last-name": z.string(),
        "test-id": z.string(),
        "student-number": z.string(),
        "summary-marks": z.object({
          "@_available": z.string().transform((x) => parseInt(x)),
          "@_obtained": z.string().transform((x) => parseInt(x)),
        }),
      }),
    ),
  }),
});

const xmlParser = new XMLParser({
  attributeNamePrefix: "@_",
  ignoreAttributes: false,
  // Don't automatically parse number looking things into numbers
  numberParseOptions: {
    hex: false,
    leadingZeros: false,
    eNotation: false,
    skipLike: /.*/,
  },
  // This is a bit of a nasty hack to get test-results to always be an
  // array, as it is impossible to tell whether an element could have
  // multiple children based on just the xml data. I couldn't find an
  // xml parser into which I could pass something like a zod schema
  isArray: (name) => ["mcq-test-result"].includes(name),
});

export const parseXMLResults = (str: string) => {
  const parsedXML = xmlParser.parse(str);
  console.log(JSON.stringify(parsedXML, null, 2));

  return XMLResultsSchema.safeParse(parsedXML);
};
