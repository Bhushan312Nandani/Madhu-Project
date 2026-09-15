// infrastructure/pm2.ecosystem.config.js
// PM2 Process Manager — zero-downtime restarts, log management

export default {
  apps: [
    {
      name: "madhushud-backend",
      script: "./backend/server.js",
      cwd: "/var/www/madhushud",
      instances: 1,          // t2.micro: 1 core, 1 instance optimal
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "400M",  // restart if memory exceeds 400MB

      // Environment — production values come from .env file
      env_production: {
        NODE_ENV: "production",
        PORT: 5000,
      },

      // Logging
      out_file: "/var/log/madhushud/out.log",
      error_file: "/var/log/madhushud/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,

      // Auto-restart settings
      autorestart: true,
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: "10s",

      // Graceful shutdown
      kill_timeout: 10000,
      listen_timeout: 8000,
      shutdown_with_message: true,
    },
  ],
};
