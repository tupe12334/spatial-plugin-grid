import { readFileSync } from "node:fs";
import { checkPush, head } from "./input-guard.mjs";
import { validate } from "./validate.mjs";
const expectedHead = head();
checkPush(readFileSync(0, "utf8"), expectedHead);
validate(expectedHead);
