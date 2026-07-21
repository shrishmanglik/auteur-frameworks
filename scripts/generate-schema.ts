import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { UniversalPacketSchema } from "../src/schemas.js";

const output = path.resolve("schemas", "universal-packet.schema.json");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(z.toJSONSchema(UniversalPacketSchema), null, 2) + "\n", "utf8");
console.log(output);
