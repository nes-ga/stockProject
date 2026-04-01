import { app } from "./app.js";
import { config } from "./config.js";

app.listen(config.port, () => {
  console.log(`BAND stock analysis API listening on port ${config.port}`);
});
