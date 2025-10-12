import Fastify from "fastify";
import { parseMCQResultsStr } from "./schemas/mcqResults";

export const app = Fastify();

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
    parsedBody = parseMCQResultsStr(req.body as string);
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

  return reply.send({ result: `Hello world` });
});
