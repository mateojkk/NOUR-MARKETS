import { Composition } from "remotion";
import { NourDemo } from "./NourDemo";

export const RemotionRoot = () => (
  <Composition
    id="NourDemo"
    component={NourDemo}
    durationInFrames={2520}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={{}}
  />
);
