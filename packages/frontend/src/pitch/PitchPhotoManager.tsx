import { PlacePhotoManager } from "../places/PlacePhotoManager";

export function PitchPhotoManager(props: Parameters<typeof PlacePhotoManager>[0]) {
  return <PlacePhotoManager {...props} subject="Pitch" />;
}
