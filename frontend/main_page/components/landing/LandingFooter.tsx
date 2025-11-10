"use client";

import { useTranslations } from "next-intl";

/**
 * 着陆页页脚组件
 * 包含导航链接和版权信息
 */
export default function LandingFooter() {
  const t = useTranslations("beforelogin.footer");

  const footerLinks = [
    { key: "about", href: "#" },
    { key: "resources", href: "#" },
    { key: "help", href: "#" },
    { key: "contact", href: "#" },
    { key: "privacy", href: "#" },
    { key: "terms", href: "#" },
  ];

  return (
    <footer className="bg-gray-800 text-white py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap justify-center gap-8 mb-8">
          {footerLinks.map((link) => (
            <a
              key={link.key}
              href={link.href}
              className="hover:text-blue-400 transition-colors"
            >
              {t(link.key)}
            </a>
          ))}
        </div>
        <div className="text-center text-gray-400 text-sm">
          {t("copyright")}
        </div>
      </div>
    </footer>
  );
}

