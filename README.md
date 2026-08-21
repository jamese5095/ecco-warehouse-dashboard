# 🏭 消费品仓库 · 全流程运营可视化看板

> 上海青浦站消费品仓库（鞋类 / 服装 / 配件）全流程运营可视化看板。
> 本仓库用于 **GitHub Pages** 在线托管，浏览器直接访问即可查看。

🔗 **在线访问**（部署后生效）：`https://<你的GitHub用户名>.github.io/<仓库名>/`

## 🎯 看板内容

覆盖仓库六大运营域：
1. **📥 收货域** — 邀约 → 车辆检查 → 签收 → 抽检 → RF收货 → 不合格品处理
2. **📦 上架域** — 整托/整箱/零散补库上架、码放标准
3. **🔍 盘点域** — 快速盘点、差异处理
4. **🚚 发货拣选域** — 波次 → 拣货 → 复核 → 打包 → 发运
5. **↩️ 退货质检域** — 逆向物流、质检分级、报废处理
6. **💻 EDP系统支撑域** — 波次/数据/单据管控

每张流程图配**岗位考核分值表**（数据来自仓库 MT 评价表）。

## 📁 文件结构

```
├── index.html              # ⭐ 看板主入口（GitHub Pages 首页）
├── receiving-insight.html  # 收货现场洞察报告
├── count-insight.html      # 盘点现场洞察报告
├── site.css                # 全站统一视觉与响应式样式
├── site.js                 # 导航状态等轻量交互
├── preview.html            # 自动跳转至新版主入口
└── README.md               # 本说明
```

## 🚀 部署到 GitHub Pages

### 方式一：网页上传（无需安装软件，推荐）
1. 在 GitHub 新建一个仓库（Public）
2. 仓库主页 → **Add file** → **Upload files**
3. 把 `index.html` 拖入上传，Commit
4. **Settings** → 左侧 **Pages** → Build and deployment 选 **Deploy from a branch** → 分支选 `main` / root → **Save**
5. 等待 1-2 分钟，访问 `https://<用户名>.github.io/<仓库名>/`

### 方式二：本地 Git 推送
```bash
git init
git add index.html
git commit -m "init: 仓库全流程看板"
git branch -M main
git remote add origin https://github.com/<用户>/<仓库>.git
git push -u origin main
```
然后在仓库 Settings → Pages 选择 main 分支开启即可。

## 💡 说明
- 看板通过 CDN 加载 Mermaid 库，访问时需联网。
- 业务细节请以现场实际 SOP 为准。
