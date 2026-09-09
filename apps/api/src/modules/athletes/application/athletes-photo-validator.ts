import type { AthletesPhotoContentType } from "@hooma/contracts/athletes";

export interface AthletesPhotoValidator {
  validate(body: Uint8Array, contentType: AthletesPhotoContentType): Promise<void>;
}
