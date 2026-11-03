"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Cart } from "@/lib/cart";
import {
  newIdempotencyKey,
  placeOrder,
  submitOrder,
  validateCheckout,
  type AttemptMemo,
  type CheckoutErrors,
  type CheckoutForm,
  type Fulfilment,
} from "@/lib/checkout";
import { MENU_HREF, ORDER_CONFIRMED_HREF } from "@/lib/shell";
import { useCart } from "../cart/CartProvider";
import { Icon } from "../orders/Icon";
import { OrderSummary } from "./OrderSummary";

const FULFILMENTS: { id: Fulfilment; label: string }[] = [
  { id: "delivery", label: "Delivery" },
  { id: "collection", label: "Collection" },
];

type FieldName = "name" | "phone" | "address";

type ViewProps = {
  cart: Cart;
  hydrated: boolean;
  form: CheckoutForm;
  /** Errors are shown only after Place order has been pressed. */
  errors: CheckoutErrors;
  failed: boolean;
  pending: boolean;
  onChange: (patch: Partial<CheckoutForm>) => void;
  onSubmit: () => void;
  alertRef?: React.Ref<HTMLDivElement>;
  fieldRef?: (name: FieldName) => React.Ref<HTMLInputElement>;
};

function Field({
  id,
  label,
  value,
  error,
  type = "text",
  autoComplete,
  onChange,
  inputRef,
}: {
  id: FieldName;
  label: string;
  value: string;
  error?: string;
  type?: string;
  autoComplete: string;
  onChange: (value: string) => void;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        className={`input${error ? " is-invalid" : ""}`}
        id={id}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        value={value}
        ref={inputRef}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

/** The Checkout markup, including its failed-order state. Takes everything as props so it can be rendered in any state. */
export function CheckoutView({
  cart,
  hydrated,
  form,
  errors,
  failed,
  pending,
  onChange,
  onSubmit,
  alertRef,
  fieldRef,
}: ViewProps) {
  if (hydrated && cart.length === 0) {
    return (
      <div className="page stack stack-4">
        <h1>Checkout</h1>
        <div className="empty-state">
          <h2>Your cart is empty</h2>
          <p>Add something from the menu, then come back to place your order.</p>
          <a className="btn btn-primary" href={MENU_HREF}>
            Back to menu
          </a>
        </div>
      </div>
    );
  }

  return (
    <form
      className="page stack stack-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <h1>Checkout</h1>

      {failed && (
        <div className="alert alert-danger" role="alert" tabIndex={-1} ref={alertRef}>
          <Icon name="alert" />
          <div>
            <strong>Your order was not placed</strong>
            <p>Something went wrong on our side. Your details and cart are still here. Try again.</p>
          </div>
        </div>
      )}

      <fieldset className="radio-group">
        <legend className="field-label">How do you want your order</legend>
        {FULFILMENTS.map((f) => (
          <label className="radio-option" key={f.id}>
            <input
              type="radio"
              name="fulfilment"
              value={f.id}
              checked={form.fulfilment === f.id}
              onChange={() => onChange({ fulfilment: f.id })}
            />
            {f.label}
          </label>
        ))}
      </fieldset>

      <Field
        id="name"
        label="Name"
        autoComplete="name"
        value={form.name}
        error={errors.name}
        inputRef={fieldRef?.("name")}
        onChange={(name) => onChange({ name })}
      />
      <Field
        id="phone"
        label="Phone number"
        type="tel"
        autoComplete="tel"
        value={form.phone}
        error={errors.phone}
        inputRef={fieldRef?.("phone")}
        onChange={(phone) => onChange({ phone })}
      />
      {form.fulfilment === "delivery" && (
        <Field
          id="address"
          label="Address"
          autoComplete="street-address"
          value={form.address}
          error={errors.address}
          inputRef={fieldRef?.("address")}
          onChange={(address) => onChange({ address })}
        />
      )}

      <OrderSummary cart={cart} />

      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Placing order…" : "Place order"}
        </button>
      </div>
    </form>
  );
}

const FIELD_ORDER: FieldName[] = ["name", "phone", "address"];

export function CheckoutScreen() {
  const router = useRouter();
  const { cart, hydrated, clear } = useCart();
  const [form, setForm] = useState<CheckoutForm>({ fulfilment: "delivery", name: "", phone: "", address: "" });
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  // Keeps the summary on screen while navigating away, so clearing the cart does not flash the empty state.
  const [placed, setPlaced] = useState<Cart | null>(null);
  const memo = useRef<AttemptMemo | null>(null);
  const busy = useRef(false);
  const alertRef = useRef<HTMLDivElement>(null);
  const fields = useRef<Partial<Record<FieldName, HTMLInputElement | null>>>({});

  useEffect(() => {
    if (failed) alertRef.current?.focus();
  }, [failed]);

  const errors = submitted ? validateCheckout(form) : {};

  async function onSubmit() {
    if (busy.current) return;
    setSubmitted(true);
    const invalid = validateCheckout(form);
    const first = FIELD_ORDER.find((f) => invalid[f]);
    if (first) {
      setFailed(false);
      fields.current[first]?.focus();
      return;
    }
    busy.current = true;
    setPending(true);
    setFailed(false);
    try {
      const outcome = await submitOrder({ placeOrder, newKey: newIdempotencyKey }, memo, form, cart);
      if (outcome.type === "placed") {
        setPlaced(cart);
        clear();
        router.push(`${ORDER_CONFIRMED_HREF}?number=${encodeURIComponent(outcome.number)}`);
        return;
      }
      setFailed(true);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <CheckoutView
      cart={placed ?? cart}
      hydrated={hydrated}
      form={form}
      errors={errors}
      failed={failed}
      pending={pending || placed !== null}
      onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
      onSubmit={onSubmit}
      alertRef={alertRef}
      fieldRef={(name) => (el) => {
        fields.current[name] = el;
      }}
    />
  );
}
