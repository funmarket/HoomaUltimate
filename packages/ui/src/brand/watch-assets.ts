import { WATCH_TICKET_PART_00 } from "./generated/watch-ticket-part-00.js";
import { WATCH_TICKET_PART_01 } from "./generated/watch-ticket-part-01.js";
import { WATCH_TICKET_PART_02 } from "./generated/watch-ticket-part-02.js";
import { WATCH_TICKET_PART_03 } from "./generated/watch-ticket-part-03.js";
import { WATCH_TICKET_PART_04 } from "./generated/watch-ticket-part-04.js";
import { WATCH_TICKET_PART_05 } from "./generated/watch-ticket-part-05.js";
import { WATCH_TICKET_PART_06 } from "./generated/watch-ticket-part-06.js";

export const WATCH_COLLECTOR_TICKET_MASTER = {
  src:
    "data:image/webp;base64," +
    WATCH_TICKET_PART_00 +
    WATCH_TICKET_PART_01 +
    WATCH_TICKET_PART_02 +
    WATCH_TICKET_PART_03 +
    WATCH_TICKET_PART_04 +
    WATCH_TICKET_PART_05 +
    WATCH_TICKET_PART_06,
  width: 640,
  height: 360,
} as const;
