import type { Metadata } from "next";
import { AuthGate } from "@/components/auth/AuthGate";
import { WorkspaceProvider } from "@/components/workspace/WorkspaceProvider";
import "vazirmatn/Vazirmatn-font-face.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "سامانه حسابداری",
  description: "پلتفرم حسابداری و ERP صنعتی — فارسی، تاریخ شمسی",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <AuthGate>
          <WorkspaceProvider>{children}</WorkspaceProvider>
        </AuthGate>
      </body>
    </html>
  );
}
