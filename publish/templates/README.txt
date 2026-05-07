发布目录说明

1. web\dist
   放到 19 服务器的静态站点目录，例如:
   D:\nginx-1.20.2\web\gptImage\dist

2. async-service
   整个目录放到 19 服务器，例如:
   D:\services\gpt-image-async

3. 首次部署前
   - 打开 async-service\ecosystem.config.cjs
   - 把 ASYNC_JOB_SECRET 改成一个足够长的随机字符串
   - 如有需要，调整 ASYNC_RESPONSES_BASE_URL

4. PM2 操作
   - 停止: stop-pm2.bat
   - 启动: start-pm2.bat
   - 重启: restart-pm2.bat

5. Nginx
   - 19-server-8333.conf: 19 服务器站点示例
   - cloud-server-image.52moyu.net.example.conf: 脱敏后的云服务器示例
   - local-templates\cloud-server-image.52moyu.net.conf: 真实云服务器配置，本地自用，已被 git 忽略

6. 打包脚本
   - 项目根目录的 pack-release.bat 会优先复制 publish\local-templates\cloud-server-image.52moyu.net.conf
   - 如果本地私有模板不存在，则回退到脱敏示例文件

说明
   - 用户 API Key 由前端提交，异步服务会用 ASYNC_JOB_SECRET 加密后写入 SQLite
   - 真实上游请求时，worker 会解密并带上对应用户的 API Key
