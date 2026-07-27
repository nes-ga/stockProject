import dotenv from "dotenv";

dotenv.config();
process.env.PORTFOLIO_DATA_MODE ??= "repository-development";

await import("./server.js");
