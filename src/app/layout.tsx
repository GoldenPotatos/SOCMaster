import type { Metadata } from "next";
import { Fira_Code, Orbitron, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeBackgrounds } from "@/components/ThemeBackgrounds";

const firaCode = Fira_Code({ subsets: ["latin"], variable: "--font-fira-code" });
const orbitron = Orbitron({ subsets: ["latin"], variable: "--font-orbitron", weight: ["400","600","700","800","900"] });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "SOCMASTER | Cybersecurity Training",
  description: "Secure Web Application POC for a cybersecurity training platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${firaCode.variable} ${orbitron.variable} ${jetbrainsMono.variable} h-[100dvh] antialiased bg-transparent overflow-hidden`}>
        <ThemeProvider>
          <ThemeBackgrounds />
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
