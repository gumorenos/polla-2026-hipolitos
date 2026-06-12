module.exports = {
  apps: [
    {
      name: "la-polla-2026",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3030",
      cwd: "./",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        PORT: "3030",
        NODE_ENV: "production",
      },
    },
  ],
};
