import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import type { Cart } from "@/lib/cart";
import { validateCheckout, type CheckoutForm } from "@/lib/checkout";
import { CheckoutView } from "./CheckoutScreen";

const cart: Cart = [{ id: "p1", name: "Pizza", unitPrice: 900, quantity: 2, image: "/p1.jpg" }];
const empty: CheckoutForm = { fulfilment: "delivery", name: "", phone: "", address: "" };

function render(
  props: Partial<React.ComponentProps<typeof CheckoutView>> & { submitted?: boolean } = {},
) {
  const { submitted, ...rest } = props;
  const form = rest.form ?? empty;
  return renderToStaticMarkup(
    <CheckoutView
      cart={cart}
      hydrated
      form={form}
      errors={submitted ? validateCheckout(form) : {}}
      failed={false}
      pending={false}
      onChange={() => {}}
      onSubmit={() => {}}
      {...rest}
    />,
  );
}

describe("CheckoutView", () => {
  it("offers Delivery and Collection, with Delivery chosen first (AC1)", () => {
    const html = render();
    expect(html).toContain("How do you want your order");
    expect(html).toMatch(/<input type="radio" name="fulfilment" checked="" value="delivery"/);
    expect(html).toMatch(/<input type="radio" name="fulfilment" value="collection"/);
  });

  it("shows an address field for Delivery only (AC2, AC3)", () => {
    expect(render()).toContain('id="address"');
    expect(render({ form: { ...empty, fulfilment: "collection" } })).not.toContain('id="address"');
  });

  it("shows the order summary and one primary Place order button (AC10)", () => {
    const html = render();
    expect(html).toContain('aria-label="Order summary"');
    expect(html.match(/btn-primary/g)).toHaveLength(1);
    expect(html).toContain(">Place order</button>");
  });

  it("shows the name error when only the name is missing (AC4)", () => {
    const html = render({
      submitted: true,
      form: { fulfilment: "collection", name: "", phone: "0123456789", address: "" },
    });
    expect(html).toContain("Enter your name");
    expect(html).toMatch(/id="name"[^>]*aria-invalid="true"/);
    expect(html).not.toContain("Enter a phone number");
  });

  it("shows the phone error when only the phone is missing, too short or too long (AC5, AC16, AC17)", () => {
    for (const phone of ["", "123456789", "1234567890123456"]) {
      const html = render({ submitted: true, form: { fulfilment: "collection", name: "Ana", phone, address: "" } });
      expect(html).toContain("Enter a phone number with 10 to 15 digits");
      expect(html).not.toContain("Enter your name");
    }
  });

  it("shows the address error for an empty address or one without a PIN code (AC6, AC18)", () => {
    const base = { fulfilment: "delivery" as const, name: "Ana", phone: "0123456789" };
    const empty = render({ submitted: true, form: { ...base, address: "" } });
    expect(empty).toContain("Enter your address");
    expect(empty).toMatch(/id="address"[^>]*aria-invalid="true"/);
    expect(render({ submitted: true, form: { ...base, address: "12 MG Road, Bengaluru" } })).toContain(
      "6-digit PIN code",
    );
  });

  it("shows no address error before Place order is pressed (AC7)", () => {
    const html = render();
    expect(html).not.toContain("Enter your address");
    expect(html).not.toContain("aria-invalid");
  });

  it("shows no error for a complete delivery form (AC19)", () => {
    const html = render({
      submitted: true,
      form: { fulfilment: "delivery", name: "Ana", phone: "0123456789", address: "12 MG Road, Bengaluru, 560103" },
    });
    expect(html).not.toContain("field-error");
  });

  it("disables Place order while the order is submitted (AC20)", () => {
    const html = render({ pending: true });
    expect(html).toMatch(/<button type="submit" class="btn btn-primary" disabled="">Placing order…<\/button>/);
  });

  it("shows the 'order not placed' alert and keeps values, cart and an enabled button (AC12-AC14)", () => {
    const form: CheckoutForm = {
      fulfilment: "delivery",
      name: "Ana",
      phone: "0123456789",
      address: "12 MG Road, Bengaluru, 560103",
    };
    const html = render({ failed: true, form });
    expect(html).toContain('role="alert"');
    expect(html).toContain("Your order was not placed");
    expect(html).toContain("Your details and cart are still here");
    expect(html).toContain('value="Ana"');
    expect(html).toContain('value="0123456789"');
    expect(html).toContain('value="12 MG Road, Bengaluru, 560103"');
    expect(html).toContain("Pizza");
    expect(html).not.toContain("disabled");
  });

  it("shows no alert when nothing has failed", () => {
    expect(render()).not.toContain('role="alert"');
  });

  it("shows an empty state with a way back to the menu once the cart is read and empty", () => {
    const html = render({ cart: [] });
    expect(html).toContain("empty-state");
    expect(html).toContain('href="/menu"');
    expect(html).not.toContain(">Place order<");
  });

  it("does not flash the empty state before the cart is read", () => {
    const html = render({ cart: [], hydrated: false });
    expect(html).not.toContain("empty-state");
  });
});
