import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ContinuationInputSchema, UniversalPacketSchema } from "../src/schemas.js";

const outputs = [
  ["universal-packet.schema.json", UniversalPacketSchema],
  ["continuation-input.schema.json", ContinuationInputSchema],
] as const;

for (const [filename, schema] of outputs) {
  const output = path.resolve("schemas", filename);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(z.toJSONSchema(schema), null, 2) + "\n", "utf8");
  console.log(output);
}
