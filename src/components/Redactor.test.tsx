import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MASK } from "@/lib/redact";
import { Redactor } from "./Redactor";

const SAMPLE = "Alice emailed bob@acme.com.\nAlice's code is 4242.";

function setup() {
  const user = userEvent.setup();
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  render(<Redactor />);
  return { user, writeText };
}

async function open(user: ReturnType<typeof userEvent.setup>, text = SAMPLE) {
  await user.click(screen.getByLabelText("Text"));
  await user.paste(text);
  return screen.findByTestId("viewer");
}

const word = (viewer: HTMLElement, value: string) =>
  within(viewer)
    .getAllByText(value, { selector: "[data-word]" })
    .at(0)!;

describe("Redactor", () => {
  beforeEach(() => {
    document.documentElement.setAttribute("data-theme", "light");
  });

  it("opens pasted text in the viewer", async () => {
    const { user } = setup();
    const viewer = await open(user);
    expect(viewer).toHaveTextContent("Alice emailed bob@acme.com.");
  });

  it("opens typed text with the start button", async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText("Text"), "top secret");
    await user.click(screen.getByLabelText("Start"));
    expect(await screen.findByTestId("viewer")).toHaveTextContent("top secret");
  });

  it("redacts every occurrence of a clicked word and lists it", async () => {
    const { user } = setup();
    const viewer = await open(user);

    await user.click(word(viewer, "Alice"));

    const marks = within(viewer).getAllByText(MASK);
    expect(marks).toHaveLength(2);
    expect(viewer).not.toHaveTextContent("Alice");
    const list = screen.getByRole("list", { name: "Terms" });
    expect(within(list).getByText("Alice")).toBeInTheDocument();
    expect(within(list).getByText("2")).toBeInTheDocument();
  });

  it("treats an email as a single clickable word", async () => {
    const { user } = setup();
    const viewer = await open(user);
    await user.click(word(viewer, "bob@acme.com"));
    expect(viewer).toHaveTextContent(`emailed ${MASK}.`);
  });

  it("restores a term when its redaction is clicked", async () => {
    const { user } = setup();
    const viewer = await open(user);
    await user.click(word(viewer, "4242"));
    await user.click(within(viewer).getByText(MASK));
    expect(viewer).toHaveTextContent("4242");
    expect(screen.queryByRole("list", { name: "Terms" })).not.toBeInTheDocument();
  });

  it("removes a term from the side panel", async () => {
    const { user } = setup();
    const viewer = await open(user);
    await user.click(word(viewer, "Alice"));
    await user.click(screen.getByLabelText("Remove Alice"));
    expect(within(viewer).queryByText(MASK)).not.toBeInTheDocument();
  });

  it("adds a typed term from the side panel", async () => {
    const { user } = setup();
    const viewer = await open(user);
    await user.type(screen.getByLabelText("Add term"), "code is{Enter}");
    expect(viewer).toHaveTextContent(`Alice's ${MASK} 4242.`);
  });

  it("clears all terms", async () => {
    const { user } = setup();
    const viewer = await open(user);
    await user.click(word(viewer, "Alice"));
    await user.click(word(viewer, "4242"));
    await user.click(screen.getByLabelText("Clear all"));
    expect(within(viewer).queryByText(MASK)).not.toBeInTheDocument();
  });

  it("copies the redacted text to the clipboard", async () => {
    const { user, writeText } = setup();
    const viewer = await open(user);
    await user.click(word(viewer, "Alice"));
    await user.click(word(viewer, "4242"));
    await user.click(screen.getByRole("button", { name: /copy/i }));

    expect(writeText).toHaveBeenCalledWith(`${MASK} emailed bob@acme.com.\n${MASK}'s code is ${MASK}.`);
    expect(await screen.findByRole("button", { name: /copied/i })).toBeInTheDocument();
  });

  it("opens a file from the file picker", async () => {
    const { user } = setup();
    const file = new File(["from a file"], "notes.md", { type: "text/markdown" });
    await user.upload(screen.getByTestId("file-input"), file);
    expect(await screen.findByTestId("viewer")).toHaveTextContent("from a file");
    expect(screen.getByText("notes.md")).toBeInTheDocument();
  });

  it("opens a dropped file", async () => {
    setup();
    const file = new File(["dropped text"], "log.txt", { type: "text/plain" });
    const dataTransfer = { types: ["Files"], files: [file], getData: () => "" };

    fireEvent.dragEnter(screen.getByLabelText("Text"), { dataTransfer });
    const overlay = screen.getByTestId("drop-overlay");
    await act(async () => {
      fireEvent.drop(overlay, { dataTransfer });
    });

    expect(await screen.findByTestId("viewer")).toHaveTextContent("dropped text");
    expect(screen.queryByTestId("drop-overlay")).not.toBeInTheDocument();
  });

  it("rejects binary files and stays on the start screen", async () => {
    const { user } = setup();
    const file = new File([new Uint8Array([0, 1, 2, 3])], "a.bin");
    await user.upload(screen.getByTestId("file-input"), file);
    expect(await screen.findByText("Can't read this file")).toBeInTheDocument();
    expect(screen.queryByTestId("viewer")).not.toBeInTheDocument();
  });

  it("starts over", async () => {
    const { user } = setup();
    await open(user);
    await user.click(screen.getByLabelText("Start over"));
    expect(screen.getByLabelText("Text")).toBeInTheDocument();
  });

  it("toggles and remembers the theme", async () => {
    const { user } = setup();
    await user.click(screen.getByLabelText("Toggle theme"));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("theme")).toBe("dark");
    await user.click(screen.getByLabelText("Toggle theme"));
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });
});
