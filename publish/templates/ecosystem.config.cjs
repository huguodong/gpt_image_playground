const path = require('path');

const appRoot = __dirname;

module.exports = {
  apps: [
    {
      name: 'gpt-image-async',
      script: path.join(appRoot, 'server', 'async-responses-service.mjs'),
      cwd: appRoot,
      interpreter: 'node',
      env: {
        HOST: '127.0.0.1',
        PORT: '3002',
        ASYNC_RESPONSES_BASE_URL: 'http://192.168.0.171:8080/v1',
        ASYNC_JOB_SECRET: 'aj2p273djsal2kh2633',
        ASYNC_DB_PATH: path.join(appRoot, 'response-image-jobs.sqlite'),
        ASYNC_WORKER_CONCURRENCY: '1',
        ASYNC_MAX_BODY_MB: '600'
      }
    }
  ]
};
