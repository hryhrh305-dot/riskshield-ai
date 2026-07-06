import type { MetadataRoute } from "next";

const SITE_URL = "https://www.secwyn.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const routes = [
    {
      path: "",
      changeFrequency: "weekly" as const,
      priority: 1,
    },
    {
      path: "/pricing",
      changeFrequency: "weekly" as const,
      priority: 0.9,
    },
    {
      path: "/pre-send",
      changeFrequency: "weekly" as const,
      priority: 0.9,
    },
    {
      path: "/bulk-check",
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
    {
      path: "/risk-check",
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
    {
      path: "/docs",
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      path: "/docs/google-sheets",
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      path: "/privacy",
      changeFrequency: "yearly" as const,
      priority: 0.3,
    },
    {
      path: "/terms",
      changeFrequency: "yearly" as const,
      priority: 0.3,
    },
  ];

  return routes.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
