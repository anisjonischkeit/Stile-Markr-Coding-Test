import { app } from "./app.ts";

const start = async () => {
  try {
    await app.listen({ port: 4567 });
    console.log("Server running at http://localhost:4567");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
