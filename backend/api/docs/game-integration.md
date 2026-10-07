# 游戏接入主站资产、兑换和付费功能

所有 routes 的业务逻辑已抽到 services；路由保留 URL、参数校验、鉴权依赖和响应类型。付费功能统一使用通用购买接口，不提供旧复盘接口或兼容路由。

## 模块职责

- services/assets.py：统一资产账户、条件扣费、入账和流水；底层函数只 flush，由完整业务服务统一 commit。
- services/game_purchases.py：商品报价、购买去重、限时付费授权；所有游戏共用 GamePurchase。
- services/inventory.py、idempotency.py：道具兑换、库存消耗和请求结果重放。
- services/game_sessions.py、game_activity.py、game_likes.py：游戏登录凭证、游玩统计和点赞。
- services/stripe_checkout.py、stripe_events.py、subscriptions.py、stripe_common.py：充值、回调、订阅和 Stripe 公共功能。
- services/account.py、profile.py、portal_sessions.py、email_verification.py、avatars.py：账号、资料、登录 Cookie、验证码和头像。
- services/learning_progress.py、learning_commerce.py、assessments.py、cognitive_scores.py、rewards.py、cosmetics.py、notifications.py、monkey_chat.py、leaderboard.py：对应独立业务。
- config/：价格、鉴权、游戏商品、目录、奖励规则和上传限制。
- lib/：时区日期、商品目标校验等纯函数。

## 1. 主站登记游戏

在 config/game_auth.py 的 GAME_AUTH_ENTRIES 中增加一项：

```python
GameAuthEntry(
    game_key="mygame",
    api_slug="mygame",
    env_prefix="MYGAME",
    default_aud="mygame",
    has_session=True,
    track_daily_play=False,
),
```

game_key 是业务标识，api_slug 用在 URL 中，两者可以不同。SDK 构造器第三个参数用于传入不同的 game_key。登记鉴权后，游戏自动加入支持的目录。只做跳转统计、不使用 JWT 的游戏可登记在 config/game_catalog.py。

主站和该游戏后端配置同一套该游戏专用 JWT 参数：

```dotenv
MYGAME_JWT_SECRET=<为该游戏生成的随机密钥>
MYGAME_JWT_ALG=HS256
MYGAME_JWT_AUD=mygame
MYGAME_JWT_ISS=main-portal
MYGAME_TOKEN_EXPIRE_SECONDS=300
```

密钥只放主站和游戏后端环境变量，每款游戏使用自己的密钥。缺失或仍为占位值时，主站返回 503，不扣费、不记录启动。

浏览器请求使用主站 HttpOnly Cookie，必须设置 credentials: "include"。主站资源接口接受主站 Cookie，不能用游戏 JWT 替代。当前 CORS 默认允许 deepbraintechnology.com 子域；其他域名需登记主站 CORS，并处理跨站 Cookie 登录。仅修改前端不能保证浏览器允许跨站 Cookie。

如需主站显示游戏入口，按 frontend/main_page/config/game-launch.ts 现有结构增加启动项和界面多语言文案。

## 2. 游戏前端复制共享客户端

将 integrations/portal-client.ts 复制到游戏项目的 services/ 或 api/ 目录。它不依赖 React。

```typescript
import { PortalGameClient, newPurchaseRequest, newItemRequest } from "./portal-client";

const portal = new PortalGameClient(PORTAL_API_BASE_URL, "mygame");
const session = await portal.startSession(Intl.DateTimeFormat().resolvedOptions().timeZone);
const assets = await portal.assets();
const refreshed = await portal.refreshSession();
```

如果从主站启动时已收到 game_token，直接使用它；不要每次页面加载再调用 startSession，否则会多记一次启动。token 快到期时调用 refreshSession，该调用不增加统计。

启动 URL 中的 coins/diamonds/flowers 只用于初始展示。余额和扣费始终以服务端为准。

## 3. 道具兑换和消耗

在 config/shop_items.py 的 SHOP_ITEMS 中登记商品：

```python
"mygame_hint": {
    "name": "My Game Hint",
    "games": ["mygame"],
    "cost": {"coins": 5, "diamonds": 0, "flowers": 0},
},
```

