"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { getApiUrl } from "@/lib/api-config";

// 注意：客户端组件默认就是动态渲染，适合注册页的需求
// （CSRF、会话、A/B测试、风控等）
export default function RegisterPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // 验证密码
    if (formData.password !== formData.confirmPassword) {
      setError(t("register.passwordMismatch"));
      return;
    }

    if (formData.password.length < 6) {
      setError(t("register.passwordTooShort"));
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(getApiUrl("/api/auth/register"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.detail || t("register.registerFailed");
        
        // 处理特定的错误消息
        if (errorData.detail?.includes("用户名")) {
          setError(t("register.usernameExists"));
        } else if (errorData.detail?.includes("邮箱")) {
          setError(t("register.emailExists"));
        } else {
          setError(errorMessage);
        }
        throw new Error(errorMessage);
      }

      // 注册成功，自动登录
      const result = await response.json();
      
      // 后端返回的数据在 result.data 中
      if (result.data && result.data.access_token) {
        localStorage.setItem("access_token", result.data.access_token);
        localStorage.setItem("token_expires_in", String(result.data.expires_in || 3600));
        router.push(`/${locale}/home`);
      } else {
        // 如果没有 token，跳转到登录页
        router.push(`/${locale}/login?registered=true`);
      }
    } catch (err) {
      // 错误已在上面的 if 中设置
      if (!error) {
        const errorMessage = err instanceof Error ? err.message : t("register.registerFailed");
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="w-full max-w-md px-6 py-8 bg-white dark:bg-zinc-900 rounded-lg shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
            {t("register.title")}
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">{t("register.subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {t("register.username")}
            </label>
            <input
              id="username"
              name="username"
              type="text"
              value={formData.username}
              onChange={handleChange}
              required
              minLength={3}
              maxLength={50}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-white dark:bg-zinc-800 text-black dark:text-white"
              placeholder={t("register.usernamePlaceholder")}
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {t("register.email")}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-white dark:bg-zinc-800 text-black dark:text-white"
              placeholder={t("register.emailPlaceholder")}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {t("register.password")}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-white dark:bg-zinc-800 text-black dark:text-white"
              placeholder={t("register.passwordPlaceholder")}
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {t("register.confirmPassword")}
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              minLength={6}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-white dark:bg-zinc-800 text-black dark:text-white"
              placeholder={t("register.confirmPasswordPlaceholder")}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-black dark:bg-white text-white dark:text-black font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t("register.buttonLoading") : t("register.button")}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {t("register.hasAccount")}{" "}
            <button
              onClick={() => router.push(`/${locale}/login`)}
              className="text-black dark:text-white font-medium hover:underline"
            >
              {t("register.loginLink")}
            </button>
          </p>
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={() => router.push(`/${locale}`)}
            className="text-sm text-zinc-500 dark:text-zinc-400 hover:underline"
          >
            {t("common.back")}
          </button>
        </div>
      </main>
    </div>
  );
}
