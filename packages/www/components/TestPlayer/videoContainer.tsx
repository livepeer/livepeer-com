import { useState } from "react";
import dynamic from "next/dynamic";

const Player = dynamic(import("../../components/Player"), { ssr: false });

type Props = {
  title: string;
  description?: string;
  manifestUrl: string;
};

const VideoContainer = ({ title, description, manifestUrl }: Props) => {
  const videoThumbnail = "https://i.vimeocdn.com/video/499134794_1280x720.jpg";

  return (
    <div>
      <h1 sx={{ fontSize: "20px", fontWeight: "600", marginBottom: "8px" }}>
        {title}
      </h1>
      <p sx={{ fontSize: "16px", color: "offBlack", marginBottom: "32px" }}>
        {description}
      </p>
      {manifestUrl ? (
        <Player
          src={manifestUrl}
          posterUrl={videoThumbnail}
          config={{
            abr: { enabled: false },
            controlPanelElements: [
              "time_and_duration",
              "play_pause",
              "rewind",
              "fast_forward",
              "mute",
              "volume",
              "spacer",
              "fullscreen",
              title === "ABR" && "overflow_menu",
            ],
            overflowMenuButtons: [title === "ABR" && "quality"],
          }}
        />
      ) : (
        <div
          sx={{
            background: "#FBFBFB",
            border: "1px solid #CCCCCC",
            borderRadius: "8px",
            height: "312px",
            width: "100%",
          }}
        />
      )}
    </div>
  );
};

export default VideoContainer;