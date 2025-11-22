// syugeeeeeeeeeei/raidchain-webui/Raidchain-WebUI-temp-refact/main.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

/**
 * アプリケーションのエントリーポイント
 * index.htmlのroot要素に対してReactアプリケーションをマウントします。
 */

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// --- MSWのセットアップ関数: workerを起動するロジックを追加 ---
async function enableMocking() {
  // NOTE: 開発モードで実行されることを前提とし、モックを有効化します。

  try {
    // 同階層のmocks/browser.tsからworkerをインポート
    const { worker } = await import('./mocks/browser');

    // MSWを起動。未処理のリクエストはそのままバイパスする設定。
    await worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: {
        // index.htmlで読み込まれるサービスワーカーのパスを指定
        url: '/mockServiceWorker.js'
      }
    });
    console.log("MSW worker started successfully.");
  } catch (error) {
    console.error("Failed to start MSW worker:", error);
    // エラーが発生してもアプリケーションは続行できるようにします。
  }
}
// -----------------------------

// MSWの起動を待機してからレンダリングを実行
enableMocking().then(() => {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}).catch(error => {
  // MSWの起動失敗とは別に、致命的なエラーが発生した場合のハンドリング
  console.error("Failed to initialize the application:", error);
});