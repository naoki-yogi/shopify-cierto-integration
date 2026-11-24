# Shopify ⇔ CIERTO 双方向データ連携基盤

ShopifyとCIERTO（DAM/PIMシステム）間の双方向データ連携を実現するモジュールとAPI設計案です。

## 使用技術

- **言語**: JavaScript (ES Modules)
- **実行環境**: Node.js 18+
- **外部ライブラリ**: なし（標準ライブラリのみ）

---

## ① コーディング課題

### 実行方法

```bash
node src/index.js
```

### ディレクトリ構成

```
src/
├── validators.js   # 入力データのバリデーション
├── filters.js      # 商品のフィルタリング
├── transformers.js # Shopify ⇔ CIERTO データ変換
├── sorters.js      # グルーピング・ソート
├── pipeline.js     # パイプライン制御
└── index.js        # エントリポイント
data/
└── sample-products.json  # サンプルデータ
```

### 処理フロー

```
┌──────────────────────────────────────────────────────────────────┐
│                     Shopify商品データ (JSON[])                    │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  1. Validate                                                      │
│     - 必須項目チェック (productId, name, sku, price)              │
│     - フォーマット検証 (price: 数値, status: enum, updatedAt: ISO)│
│     - 不正レコード → エラーログに記録してスキップ                  │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  2. Filter                                                        │
│     - デフォルト: status === 'ACTIVE' のみ抽出                    │
│     - 任意のフィルタ関数を追加可能                                 │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  3. Transform                                                     │
│     - ShopifyProduct → CIERTOAsset 形式に変換                     │
│     - assetId, syncStatus, metadata などを付与                    │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  4. Group & Sort                                                  │
│     - category ごとにグルーピング                                 │
│     - 各グループ内を price 降順（または updatedAt）でソート        │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  出力: { data: Map<category, CIERTOAsset[]>, errors, stats }     │
└──────────────────────────────────────────────────────────────────┘
```

### 拡張方法

各モジュールは独立しており、ルールの追加が容易です。

**バリデーションルールの追加:**

```javascript
import { validators } from './src/validators.js';

// カテゴリ必須ルールを追加
validators.category = (product) => {
  if (!product.category) {
    return { valid: false, error: 'category is required' };
  }
  return { valid: true };
};
```

**フィルタの追加:**

```javascript
import { filters } from './src/filters.js';

// 価格帯フィルタ（すでに定義済み）
const expensiveOnly = filters.priceRange(10000, Infinity);
```

**パイプラインのカスタマイズ:**

```javascript
import { process } from './src/pipeline.js';
import { filters } from './src/filters.js';
import { comparators } from './src/sorters.js';

const result = process(products, {
  filters: [filters.isActive, filters.hasImages],
  sortBy: comparators.byUpdatedAtDesc,
  groupBy: 'status',
});
```

---

## ② 設計記述課題（Web API 設計案）

### システムアーキテクチャ

```
┌─────────────┐              ┌─────────────────────────┐              ┌─────────────┐
│             │   Webhook    │                         │   REST API   │             │
│   Shopify   │─────────────▶│    Integration API      │─────────────▶│   CIERTO    │
│             │              │       Server            │              │    (DAM)    │
│             │◀─────────────│                         │◀─────────────│             │
│             │  Admin API   │  ┌─────────────────┐    │              │             │
└─────────────┘              │  │   Job Queue     │    │              └─────────────┘
                             │  │   (Redis/SQS)   │    │
                             │  └─────────────────┘    │
                             │                         │
                             │  ┌─────────────────┐    │
                             │  │   Sync State    │    │
                             │  │   (PostgreSQL)  │    │
                             │  └─────────────────┘    │
                             └─────────────────────────┘
```

### API エンドポイント

#### Webhook 受信（Shopify → システム）

| Method | Endpoint | 説明 |
|--------|----------|------|
| POST | `/webhooks/shopify/products/create` | 商品作成Webhookの受信 |
| POST | `/webhooks/shopify/products/update` | 商品更新Webhookの受信 |
| POST | `/webhooks/shopify/products/delete` | 商品削除Webhookの受信 |

#### 同期操作

| Method | Endpoint | 説明 |
|--------|----------|------|
| POST | `/api/v1/sync/shopify-to-cierto` | Shopify → CIERTO 一括同期 |
| POST | `/api/v1/sync/cierto-to-shopify` | CIERTO → Shopify 一括同期 |
| GET | `/api/v1/sync/jobs/:jobId` | ジョブ状態の取得 |
| GET | `/api/v1/sync/jobs/:jobId/logs` | ジョブログの取得 |

#### 商品・アセット管理

| Method | Endpoint | 説明 |
|--------|----------|------|
| GET | `/api/v1/products` | 同期済み商品一覧 |
| GET | `/api/v1/products/:id` | 商品詳細（同期状態含む） |
| POST | `/api/v1/products/:id/sync` | 単一商品の即時同期 |

---

### エンドポイント詳細

#### POST `/webhooks/shopify/products/update`

Shopifyからの商品更新Webhookを受信し、非同期でCIERTOに反映します。

**リクエスト（Shopifyから送信）:**

