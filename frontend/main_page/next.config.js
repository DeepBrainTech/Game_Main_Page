const createNextIntlPlugin = require('next-intl/plugin');

// 配置文件路径（相对于 next.config.js）
const withNextIntl = createNextIntlPlugin('./i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  // Cloudflare Pages 使用标准输出；Docker 构建仍使用 standalone。
  ...(process.env.CF_PAGES === '1' ? {} : { output: 'standalone' }),

  webpack: (config) => {
    config.module.rules.push({
      test: /privacy\.html$/,
      type: 'asset/source',
    });
    return config;
  },
};

module.exports = withNextIntl(nextConfig);
