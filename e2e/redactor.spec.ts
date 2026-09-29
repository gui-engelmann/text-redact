import { expect, test, type Page } from "@playwright/test";
import { docx, pdf } from "../test/fixtures";

const MASK = "[REDACTED]";
const SAMPLE = "Contact Jane Doe at jane@corp.io.\nJane approved invoice 7781.";

async function paste(page: Page, text: string) {
  await page.getByLabel("Text").focus();
  await page.evaluate((value) => {
    const data = new DataTransfer();
    data.setData("text/plain", value);
    document.activeElement!.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
    );
  }, text);
  await expect(page.getByTestId("viewer")).toBeVisible();
}

const word = (page: Page, value: string) =>
  page.getByTestId("viewer").locator("[data-word]", { hasText: new RegExp(`^${value}$`) }).first();

test("paste, click words, copy the redacted text", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await paste(page, SAMPLE);

  await word(page, "jane@corp.io").click();
  await word(page, "Jane").click();
  await word(page, "7781").click();

  const viewer = page.getByTestId("viewer");
  await expect(viewer.getByText(MASK)).toHaveCount(4);
  await expect(page.getByRole("list", { name: "Terms" }).getByRole("listitem")).toHaveCount(3);

  await page.getByRole("button", { name: "Copy" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(`Contact ${MASK} Doe at ${MASK}.\n${MASK} approved invoice ${MASK}.`);
});

test("select a phrase to redact it", async ({ page }) => {
  await page.goto("/");
  await paste(page, SAMPLE);

  const first = word(page, "Jane");
  const second = word(page, "Doe");
  const a = (await first.boundingBox())!;
  const b = (await second.boundingBox())!;
  await page.mouse.move(a.x + 1, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width - 1, b.y + b.height / 2, { steps: 5 });
  await page.mouse.up();

  await expect(page.getByRole("list", { name: "Terms" })).toContainText("Jane Doe");
  await expect(page.getByTestId("viewer")).toContainText(`Contact ${MASK} at`);
});

test("click a redaction to restore it", async ({ page }) => {
  await page.goto("/");
  await paste(page, SAMPLE);
  await word(page, "7781").click();
  await page.getByTestId("viewer").getByText(MASK).click();
  await expect(page.getByTestId("viewer")).toContainText("invoice 7781");
});

test("upload a file", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("file-input").setInputFiles({
    name: "server.log",
    mimeType: "text/plain",
    buffer: Buffer.from("user=admin password=hunter2"),
  });
  await expect(page.getByTestId("viewer")).toContainText("password=hunter2");
  await expect(page.getByText("server.log")).toBeVisible();
});

test("upload a PDF", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("file-input").setInputFiles({
    name: "contract.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(pdf([["Signed by Jane Doe", "Account 4417-2231"], ["Page two: Jane"]])),
  });
  const viewer = page.getByTestId("viewer");
  await expect(viewer).toContainText("Signed by Jane Doe");
  await expect(viewer).toContainText("Page two: Jane");
  await word(page, "Jane").click();
  await expect(viewer.getByText(MASK)).toHaveCount(2);
});

test("upload a Word document", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("file-input").setInputFiles({
    name: "memo.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: Buffer.from(docx(["Memo for Jane", "Budget: $40,000"])),
  });
  await expect(page.getByTestId("viewer")).toContainText("Budget: $40,000");
});

test("an unreadable file shows an error", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("file-input").setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]),
  });
  await expect(page.getByText("Can't read this file")).toBeVisible();
});

test("drag and drop a file", async ({ page }) => {
  await page.goto("/");
  const dataTransfer = await page.evaluateHandle(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(["dropped secret 123"], "drop.csv", { type: "text/csv" }));
    return dt;
  });
  await page.getByLabel("Text").dispatchEvent("dragenter", { dataTransfer });
  await page.getByTestId("drop-overlay").dispatchEvent("drop", { dataTransfer });
  await expect(page.getByTestId("viewer")).toContainText("dropped secret 123");
});

test("theme toggle persists across reloads", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.getByLabel("Toggle theme").click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
});

test("follows the system theme by default", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
