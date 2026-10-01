import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Spin & Speak",
    short_name: "Spin & Speak",
    description: "A playful one-minute impromptu speaking coach.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f6ff",
    theme_color: "#5b49e8",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" }
    ]
  };
}
