import type { NextConfig } from "next";
import withNextIntl from 'next-intl/plugin';

const nextConfig: NextConfig = {
  // 🚀 프로덕션 성능 최적화 설정
  experimental: {
    // 빌드 캐시 최적화
    optimizeCss: true,
    // 메모리 사용량 최적화
    workerThreads: false,
    // CSS 최적화
    optimizePackageImports: ['chart.js', 'react-chartjs-2'],
  },
  
  // 🎯 프로덕션 최적화
  compress: true,
  poweredByHeader: false,
  
  // 🔥 웹팩 최적화
  webpack: (config, { dev, isServer }) => {
    // 프로덕션 빌드 최적화
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
            },
            charts: {
              test: /[\\/]node_modules[\\/](chart\.js|react-chartjs-2)[\\/]/,
              name: 'charts',
              chunks: 'all',
            },
          },
        },
      };
    }
    
    if (dev) {
      // 개발 모드에서 파일 감시 최적화
      config.watchOptions = {
        poll: false,
        ignored: [
          '**/node_modules/**',
          '**/.next/**',
          '**/.git/**',
          '**/coverage/**',
          '**/dist/**',
          '**/build/**',
        ],
      };
    }
    return config;
  },

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:4000/api/:path*"
      }
    ];
  }
};

export default withNextIntl('./src/i18n.ts')(nextConfig);
