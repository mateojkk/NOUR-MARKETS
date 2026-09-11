import { Composition } from "remotion";
import { NourDemo } from "./NourDemo";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="NourDemo"
        component={NourDemo}
        durationInFrames={1800} // 60 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
    </>
  );
};