游戏 UI 文案仍走自己的 i18n，价格从主站 catalog 读取。

```typescript
const catalog = await portal.catalog();
const redemption = newItemRequest("mygame_hint");
// Keep this object unchanged when retrying a lost response.
const bought = await portal.redeemItem(redemption);

const consumption = newItemRequest("mygame_hint");
const used = await portal.consumeItem(consumption, 1);
// Apply the action only after success, and deduplicate it using request_id.
```

对应接口：

- GET /api/user/assets：余额。
- GET /api/games/shop/catalog?game_mode=mygame：公开商品目录。
- GET /api/user/shop/inventory：库存。
- POST /api/user/shop/redeem?item_id=mygame_hint&game_mode=mygame&request_id=<UUID>：扣费并入库。
- POST /api/user/shop/consume?item_id=mygame_hint&game_mode=mygame&count=1&request_id=<UUID>：消耗库存。

客户端应始终传入 request_id。每次新操作生成一个 UUID；超时、断网或响应丢失时复用同一 UUID 和参数。复用 UUID 却更换商品、数量、模式或操作类型会返回 409。

重试返回首次成功操作保存的结果，其中余额／库存是当时快照；需要最新状态时调用 assets()/inventory()。主站去重不能替代游戏自己的动作去重，游戏需避免同一消费响应重复应用动作。

库存响应不是可验证的付费 JWT。需要游戏后端验证付款才能执行 AI 或服务器计算时，使用下面的授权购买流程。

## 4. 后端验证的付费功能

在 lib/commerce_targets.py 中添加目标校验函数：

```python
from uuid import UUID


def mygame_target(value: str) -> str:
    return str(UUID(value))
```

在 config/game_commerce.py 的 GAME_PRODUCTS 中增加商品，并导入该校验函数：

```python
("mygame", "ai-analysis"): GameProduct(
    game_key="mygame",
    product_id="ai-analysis",
    cost={"diamonds": 5},
    duration_seconds=24 * 60 * 60,
    purpose="ai-analysis",
    validate_target=mygame_target,
),
```

cost 可组合金币、钻石和鲜花。价格、用途、有效期由主站配置，浏览器不能指定。所有游戏使用相同的购买模型和授权协议。

游戏先确认房间／对局存在且当前用户有权限，再购买。主站校验目标格式，游戏后端负责目标归属。

```typescript
const quote = await portal.quote("ai-analysis");
// Display quote.cost before the user's purchase action.
const purchase = newPurchaseRequest(roomId);
// Persist this request before sending if reload recovery is needed.
const grant = await portal.redeemGrant("ai-analysis", purchase);

await fetch(GAME_API_BASE_URL + "/analysis", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json", "X-Grant-Token": grant.grant_token },
  body: JSON.stringify({ room_id: roomId }),
});
```

接口：GET /api/games/mygame/purchases/ai-analysis/quote 和 POST /api/games/mygame/purchases/ai-analysis/redeem。购买 JSON：

```json
{"request_id":"<UUID>","target":"<room UUID>"}
```

成功响应 data 包含 grant_token、purchase_id、expires_at（UTC Unix 秒）、user_id、game_key、product_id、cost、assets。重试不重复扣费、不延长有效期；费用取购买时保存的实际价格。

这是同一目标在配置有效期内的授权。如果产品只允许执行一次，游戏后端须把 purchase_id 写入自己的唯一执行记录，或作为计算任务去重键；仅校验 JWT 不会限制执行次数。

## 5. 游戏后端校验授权

Python 游戏后端可复制 integrations/portal_grants.py，依赖 python-jose。其他语言应执行相同校验。

```python
from fastapi import HTTPException
from jose import JWTError
from portal_grants import verify_paid_grant

try:
    claims = verify_paid_grant(
        request.headers["X-Grant-Token"],
        secret=settings.MYGAME_JWT_SECRET,
        audience="mygame",
        game_key="mygame",
        product_id="ai-analysis",
        purpose="ai-analysis",
        user_id=current_game_user.id,
        target=str(room.id),
    )
except (JWTError, ValueError) as exc:
    raise HTTPException(status_code=403, detail="invalid_paid_grant") from exc
```

