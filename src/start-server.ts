import { createApp } from "./app.ts";
import { db } from "./db/db.ts";

const start = async () => {
  try {
    const app = await createApp({ db });
    await app.listen({ host: "0.0.0.0", port: 4567 });
    console.log("Server running at 0.0.0.0:4567");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
