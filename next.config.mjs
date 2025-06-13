const nextConfig = {
  async rewrites() {
    return {
      fallback: [
        {
          source: '/((?!_next|api|favicon.ico).*)',
          destination: '/',
        },
      ],
    };
  },
};

export default nextConfig;
