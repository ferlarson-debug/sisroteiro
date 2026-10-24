import { test } from "node:test";
import assert from "node:assert/strict";
import { generateScript } from "../server/ai.mjs";
test("AI adapter validates provider response and total scene timing", async () => {
  const previous = process.env.AI_API_KEY;
  process.env.AI_API_KEY = "test-only-placeholder";
  try {
    const input = {
      client: { name: "Marca" },
      project: { duration: 30, objective: "Apresentar" },
    };
    const response = (duration) => async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                scenes: [{ visual: "Fachada", audio: "Olá", duration }],
              }),
            },
          },
        ],
      }),
    });
    assert.equal((await generateScript(input, response(30)))[0].duration, 30);
    await assert.rejects(
      () => generateScript(input, response(20)),
      /duração inconsistente/,
    );
    await assert.rejects(
      () => generateScript(input, async () => ({ ok: false })),
      /provedor/,
    );
  } finally {
    if (previous === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = previous;
  }
});

test("OpenAI adapter requests structured output and keeps credentials server-side", async () => {
  const previous = process.env.AI_API_KEY;
  process.env.AI_API_KEY = "test-only-placeholder";
  try {
    let payload;
    const scenes = await generateScript(
      {
        client: { name: "Marca", description: "Fonte verificada" },
        project: { duration: 15 },
      },
      async (url, options) => {
        assert.equal(url, "https://api.openai.com/v1/chat/completions");
        payload = JSON.parse(options.body);
        assert.equal(
          options.headers.Authorization,
          "Bearer test-only-placeholder",
        );
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    scenes: [
                      {
                        visual: "Produto",
                        audio: "Conheça a marca.",
                        duration: 15,
                      },
                    ],
                  }),
                },
              },
            ],
          }),
        };
      },
    );
    assert.equal(payload.response_format.json_schema.strict, true);
    assert.equal(scenes.length, 1);
    for (const status of [401, 429])
      await assert.rejects(
        () =>
          generateScript(
            { client: { name: "Marca" }, project: { duration: 15 } },
            async () => ({ ok: false, status }),
          ),
        (e) => e.status === 502,
      );
    await assert.rejects(
      () =>
        generateScript(
          { client: { name: "Marca" }, project: { duration: 15 } },
          async () => ({
            ok: true,
            json: async () => ({
              choices: [{ message: { content: "not JSON" } }],
            }),
          }),
        ),
      (e) => e.status === 502,
    );
  } finally {
    if (previous === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = previous;
  }
});
