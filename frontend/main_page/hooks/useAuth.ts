"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getApiUrl } from "@/lib/api-config";

interface UserInfo {
  username: string;
}

/**
 * 认证相关的 Hook
 * 负责 token 验证和用户信息获取
 */
export function useAuth() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // 检查 token 是否存在
    const token = localStorage.getItem("access_token");
    if (!token) {
      // 未登录，重定向到语言选择页面
      router.push(`/`);
      return;
    }

    // 验证 token 是否有效并获取用户信息
    fetch(getApiUrl("/api/auth/verify"), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (res.ok) {
          return res.json();
        }
        throw new Error("Token 无效");
      })
      .then((data) => {
        setUsername(data.data?.username || "");
        setIsAuthenticated(true);
        setLoading(false);
      })
      .catch(() => {
        // Token 无效，清除并重定向到语言选择页面
        localStorage.removeItem("access_token");
        localStorage.removeItem("token_expires_in");
        router.push(`/`);
      });
  }, [locale, router]);

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("token_expires_in");
    router.push(`/`);
  };

  return {
    username,
    loading,
    isAuthenticated,
    logout,
  };
}

