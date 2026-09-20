type TelegramApiResponse = {
  readonly ok: boolean;
  readonly description?: string;
};

export async function setTelegramChatMenuButton(
  botToken: string,
  webAppUrl: string,
): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      menu_button: {
        type: "web_app",
        text: "Open HOOMA",
        web_app: { url: webAppUrl },
      },
    }),
  });

  const payload = (await response.json()) as TelegramApiResponse;
  if (!response.ok || !payload.ok) {
    throw new Error(payload.description || `Telegram Bot API returned HTTP ${response.status}`);
  }
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
): Promise<void> {
  if (!botToken) throw new Error("Telegram Bot API is not configured");
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      protect_content: true,
    }),
  });

  const payload = (await response.json()) as TelegramApiResponse;
  if (!response.ok || !payload.ok) {
    throw new Error(payload.description || `Telegram Bot API returned HTTP ${response.status}`);
  }
}
