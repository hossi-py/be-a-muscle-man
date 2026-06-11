import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { QueryProvider } from "@/components/query-provider";
import { RegisterServiceWorker } from "@/components/register-sw";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "Workout Tracker",
  title: "Workout Tracker",
  description: "개인용 운동 기록과 단백질 섭취량 관리",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Workout",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

const devServiceWorkerResetScript = `
(() => {
  if (!("serviceWorker" in navigator)) return;

  const resetKey = "workout-tracker-sw-reset-v1";

  if (!navigator.serviceWorker.controller || sessionStorage.getItem(resetKey)) {
    return;
  }

  sessionStorage.setItem(resetKey, "1");

  Promise.all([
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      ),
    "caches" in window
      ? caches
          .keys()
          .then((keys) =>
            Promise.all(
              keys
                .filter((key) => key.startsWith("workout-tracker-"))
                .map((key) => caches.delete(key)),
            ),
          )
      : Promise.resolve(),
  ]).finally(() => window.location.reload());
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {process.env.NODE_ENV !== "production" ? (
          <script
            dangerouslySetInnerHTML={{ __html: devServiceWorkerResetScript }}
          />
        ) : null}
        <QueryProvider>
          {children}
          <RegisterServiceWorker />
        </QueryProvider>
      </body>
    </html>
  );
}
