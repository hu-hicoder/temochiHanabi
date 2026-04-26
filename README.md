# 線香花火ゲーム (Temochi Hanabi Game)

参加者がスマートフォンの加速度センサーを使用して、線香花火を揺らさないようにするマルチプレイヤーウェブゲーム。最後まで線香花火を燃やし続けた人が勝ち！

## プロジェクト構成

```
temochiHanabi/
├── server.py              # Flask + SocketIO メインサーバー
├── game_state.py          # ゲーム状態管理, プレイヤー管理
├── requirements.txt       # Python依存関係
├── templates/
│   ├── host.html          # ホスト用ダッシュボード画面
│   └── play.html          # プレイヤー用ゲーム画面
├── static/
│   ├── styles.css         # グローバルスタイルシート
│   ├── host.js            # ホスト側 JavaScript ロジック
│   ├── player.js          # プレイヤー側 JavaScript ロジック
│   └── sparkler.js        # 線香花火粒子アニメーションエンジン
└── README.md              # このファイル
```

## セットアップ

### 1. Python環境の準備

Python 3.8+ がインストールされていることを確認してください。

```bash
cd temochiHanabi
python -m venv venv
```

#### Windows の場合:
```bash
venv\Scripts\activate
```

#### macOS / Linux の場合:
```bash
source venv/bin/activate
```

### 2. 依存関係のインストール

```bash
pip install -r requirements.txt
```

## 実行方法

### サーバー起動

```bash
python server.py
```

サーバーは `http://localhost:5000` で起動します。

### ホスト画面を開く

ブラウザで以下にアクセス:
```
http://localhost:5000/host
```

### 参加者が参加する

1. ホスト画面に表示されたQRコードをスマートフォンで読み込む
2. または直接以下にアクセス（`<host_ip>`はサーバーのIP):
   ```
   http://<host_ip>:5000/play
   ```

3. iOSの場合: DeviceMotionEvent 権限を許可してください

## ゲームフロー

1. **待機フェーズ**:
   - ホストが QR コードを表示
   - 参加者がQRコードから参加

2. **ゲーム開始**:
   - ホストが「ゲームスタート」ボタンをクリック
   - 参加者の画面に線香花火が表示される

3. **ゲーム進行中**:
   - 参加者がスマートフォンをなるべく揺らさないようにする
   - 加速度センサーデータがサーバーに送信され、スコアが累積される
   - ホスト画面に全員の線香花火が表示される

4. **ゲーム終了**:
   - スコアが閾値（デフォルト: 200）を超えたプレイヤーが脱落
   - 最後の1人が優勝

## 技術スタック

- **バックエンド**: Python Flask + Flask-SocketIO (WebSocket通信)
- **フロントエンド**: Vanilla HTML/CSS/JavaScript (フレームワーク不要)
- **通信**: WebSocket (リアルタイム同期)
- **アニメーション**: Canvas 2D (粒子効果)

## ゲームパラメータの調整

[server.py](server.py) の `GameSession` クラスで以下を調整できます:

```python
elimination_threshold: float = 200.0  # 脱落スコア閾値（高いほど難易度が低い）
```

[player.js](static/player.js) でも確認できます:

```javascript
scoreThreshold = 200;
```

## デバッグ

プレイヤー画面でデバッグ情報を表示したい場合、ブラウザのコンソールで以下を実行:

```javascript
document.getElementById('debugInfo').style.display = 'block';
```

加速度センサーのリアルタイムデータが表示されます。

## トラブルシューティング

### QRコードが表示されない
- サーバーが正常に起動しているか確認
- `/qr` エンドポイントが正常に動作しているか、ブラウザコンソールでエラーを確認

### 参加者が接続できない
- ホストとプレイヤーが同じWiFiネットワークに接続しているか確認
- ファイアウォール設定を確認（ポート 5000 が許可されているか）
- ホスト IP アドレスが正しいか確認（`ipconfig` で確認）

### 加速度センサーが反応しない
- iOS 13+の場合は権限許可ダイアログが表示されるはず
- Android: 設定 > アプリ権限 > センサー アクセスが許可されているか確認
- デバイスが加速度センサーに対応しているか確認

### WebSocket接続エラー
- ブラウザコンソールでエラーメッセージを確認
- `http://localhost:5000/socket.io/` にアクセスして、Socket.IOが正常に動作しているか確認

### `The client is using an unsupported version of the Socket.IO or Engine.IO protocols` と表示される
- クライアントとサーバーのSocket.IOプロトコル版が不一致のときに出ます
- 本プロジェクトは Socket.IO v4 クライアントを使用するように修正済みです（`templates/host.html`, `templates/play.html`）
- 端末側ブラウザで強制再読み込みを実施してください（キャッシュされた古いJSを使っている場合があります）
- スマホで改善しない場合は、ブラウザのサイトデータ削除後に再アクセスしてください
- CDNへアクセスできない閉域ネットワークでは、`/socket.io/socket.io.js` に戻す運用を検討してください

## ローカルネットワークでの実行

複数のデバイスでテストする場合:

1. ホスト PC のIPアドレスを確認:
   ```bash
   # Windows
   ipconfig
   
   # macOS / Linux
   ifconfig
   ```

2. 参加者は以下のURLでアクセス:
   ```
   http://<Host_IP>:5000/play
   ```

## パフォーマンス最適化

- **粒子数**: `SparklerAnimator` の `emitRate` で調整
- **フレームレート**: Canvas アニメーションは `requestAnimationFrame` で自動最適化
- **WebSocket 更新頻度**: `player.js` の `lastSendTime` 間隔で調整（デフォルト: 100ms）

## 今後の拡張案

- [ ] 複数ラウンドサポート
- [ ] プレイヤーレーティング / ランキング機能
- [ ] リプレイ機能
- [ ] カスタマイズ可能なテーマ・アバター
- [ ] モバイルネイティブアプリ化 (React Native等)
- [ ] ローカルストレージでのゲーム履歴保存

## ライセンス

MIT License

## 作成者

TemochiHanabi Project
