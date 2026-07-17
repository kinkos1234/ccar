module.exports = {
  apps: [
    {
      name: 'CAR-Backend',
      script: 'src/server.js',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 41100,
        HOST: '0.0.0.0'
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
      max_memory_restart: '2G',
      node_args: '--max-old-space-size=2048',
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      ignore_watch: [
        'node_modules',
        'logs',
        'uploads',
        '.git'
      ]
    },
    {
      name: 'CAR-Frontend',
      script: 'npm',
      args: 'start',
      cwd: './frontend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 41000,
        HOST: '0.0.0.0'
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_file: './logs/frontend-combined.log',
      time: true,
      max_memory_restart: '1G',
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      ignore_watch: [
        'node_modules',
        '.next',
        'logs',
        '.git'
      ]
    }
  ]
}; 