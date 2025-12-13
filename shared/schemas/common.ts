import { z } from "zod";
import { ObjectId } from "mongodb";

// -----------------------------
// Custom ObjectId Validation
// -----------------------------
export const ObjectIdType = z.string().refine(value => ObjectId.isValid(value), {
  message: "Invalid ObjectId format",
});
