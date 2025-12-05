"use client";

import { useRouter, usePathname } from "next/navigation";
import { useParams } from "next/navigation";

export default function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const currentLocale = params.locale as string;

  const switchLanguage = (newLocale: string) => {
    // 替换当前路径中的语言代码
    const newPath = pathname.replace(`/${currentLocale}`, `/${newLocale}`);
    router.push(newPath);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => switchLanguage("zh")}
        className={`px-2 py-1 rounded text-sm font-medium transition-colors ${
          currentLocale === "zh"
            ? "bg-black text-white dark:bg-white dark:text-black"
            : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
        }`}
      >
        中文
      </button>
      <button
        onClick={() => switchLanguage("en")}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
          currentLocale === "en"
            ? "bg-black text-white dark:bg-white dark:text-black"
            : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
        }`}
      >
        English
      </button>
    </div>
  );
}
