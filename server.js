import app from "./src/app.js";
import { env } from "./src/configs/env.js";
import redis from "./src/configs/redis.js";
import "./src/queues/click.worker.js";

const PORT = env.port;
await redis.connect();

app.listen(PORT, () => {
  console.log(`Server is running on https://localhost:${PORT}`);
});
