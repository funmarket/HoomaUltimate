import type {
  RideCompensationBasis,
  RideOfferCompensationTerms,
  RideRequestCompensationTerms,
} from "@hooma/contracts/rides";
import type { CashCurrency } from "./ride-money";
import { SUPPORTED_CASH_CURRENCIES, amountToMinorUnits } from "./ride-money";

export type RideCompensationFormState = {
  readonly type: "FREE" | "CASH";
  readonly amount: string;
  readonly currency: CashCurrency;
  readonly basis: RideCompensationBasis;
};

export const defaultRideCompensationState: RideCompensationFormState = {
  type: "FREE",
  amount: "",
  currency: "TND",
  basis: "PER_SEAT",
};

export function buildRideOfferCompensationTerms(
  state: RideCompensationFormState,
): RideOfferCompensationTerms {
  if (state.type === "FREE") return { type: "FREE" };
  return {
    type: "CASH",
    amountMinor: amountToMinorUnits(state.amount, state.currency),
    currency: state.currency,
    basis: state.basis,
  };
}

export function buildRideRequestCompensationTerms(
  state: RideCompensationFormState,
): RideRequestCompensationTerms {
  if (state.type === "FREE") return { type: "FREE" };
  return {
    type: "CASH",
    amountMinor: amountToMinorUnits(state.amount, state.currency),
    currency: state.currency,
  };
}

type RideCompensationFieldsProps = {
  readonly mode: "offer" | "request";
  readonly value: RideCompensationFormState;
  readonly onChange: (value: RideCompensationFormState) => void;
};

export function RideCompensationFields({ mode, value, onChange }: RideCompensationFieldsProps) {
  const cashSelected = value.type === "CASH";
  const freeLabel = mode === "offer" ? "Free ride" : "No cash offer";
  const cashLabel = mode === "offer" ? "Charge cash" : "Offer cash";

  function selectFree() {
    onChange({ ...value, type: "FREE", amount: "" });
  }

  function selectCash() {
    onChange({ ...value, type: "CASH" });
  }

  return (
    <section
      className="ride-form-section ride-compensation-fields"
      aria-labelledby="ride-terms-title"
    >
      <div className="ride-form-section__header">
        <p className="eyebrow" id="ride-terms-title">
          {mode === "offer" ? "RIDE TERMS" : "RIDE BUDGET"}
        </p>
        <p>
          {mode === "offer"
            ? "Choose how riders should read your seat offer."
            : "Choose whether your request includes a cash offer."}
        </p>
      </div>
      <div
        className="ride-segmented"
        role="group"
        aria-label={mode === "offer" ? "Ride terms" : "Ride budget"}
      >
        <button
          aria-pressed={!cashSelected}
          className="ride-segmented__option"
          type="button"
          onClick={selectFree}
        >
          {freeLabel}
        </button>
        <button
          aria-pressed={cashSelected}
          className="ride-segmented__option"
          type="button"
          onClick={selectCash}
        >
          {cashLabel}
        </button>
      </div>
      {cashSelected ? (
        <div className="ride-form__grid ride-compensation-fields__cash">
          <label className="ride-field">
            <span>Amount</span>
            <input
              inputMode="decimal"
              pattern="[0-9]+(\.[0-9]+)?"
              placeholder="10.500"
              required
              value={value.amount}
              onChange={(event) => onChange({ ...value, amount: event.target.value })}
            />
          </label>
          <label className="ride-field">
            <span>Currency</span>
            <select
              required
              value={value.currency}
              onChange={(event) =>
                onChange({ ...value, currency: event.target.value as CashCurrency })
              }
            >
              {SUPPORTED_CASH_CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </label>
          {mode === "offer" ? (
            <label className="ride-field">
              <span>Charge</span>
              <select
                required
                value={value.basis}
                onChange={(event) =>
                  onChange({ ...value, basis: event.target.value as RideCompensationBasis })
                }
              >
                <option value="PER_SEAT">Per seat</option>
                <option value="TOTAL">Total ride</option>
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