current_game_user 由游戏已有登录凭证解析，其 ID 与主站 user_id 对齐；room 从游戏数据库解析并检查访问权限。不要直接信任浏览器提交的 user_id、purpose、product_id 和未校验的 room_id。校验失败时拒绝执行付费功能。

普通 game_token 用于登录，grant_token 用于指定付费商品。示例验证器校验签名、固定算法、issuer、audience、有效期、用户、游戏、商品、用途、目标和 purchase_id。

## 6. 共用充值入口

游戏不需要各自实现 Stripe：

```typescript
const checkout = await portal.checkout("diamonds", "diamonds10", locale);
window.location.assign(checkout.url);
```

金币包：coins100、coins250、coins800、coins1500、coins2500。钻石包：diamonds10、diamonds25、diamonds70、diamonds200、diamonds300。价格 ID 沿用 config/stripe_billing.py 对应环境变量。

充值返回地址仍是主站商店。入账以主站验证的 Stripe 回调为准，页面跳转成功不是充值成功凭证。异步支付在 checkout.session.async_payment_succeeded 后入账，重复回调不重复充值。

## 7. QuantumGo 已同步接入

QuantumGo 前端已改为 GET /api/games/quantumgo/purchases/ai-review/quote 和 POST /api/games/quantumgo/purchases/ai-review/redeem，读取 grant_token 和 cost.diamonds。游戏请求通过 X-Grant-Token 提交授权；Rust 后端校验 game_key=quantumgo、product_id=ai-review、purpose=ai-review、purchase_id、用户、棋谱、有效期和签名。target 是 room:<UUID> 或 local:<64位小写 SHA256>。

QuantumGo 只注册 /ai/review/*，登录只使用 /api/v1/users/verify-token。双方后端统一使用 QUANTUMGO_JWT_SECRET、QUANTUMGO_JWT_AUD、QUANTUMGO_JWT_ISS；算法为 HS256。旧复盘兑换地址、旧请求头、旧复盘别名和 /jwtLogin 已移除，不能回退。

## 8. 错误处理

- 401：未登录／Cookie 不可用，引导用户登录主站。
- 400 insufficient_assets：刷新余额，展示资产不足。
- 400 insufficient_inventory：库存不足，不应用游戏动作。
- 409 purchase_request_mismatch：UUID 对应请求不一致，检查客户端请求保存逻辑。
- 409 purchase_session_expired：购买已过期，新的用户购买操作才生成新 UUID。
- 422：参数或目标错误。
- 503 game_signing_not_configured：主站配置缺失，该请求不扣费。
- 网络错误或 5xx：保留请求 ID，重试原请求，不自动生成新 UUID。

SDK 将服务端错误包装为 PortalApiError(status, code)，游戏 UI 将 code 映射到多语言文案。

## 部署和验证

先停止旧版本兑换写入，再执行 migrations/20261007_shared_commerce.sql：创建 asset_transactions、commerce_operations、game_purchases，并将已有 QuantumGo 购买记录导入 game_purchases，保留请求 UUID、价格、目标和到期时间。迁移不会再扣费；遇到冲突记录会中止。旧表仅留作历史归档，运行时代码不再引用它。空数据库也可运行同一迁移。随后同步发布 Main_Page 后端与前端、QuantumGo 后端与前端，避免版本混用。

浏览器缓存中的旧授权不再接受，更新后需使用新协议兑换取得授权。未发送完成的旧版本请求应在切换前结束；当前版本网络重试必须保留 UUID。

本轮没有连接或迁移生产数据库，没有修改环境密钥，没有暂存文件。

在 backend/api 下，安装 requirements-dev.txt 后运行：

```text
python -m unittest discover -s tests -v
```

测试使用隔离 SQLite，覆盖扣费和发货回滚、重放、授权边界、历史价格、QuantumGo 通用购买、充值去重和全部现有 API 契约。SQLite 不验证 PostgreSQL 行锁并发；生产使用统一 users 行锁及 SQL 条件更新。
