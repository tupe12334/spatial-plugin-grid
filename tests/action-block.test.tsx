import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ActionBlock } from "../src";

afterEach(cleanup);

it("renders label, description and icon, and activates on click", () => {
  const onActivate = vi.fn();
  render(
    <ActionBlock
      label="Billing"
      description="Invoices and plans"
      icon={<span>$</span>}
      onActivate={onActivate}
    />,
  );
  const button = screen.getByRole("button", { name: /Billing/ });
  expect(button.textContent).toContain("Invoices and plans");
  fireEvent.click(button);
  expect(onActivate).toHaveBeenCalledTimes(1);
});

it("reflects selected state for assistive tech without blocking activation", () => {
  render(<ActionBlock label="Billing" selected onActivate={() => {}} />);
  const button = screen.getByRole("button", { name: "Billing" });
  expect(button.getAttribute("aria-pressed")).toBe("true");
});

it("disabled blocks activation", () => {
  const onActivate = vi.fn();
  render(<ActionBlock label="Billing" disabled onActivate={onActivate} />);
  fireEvent.click(screen.getByRole("button", { name: "Billing" }));
  expect(onActivate).not.toHaveBeenCalled();
});
