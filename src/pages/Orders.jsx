// src/pages/Orders.jsx
import { useEffect, useMemo, useState } from "react";
import { useUser, SignInButton } from "@clerk/clerk-react";
import * as api from "../services/api"; // 依你 api.js 的路徑調整（你看起來是 utils/api.js）

function formatMoney(n) {
  const num = Number(n ?? 0);
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDateTime(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function Orders() {
  const { user, isLoaded } = useUser();
  const userId = user?.id;

  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const sortedOrders = useMemo(() => {
    const arr = Array.isArray(orders) ? [...orders] : [];
    // 新到舊排序：createdAt / created_at / createdTime 都容錯
    arr.sort((a, b) => {
      const ta = new Date(a?.createdAt ?? a?.created_at ?? a?.createdTime ?? 0).getTime();
      const tb = new Date(b?.createdAt ?? b?.created_at ?? b?.createdTime ?? 0).getTime();
      return tb - ta;
    });
    return arr;
  }, [orders]);

  useEffect(() => {
    let ignore = false;

    async function loadOrders() {
      if (!isLoaded) return;

      // 沒登入：不用打 API
      if (!userId) {
        setOrders([]);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await api.fetchOrders(userId);
        if (ignore) return;

        // 你的 api.fetchOrders 我們寫的是回 array
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.orders)
            ? data.orders
            : [];

        setOrders(list);
      } catch (err) {
        if (ignore) return;
        setError(err?.message || "讀取訂單失敗");
        setOrders([]);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadOrders();
    return () => {
      ignore = true;
    };
  }, [isLoaded, userId]);

  // UI
  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">我的訂單</h1>

      {!isLoaded && <p>載入中…</p>}

      {isLoaded && !userId && (
        <div className="rounded-lg border p-4">
          <p className="mb-3">你還沒登入，先登入才看得到訂單紀錄 😴</p>
          <SignInButton mode="modal">
            <button className="btn btn-primary">登入</button>
          </SignInButton>
        </div>
      )}

      {isLoaded && userId && (
        <>
          {isLoading && <p>讀取訂單中…</p>}

          {!isLoading && error && (
            <div className="rounded-lg border border-error p-4">
              <p className="font-bold mb-2">錯誤</p>
              <p>{error}</p>
            </div>
          )}

          {!isLoading && !error && sortedOrders.length === 0 && (
            <div className="rounded-lg border p-4">
              <p>目前沒有訂單紀錄。你可以先去點個早餐，別讓我這頁空得像期末報告封面 🙃</p>
            </div>
          )}

          {!isLoading && !error && sortedOrders.length > 0 && (
            <div className="space-y-3">
              {sortedOrders.map((o) => {
                const id = o?.id ?? "no-id";
                const createdAt = o?.createdAt ?? o?.created_at ?? o?.createdTime;
                const status = o?.status ?? "UNKNOWN";

                // items 容錯：items / orderItems
                const items = Array.isArray(o?.items)
                  ? o.items
                  : Array.isArray(o?.orderItems)
                    ? o.orderItems
                    : [];

                // total 容錯：totalAmount / total_amount，沒有就用 items 算
                const total =
                  o?.totalAmount ??
                  o?.total_amount ??
                  items.reduce((sum, it) => sum + Number(it?.price || 0) * Number(it?.quantity || 0), 0);

                return (
                  <div key={id} className="rounded-xl border p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-bold">訂單 #{id}</div>
                        <div className="text-sm opacity-70">{formatDateTime(createdAt)}</div>
                      </div>

                      <div className="sm:text-right">
                        <div className="font-bold">{formatMoney(total)}</div>
                        <div className="text-sm opacity-70">狀態：{status}</div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="font-semibold mb-2">明細</div>
                      {items.length === 0 ? (
                        <div className="text-sm opacity-70">（這筆訂單沒有明細）</div>
                      ) : (
                        <div className="space-y-1">
                          {items.map((it, idx) => {
                            const name = it?.name ?? it?.productName ?? it?.title ?? "未命名商品";
                            const qty = Number(it?.quantity || 0);
                            const price = Number(it?.price || 0);
                            return (
                              <div key={it?.id ?? `${id}_${idx}`} className="flex justify-between text-sm">
                                <div className="truncate">
                                  {name} <span className="opacity-70">× {qty}</span>
                                </div>
                                <div className="font-semibold">{formatMoney(price * qty)}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
