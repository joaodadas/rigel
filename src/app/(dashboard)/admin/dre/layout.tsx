import { Fraunces, JetBrains_Mono } from "next/font/google";
import styles from "./theme.module.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
});

export default function DreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${fraunces.variable} ${mono.variable} ${styles.dreShell}`}>
      {children}
    </div>
  );
}
