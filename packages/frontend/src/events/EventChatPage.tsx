import { useEffect, useState, type FormEvent } from "react";
import { useHoomaFrontend } from "../context";
import type { EventChatRecord } from "./api";
import { useEventApi } from "./useEventApi";
export function EventChatPage({ eventId }: { readonly eventId: string }) {
  const eventApi = useEventApi();
  const { protectedError } = useHoomaFrontend();
  const [messages, setMessages] = useState<EventChatRecord[]>([]);
  const [error, setError] = useState("");
  const reload = () =>
    eventApi
      .chat(eventId)
      .then(setMessages)
      .catch((reason) => setError(protectedError(reason, "Unable to load event chat")));
  useEffect(() => {
    void reload();
  }, [eventApi, eventId]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError("");
    void eventApi
      .postChat(eventId, String(data.get("body")))
      .then(() => {
        form.reset();
        return reload();
      })
      .catch((reason) => setError(protectedError(reason, "Unable to send event message")));
  }
  return (
    <section>
      <p className="eyebrow">TEMPORARY EVENT CHAT</p>
      <h2>Match chat</h2>
      <p className="muted">
        Available only to active participants during the event window. Messages expire with the
        room.
      </p>
      {error ? <p className="error">{error}</p> : null}
      <div className="chat-list">
        {messages.map((message) => (
          <article key={message.id}>
            <strong>{message.user?.presentation?.displayName ?? "Player"}</strong>
            <p>{message.body}</p>
          </article>
        ))}
      </div>
      <form className="chat-compose" onSubmit={submit}>
        <input name="body" maxLength={1200} placeholder="Message the players" required />
        <button type="submit">Send</button>
      </form>
    </section>
  );
}
