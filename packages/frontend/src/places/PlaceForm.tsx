import { useState, type FormEvent } from "react";
import type {
  PlaceSuggestionInput,
  PublicPlaceSummary,
} from "@hooma/contracts/platform-management";

type MenuDraft = { id: string; name: string; price: string };

function menuDrafts(place?: PublicPlaceSummary | null): MenuDraft[] {
  if (place?.menuItems.length) {
    return place.menuItems.map((item) => ({
      id: item.id,
      name: item.name,
      price: String(item.price),
    }));
  }
  return [
    { id: crypto.randomUUID(), name: "", price: "" },
    { id: crypto.randomUUID(), name: "", price: "" },
    { id: crypto.randomUUID(), name: "", price: "" },
  ];
}

export function PlaceForm({
  initialPlace,
  submitLabel,
  pending,
  onSubmit,
}: {
  readonly initialPlace?: PublicPlaceSummary | null;
  readonly submitLabel: string;
  readonly pending: boolean;
  readonly onSubmit: (input: PlaceSuggestionInput) => Promise<void>;
}) {
  const [menu, setMenu] = useState<MenuDraft[]>(() => menuDrafts(initialPlace));
  const [latitude, setLatitude] = useState(initialPlace?.latitude?.toString() ?? "");
  const [longitude, setLongitude] = useState(initialPlace?.longitude?.toString() ?? "");
  const [locationError, setLocationError] = useState("");

  function addMenuItem() {
    setMenu((items) => [...items, { id: crypto.randomUUID(), name: "", price: "" }]);
  }

  function updateMenu(id: string, field: "name" | "price", value: string) {
    setMenu((items) => items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function removeMenuItem(id: string) {
    setMenu((items) => items.filter((item) => item.id !== id));
  }

  function useCurrentLocation() {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError("Current location is not available on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(7));
        setLongitude(position.coords.longitude.toFixed(7));
      },
      () => setLocationError("Unable to read your current location."),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const optionalText = (name: string) => String(data.get(name) ?? "").trim() || null;
    const optionalNumber = (value: string) => (value.trim() ? Number(value) : null);
    const menuItems = menu
      .map((item) => ({ name: item.name.trim(), price: Number(item.price), currency: "TND" }))
      .filter((item) => item.name && Number.isFinite(item.price) && item.price >= 0);

    await onSubmit({
      name: String(data.get("name") ?? "").trim(),
      category: optionalText("category"),
      description: optionalText("description"),
      imageUrl: optionalText("imageUrl"),
      address: String(data.get("address") ?? "").trim(),
      city: optionalText("city"),
      houma: optionalText("houma"),
      latitude: optionalNumber(latitude),
      longitude: optionalNumber(longitude),
      phone: optionalText("phone"),
      email: optionalText("email"),
      websiteUrl: optionalText("websiteUrl"),
      menuItems,
    });
  }

  return (
    <form className="hooma-form place-form" onSubmit={(event) => void submit(event)}>
      <section className="hooma-form__section">
        <div className="hooma-form__section-heading">
          <span>01</span>
          <div>
            <h2>Place identity</h2>
            <p>How the venue will appear across HOOMA.</p>
          </div>
        </div>
        <div className="hooma-form__grid">
          <label className="hooma-field">
            <span>Place name *</span>
            <input name="name" defaultValue={initialPlace?.name ?? ""} required minLength={2} />
          </label>
          <label className="hooma-field">
            <span>Type</span>
            <input
              name="category"
              defaultValue={initialPlace?.category ?? ""}
              placeholder="Sports café & lounge"
            />
          </label>
        </div>
        <label className="hooma-field">
          <span>Photo URL</span>
          <input
            name="imageUrl"
            type="url"
            maxLength={4000}
            defaultValue={initialPlace?.imageUrl ?? ""}
            placeholder="https://…"
          />
          <small>Public image, CDN and signed image URLs are accepted.</small>
        </label>
        <label className="hooma-field">
          <span>About</span>
          <textarea
            name="description"
            rows={5}
            defaultValue={initialPlace?.description ?? ""}
            placeholder="Tell supporters what makes this Place worth visiting."
          />
        </label>
      </section>

      <section className="hooma-form__section">
        <div className="hooma-form__section-heading">
          <span>02</span>
          <div>
            <h2>Location</h2>
            <p>Coordinates are optional. Address is the primary location.</p>
          </div>
        </div>
        <label className="hooma-field">
          <span>Address *</span>
          <input name="address" defaultValue={initialPlace?.address ?? ""} required minLength={3} />
        </label>
        <div className="hooma-form__grid">
          <label className="hooma-field">
            <span>City</span>
            <input name="city" defaultValue={initialPlace?.city ?? ""} />
          </label>
          <label className="hooma-field">
            <span>Houma</span>
            <input name="houma" defaultValue={initialPlace?.houma ?? ""} />
          </label>
        </div>
        <div className="hooma-form__grid">
          <label className="hooma-field">
            <span>
              Latitude <em>optional</em>
            </span>
            <input
              name="latitude"
              type="number"
              min="-90"
              max="90"
              step="any"
              value={latitude}
              onChange={(event) => setLatitude(event.target.value)}
            />
          </label>
          <label className="hooma-field">
            <span>
              Longitude <em>optional</em>
            </span>
            <input
              name="longitude"
              type="number"
              min="-180"
              max="180"
              step="any"
              value={longitude}
              onChange={(event) => setLongitude(event.target.value)}
            />
          </label>
        </div>
        <button className="hooma-form__secondary-action" type="button" onClick={useCurrentLocation}>
          Use current location
        </button>
        {locationError ? <p className="error">{locationError}</p> : null}
      </section>

      <section className="hooma-form__section">
        <div className="hooma-form__section-heading">
          <span>03</span>
          <div>
            <h2>Contact</h2>
            <p>Public business contact information.</p>
          </div>
        </div>
        <div className="hooma-form__grid">
          <label className="hooma-field">
            <span>Phone</span>
            <input name="phone" inputMode="tel" defaultValue={initialPlace?.phone ?? ""} />
          </label>
          <label className="hooma-field">
            <span>Email</span>
            <input name="email" type="email" defaultValue={initialPlace?.email ?? ""} />
          </label>
        </div>
        <label className="hooma-field">
          <span>Website</span>
          <input
            name="websiteUrl"
            type="url"
            maxLength={2000}
            defaultValue={initialPlace?.websiteUrl ?? ""}
            placeholder="https://…"
          />
        </label>
      </section>

      <section className="hooma-form__section">
        <div className="hooma-form__section-heading">
          <span>04</span>
          <div>
            <h2>Menu preview</h2>
            <p>Add the items supporters should see on the expanded Place page.</p>
          </div>
        </div>
        <div className="place-menu-editor">
          {menu.map((item, index) => (
            <div className="place-menu-editor__row" key={item.id}>
              <input
                aria-label={`Menu item ${index + 1}`}
                value={item.name}
                maxLength={120}
                placeholder="Item"
                onChange={(event) => updateMenu(item.id, "name", event.target.value)}
              />
              <div className="place-menu-editor__price">
                <input
                  aria-label={`Menu item ${index + 1} price`}
                  value={item.price}
                  type="number"
                  min="0"
                  step="0.001"
                  placeholder="Price"
                  onChange={(event) => updateMenu(item.id, "price", event.target.value)}
                />
                <span>TND</span>
              </div>
              <button
                type="button"
                className="place-menu-editor__remove"
                aria-label={`Remove menu item ${index + 1}`}
                onClick={() => removeMenuItem(item.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button className="hooma-form__secondary-action" type="button" onClick={addMenuItem}>
          + Add menu item
        </button>
      </section>

      <button className="hooma-form__submit" type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
