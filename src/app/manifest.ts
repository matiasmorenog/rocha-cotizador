import type { MetadataRoute } from "next";

/**
 * Web app manifest for installable PWA (Android Chrome + modern iOS Safari).
 * Brand colors match light theme in globals.css.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rocha Cotizador",
    short_name: "Rocha",
    description: "Cotizador mayorista de productos",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f3f6f5",
    theme_color: "#046c5d",
    lang: "es",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192-maskable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