```json
{
  "id": 1234567890,
  "title": "オーガニックコットンTシャツ",
  "status": "active",
  "variants": [
    {
      "id": 11111,
      "sku": "APP-TS-001",
      "price": "3980.00"
    }
  ],
  "images": [
    { "src": "https://cdn.shopify.com/..." }
  ],
  "updated_at": "2024-11-15T10:30:00+09:00"
}
```

**レスポンス:**

```json
{
  "accepted": true,
  "jobId": "sync_abc123",
  "message": "Queued for processing"
}
```

**処理フロー:**

1. HMAC署名を検証（`X-Shopify-Hmac-SHA256`ヘッダー）
2. 即座に `200 OK` を返却（Shopifyのタイムアウト対策）
3. 非同期ジョブをキューに投入
4. ワーカーがCIERTOへ反映

---

#### POST `/api/v1/sync/cierto-to-shopify`

CIERTOで更新されたアセットをShopifyに反映します。

**リクエスト:**

```json
{
  "assetIds": ["cierto_1001", "cierto_1002"],
  "updateFields": ["images", "price", "title"]
}
```

**レスポンス:**

```json
{
  "jobId": "sync_xyz789",
  "queued": 2,
  "estimatedTime": "30s"
}
```

---

#### GET `/api/v1/sync/jobs/:jobId`

**レスポンス:**

```json
{
  "jobId": "sync_abc123",
  "status": "completed",
  "progress": {
    "total": 10,
    "processed": 10,
    "succeeded": 9,
    "failed": 1
  },
  "startedAt": "2024-11-15T10:30:00Z",
  "completedAt": "2024-11-15T10:30:45Z",
  "errors": [
    {
      "productId": "1007",
      "error": "CIERTO asset not found",
      "retryable": false
    }
  ]
}
```

---

### Shopify API レート制限対策

#### GraphQL API (Query Cost)

Shopify GraphQL APIは「コスト」ベースのレート制限を採用しています。

| 項目 | 値 |
|------|-----|
| バケット上限 | 1,000 ポイント |
| 回復速度 | 50 ポイント/秒 |

**対策:**

```javascript
async function executeWithCostTracking(query) {
  const response = await shopifyGraphQL(query);
  
  const { requestedQueryCost, actualQueryCost, throttleStatus } = 
    response.extensions.cost;
  
  // 残りコストが閾値以下なら待機
  if (throttleStatus.currentlyAvailable < 200) {
    const waitTime = (200 - throttleStatus.currentlyAvailable) / 50;
    await sleep(waitTime * 1000);
  }
  
  return response;
}
```

#### REST API (Leaky Bucket)

`429 Too Many Requests` に対して指数バックオフでリトライします。

```javascript
async function fetchWithRetry(url, options, maxRetries = 5) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      // Retry-After ヘッダーを優先
      const retryAfter = response.headers.get('Retry-After');
      const delay = retryAfter 
        ? parseInt(retryAfter, 10) * 1000
        : Math.min(1000 * Math.pow(2, attempt), 32000);
      
      console.log(`Rate limited. Retrying in ${delay}ms...`);
      await sleep(delay);
      continue;
    }
    
    return response;
  }
  
  throw new Error('Max retries exceeded');
}
```

---

### エッジケース対応

| ケース | 対応方針 |
|--------|----------|
| **CIERTOに画像が未登録** | `syncStatus: PENDING_MEDIA` として同期を保留。画像登録後に再同期をトリガー |
| **Shopifyで商品が非公開化** | CIERTO側の `syncStatus: UNPUBLISHED` に更新。アセットは論理削除（物理削除しない） |
| **同時更新による競合** | `updatedAt` タイムスタンプを比較し、新しい方を正とする。同一の場合はShopifyを優先 |
| **Shopify API一時障害** | 失敗したジョブをDead Letter Queueに移動。5分後に自動リトライ（最大3回） |
| **SKU/ProductID変更** | 旧IDのアセットを `ORPHANED` としてマーク。新IDで新規アセットを作成 |
| **部分的な同期失敗** | 成功した商品はコミット、失敗した商品のみエラーログに記録して継続 |

---

### 同期ステータス定義

| Status | 説明 |
|--------|------|
| `SYNCED` | 最新の状態で同期済み |
| `PENDING` | 同期ジョブがキュー投入済み |
| `PENDING_MEDIA` | 画像アップロード待ち |
| `UNPUBLISHED` | Shopify側で非公開化された |
| `ORPHANED` | Shopify側でID変更により対応が取れない状態 |
| `ERROR` | 同期エラー（詳細は `errorLog` を参照） |
| `CONFLICT` | 双方で同時更新が発生、手動解決が必要 |

---

### データモデル

#### SyncRecord（同期状態管理）

```typescript
interface SyncRecord {
  id: string;
  shopifyProductId: string;
  ciertoAssetId: string;
  syncStatus: SyncStatus;
  lastSyncedAt: Date;
  shopifyUpdatedAt: Date;
  ciertoUpdatedAt: Date;
  errorLog?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 参考資料

- [Shopify Admin GraphQL API Reference](https://shopify.dev/docs/api/admin-graphql)
- [Shopify API Rate Limits](https://shopify.dev/docs/api/usage/rate-limits)
- [Shopify Webhooks](https://shopify.dev/docs/apps/webhooks)
