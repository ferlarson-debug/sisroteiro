import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { once } from "node:events";
import express from "express";
import { chromium as playwright } from "playwright-core";
import chromium from "@sparticuz/chromium";
import { testApp } from "./helpers.mjs";

const { app, db } = await testApp();
app.use(express.static("dist"));
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
const errors = [];
try {
  await mkdir("artifacts", { recursive: true });
  browser = await playwright.launch({
    executablePath: await chromium.executablePath(),
    args: chromium.args,
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page
    .getByRole("button", { name: "Criar uma conta", exact: true })
    .click();
  await page.getByLabel("Seu nome").fill("Fernanda");
  await page.getByLabel("E-mail", { exact: true }).fill("fernanda@example.com");
  await page.getByLabel(/^Senha/).fill("test-only-password-123");
  await page.getByRole("button", { name: "Criar meu estúdio" }).click();
  await page
    .getByRole("heading", { name: "Histórias em movimento." })
    .waitFor();
  await page.getByRole("button", { name: "Novo projeto", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel(/Nome da marca/)
    .fill("Aurora Arquitetura");
  await page.getByLabel("Segmento", { exact: true }).fill("Arquitetura");
  await page
    .getByLabel("Público-alvo", { exact: true })
    .fill("Famílias e novos moradores");
  await page
    .getByLabel("Sobre a marca e suas referências")
    .fill(
      "Arquitetura com espaços integrados, luz natural e materiais acolhedores.",
    );
  await page
    .getByRole("button", { name: "Salvar cliente", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Novo projeto", exact: true }).click();
  await page
    .getByLabel(/Cliente/)
    .selectOption({ label: "Aurora Arquitetura" });
  await page.getByLabel(/Nome do projeto/).fill("Uma nova forma de morar");
  await page
    .getByLabel("Objetivo e mensagem principal")
    .fill(
      "Apresentar espaços que transformam a rotina e convidar o público a conhecer a marca.",
    );
  await page.getByLabel(/Duração planejada/).fill("30");
  await page
    .getByRole("button", { name: "Criar projeto", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: /Uma nova forma de morar/ }).click();
  await page
    .getByRole("button", { name: "Adicionar cena", exact: true })
    .click();
  await page
    .getByLabel("Visual da cena 1", { exact: true })
    .fill(
      "Plano aberto da fachada ao amanhecer. Travelling suave em direção à entrada.",
    );
  await page
    .getByLabel("Narração da cena 1", { exact: true })
    .fill("Mais do que um lugar para viver, um espaço para pertencer.");
  await page.getByLabel("Duração da cena 1", { exact: true }).fill("15");
  await page
    .getByRole("button", { name: "Adicionar cena", exact: true })
    .click();
  await page
    .getByLabel("Visual da cena 2", { exact: true })
    .fill(
      "Detalhes dos ambientes, luz natural e materiais. Cortes entre sala, cozinha e varanda.",
    );
  await page
    .getByLabel("Narração da cena 2", { exact: true })
    .fill("Cada detalhe foi pensado para acompanhar o seu jeito de viver.");
  await page.getByLabel("Duração da cena 2", { exact: true }).fill("15");
  await page
    .getByRole("button", { name: "Salvar roteiro", exact: true })
    .filter({ visible: true })
    .click();
  await page.getByText("Tudo salvo", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Duplicar cena 1", exact: true })
    .click();
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  assert.equal(await page.getByRole("article").count(), 2);
  await page.getByRole("button", { name: "Refazer", exact: true }).click();
  assert.equal(await page.getByRole("article").count(), 3);
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await page.getByRole("tab", { name: "Histórico" }).click();
  await page.getByRole("heading", { name: "Versões do roteiro" }).waitFor();
  await page
    .getByRole("button", { name: /Carregar versão/ })
    .first()
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: /Carregar versão/ }).count(),
    2,
  );
  await page.getByRole("tab", { name: "Roteiro" }).click();
  await page.screenshot({
    path: "artifacts/editor-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Exportar", exact: true }).click();
  const pdf = await context.request.get(
    base +
      "/api/projects/" +
      (
        await context.request.get(base + "/api/projects").then((r) => r.json())
      )[0].id +
      "/export/pdf",
  );
  assert.equal(pdf.status(), 200);
  assert.equal((await pdf.body()).subarray(0, 4).toString(), "%PDF");
  await page
    .getByRole("button", { name: "Fechar exportações", exact: true })
    .filter({ visible: true })
    .click();
  await page
    .getByRole("button", { name: "Voltar aos projetos", exact: true })
    .click();
  // Create additional real records exclusively in this isolated test database.
  const c = (
    await context.request.get(base + "/api/clients").then((r) => r.json())
  )[0];
  for (const name of ["Feito para ir além", "O sabor de estar junto"]) {
    const r = await context.request.post(base + "/api/projects", {
      data: {
        client: c.id,
        name,
        objective: "Apresentar a marca ao público.",
        duration: 60,
      },
    });
    assert.equal(r.status(), 201);
  }
  await page.reload();
  await page
    .getByRole("heading", { name: "Histórias em movimento." })
    .waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: "artifacts/projetos-desktop.png",
    fullPage: true,
  });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      viewport: innerWidth,
    }));
    assert.ok(
      dimensions.scroll <= dimensions.viewport,
      `Dashboard overflow ${width}: ${JSON.stringify(dimensions)}`,
    );
    await page.getByRole("button", { name: /Uma nova forma de morar/ }).click();
    const editorDimensions = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      viewport: innerWidth,
    }));
    assert.ok(
      editorDimensions.scroll <= editorDimensions.viewport,
      `Editor overflow ${width}`,
    );
    if (width < 768) {
      assert.equal(
        await page.getByRole("article").filter({ visible: true }).count(),
        1,
      );
      await page
        .getByRole("button", { name: "Próxima cena", exact: true })
        .click();
      await page
        .getByLabel("Visual da cena 2", { exact: true })
        .waitFor({ state: "visible" });
      assert.equal(
        await page.getByLabel("Visual da cena 1", { exact: true }).isVisible(),
        false,
      );
      if (width === 390) {
        await page.screenshot({
          path: "artifacts/editor-celular.png",
          fullPage: false,
        });
        await page
          .getByLabel("Narração da cena 2", { exact: true })
          .fill("Uma história que também pode ser editada no celular.");
        await page
          .getByRole("button", { name: "Salvar roteiro", exact: true })
          .filter({ visible: true })
          .click();
        await page.getByText("Tudo salvo", { exact: true }).waitFor();
      }
    }
    await page
      .getByRole("button", { name: "Voltar aos projetos", exact: true })
      .click();
    if (width === 390)
      await page.screenshot({
        path: "artifacts/projetos-celular.png",
        fullPage: false,
      });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Novo projeto", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page
    .getByLabel("Buscar projeto ou cliente", { exact: true })
    .fill("não existe");
  await page
    .getByRole("heading", { name: "Nenhum resultado por aqui" })
    .waitFor();
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  assert.equal(await page.locator(".projectCard").count(), 3);
  await page
    .getByRole("navigation", { name: "Navegação no celular" })
    .getByRole("button", { name: "Menu", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sair da conta", exact: true })
    .click();
  await page.getByRole("heading", { name: "Bem-vindo de volta" }).waitFor();
  await page.getByLabel("E-mail", { exact: true }).fill("fernanda@example.com");
  await page.getByLabel(/^Senha/).fill("test-only-password-123");
  await page
    .getByRole("button", { name: "Entrar no estúdio", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Histórias em movimento." })
    .waitFor();
  await page.getByRole("button", { name: /Uma nova forma de morar/ }).click();
  await page.getByRole("button", { name: "Próxima cena", exact: true }).click();
  assert.equal(
    await page.getByLabel("Narração da cena 2", { exact: true }).inputValue(),
    "Uma história que também pode ser editada no celular.",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: browser flows, persistence, history, exports and responsive layouts at 320/390/768/1440px. Screenshots in artifacts/.",
  );
  await context.close();
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await db.close();
}
