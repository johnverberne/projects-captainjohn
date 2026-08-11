const { test, expect } = require("@playwright/test");
const path = require("path");
const fs = require("fs");

const E2E_EMAIL = process.env.E2E_EMAIL || "e2e@example.com";
const E2E_PASSWORD = process.env.E2E_PASSWORD || "e2e-pass-123";

/** Tiny 1×1 PNG for upload tests */
function fixturePng() {
  const file = path.join(__dirname, "fixtures", "dot.png");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) {
    const buf = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    fs.writeFileSync(file, buf);
  }
  return file;
}

test.describe.configure({ mode: "serial" });

test("film: publiek bekijken → inloggen → bewerken → prullenbak", async ({
  page,
}) => {
  const png = fixturePng();
  page.on("dialog", (dialog) => dialog.accept());

  // 1) Publieke homepage
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Captain John/i })).toBeVisible();
  await expect(
    page.getByText(/Bekijk de atelierprojecten van Captain John/i)
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Inloggen" })).toBeVisible();
  await expect(page.getByText("E2E showcase project")).toBeVisible();

  // 2) Project openen (read-only)
  await page.getByRole("link", { name: /E2E showcase project/i }).click();
  await expect(page).toHaveURL(/\/project\//);
  await expect(page.getByText(/Publieke weergave/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Bewerken" })).toHaveCount(0);

  // 3) Inloggen
  await page.getByRole("link", { name: "Inloggen" }).click();
  await expect(page).toHaveURL(/\/inloggen/);
  await page.locator("#email").fill(E2E_EMAIL);
  await page.locator("#password").fill(E2E_PASSWORD);
  await page.locator("button.btn-primary").filter({ hasText: /^Inloggen$/ }).click();
  await expect(page).toHaveURL(/\/bewerken/);
  await expect(
    page.getByText(/Bewerk je atelierprojecten vanaf je telefoon/i)
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Nieuw project starten" })
  ).toBeVisible();

  // 4) Nieuw project met label + foto
  await page.getByRole("link", { name: "Nieuw project starten" }).click();
  await expect(page).toHaveURL(/\/bewerken\/nieuw/);
  await page.locator("#title").fill("E2E film project");
  await page.getByRole("button", { name: "Overige", exact: true }).click();
  await page.getByPlaceholder(/Nieuw label/i).fill("Film");
  await page.getByRole("button", { name: "Toevoegen" }).click();
  await expect(page.getByText("Film").first()).toBeVisible();

  // Geen click op "Lokale foto" — dat opent een native file dialog
  await page.locator('input[type="file"][multiple]').first().setInputFiles(png);

  await page.getByRole("button", { name: "Project opslaan" }).click();
  await expect(page).toHaveURL(/\/bewerken\/project\//);
  await expect(
    page.getByRole("heading", { name: "E2E film project" })
  ).toBeVisible();

  // 5) Stap toevoegen
  await page.getByRole("button", { name: "Stap toevoegen" }).click();
  await page.locator("#step-title").fill("Afwerking");
  await page.getByRole("button", { name: "Hout", exact: true }).click();
  await page.getByRole("button", { name: "Stap opslaan" }).click();
  await expect(page.getByText("Afwerking").first()).toBeVisible();

  // 6) Soft-delete project → prullenbak → terugzetten
  await page.getByRole("button", { name: "Verwijderen", exact: true }).click();
  await expect(page).toHaveURL(/\/bewerken\/?$/);
  await expect(page.getByText("Verwijderde projecten")).toBeVisible();
  await expect(page.getByText("E2E film project")).toBeVisible();

  await page.getByRole("button", { name: "Terugzetten" }).first().click();
  await expect(
    page.getByRole("link", { name: /E2E film project/i })
  ).toBeVisible();

  // 7) Uitloggen → publiek
  await page.getByRole("button", { name: "Uitloggen" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Inloggen" })).toBeVisible();
  await expect(
    page.getByText(/Bekijk de atelierprojecten van Captain John/i)
  ).toBeVisible();
});
