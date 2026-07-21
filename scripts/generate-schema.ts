import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ContinuationInputSchema, UniversalPacketSchema } from "../src/schemas.js";

const outputs = [
  ["universal-packet.schema.json", UniversalPacketSchema],
  ["continuation-input.schema.json", ContinuationInputSchema],
] as const;

const makeDefaultedPropertiesOptional = (value: unknown): void => {
  if (Array.isArray(value)) {
    value.forEach(makeDefaultedPropertiesOptional);
    return;
  }
  if (!value || typeof value !== "object") return;

  const node = value as Record<string, unknown>;
  const properties = node.properties;
  if (Array.isArray(node.required) && properties && typeof properties === "object") {
    const propertySchemas = properties as Record<string, unknown>;
    node.required = node.required.filter((key): key is string => (
      typeof key === "string"
      && !(propertySchemas[key] && typeof propertySchemas[key] === "object"
        && Object.hasOwn(propertySchemas[key] as object, "default"))
    ));
  }
  Object.values(node).forEach(makeDefaultedPropertiesOptional);
};

for (const [filename, schema] of outputs) {
  const output = path.resolve("schemas", filename);
  const jsonSchema = z.toJSONSchema(schema);
  makeDefaultedPropertiesOptional(jsonSchema);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(jsonSchema, null, 2) + "\n", "utf8");
  console.log(output);
}
