import { test } from "node:test";
import { testApp } from "./helpers.mjs";
import { apiScenario } from "./api-scenario.mjs";
test("authentication, isolation, editor, conflicts, history and exports", () =>
  apiScenario(testApp));
