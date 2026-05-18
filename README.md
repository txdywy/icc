# CardRadar

CardRadar 是一个纯静态信用卡优惠情报网站，面向中文用户整理中国大陆、美国、香港三地公开信用卡办卡奖励、权益、商户优惠、支付满减、积分/里程活动。

- 前端：Astro + TypeScript + Tailwind CSS
- 数据：仓库内 `public/data/**/*.json`
- 抓取：Node.js + TypeScript + Cheerio
- 校验：Zod
- 搜索/筛选：浏览器端静态筛选，核心 helpers 支持 Fuse.js
- 部署：GitHub Actions + GitHub Pages

## 本地开发

```bash
npm install
npm run dev
```

常用命令：

```bash
npm run crawl          # 抓取公开来源并更新 public/data
npm run validate:data  # 校验 JSON 数据结构
npm run typecheck      # TypeScript 类型检查
npm run lint           # ESLint
npm run build          # Astro 静态构建
npm run preview        # 本地预览构建结果
npm test               # 单元测试
```

## 数据目录

```text
public/data/
  cards/cn.json
  cards/us.json
  cards/hk.json
  offers/cn.json
  offers/us.json
  offers/hk.json
  sources.json
  metadata.json
```

每条信用卡和优惠都保留来源字段：

- `sourceUrl` 或 `sourceUrls`
- `lastCheckedAt`
- `sourceReliability`: `official`、`aggregator`、`community`

`metadata.json` 记录最近更新时间、总数据量和每个 source 的成功/失败状态。单个 parser 失败不会让整个抓取任务失败，失败会写入 metadata。

## 自动更新

`.github/workflows/update-data.yml` 每天 UTC 01:00、07:00、13:00、19:00 运行，也支持 `workflow_dispatch` 手动运行。流程：

1. checkout
2. setup Node.js
3. `npm ci`
4. `npm run crawl`
5. `npm run validate:data`
6. 如果 `public/data` 有变化，则自动 commit 并 push

## GitHub Pages 部署

`.github/workflows/deploy.yml` 在 `main` push 或手动触发时运行：

1. checkout
2. setup Node.js
3. `npm ci`
4. `npm run build`
5. 上传 `dist`
6. deploy to GitHub Pages

GitHub 仓库需要在 Settings → Pages 中启用 GitHub Actions 部署源。

## 添加新数据源

1. 在 `src/crawlers/<region>/` 新增 parser 文件。
2. 导出 `SourceConfig` 和 `crawlXxx(): Promise<CrawlResult>`。
3. 只抓公开网页，不抓登录后页面，不绕过访问控制。
4. 用 `fetchHtml` 获取 HTML，用 Cheerio 解析。
5. 对不确定字段保持空缺，不凭空生成金融条款。
6. 在 `src/crawlers/index.ts` 的 `parsers` 数组中注册。
7. 在 `public/data/sources.json` 添加 source 配置。
8. 运行：

```bash
npm run crawl
npm run validate:data
npm run typecheck
npm run build
```

## 评分算法

### CardScore 100 分

- 25% 开卡奖励净值
- 20% 日常返现/积分收益
- 15% 年费回本能力
- 15% 权益质量
- 10% 积分/里程灵活性
- 10% 申请可达性
- 5% 规则透明度/风险扣分

### OfferScore 100 分

- 30% 实际优惠率
- 20% 最高可省金额
- 15% 适用人群广度
- 10% 使用便利度
- 10% 有效期紧迫度
- 10% 名额/确定性
- 5% 来源可靠性

风险扣分覆盖：随机立减、名额极少、需要分期、规则复杂、疑似过期、需登录或定向用户等。

## 首批来源

中国大陆：

- 民生信用卡官网活动公告
- 平安银行信用卡活动页面
- 银联、中信、招商 source 配置与 parser 占位

美国：

- Chase Sapphire Preferred 官方页
- Capital One Venture X 官方页
- Amex、Citi source 配置与 parser 占位

香港：

- Hang Seng year-round card offers
- Citi HK credit card welcome offers
- Mox promotions
- OCBC HK credit card promotions

## 免责声明

本站仅做公开信息整理，不构成金融建议。信用卡申请、奖励、优惠是否可用，以银行和商户官方条款为准。部分优惠可能有名额、地区、用户资格、卡 BIN、报名路径、支付方式限制。不鼓励超出偿还能力消费，不鼓励为了奖励而借贷或分期。分期优惠可能产生手续费或利息，请以官方条款为准。
