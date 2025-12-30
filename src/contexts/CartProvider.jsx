// src/contexts/CartProvider.jsx
import React, { useState, useMemo, useCallback, useEffect, useOptimistic } from 'react';
import { useUser } from '@clerk/clerk-react';
import CartContext from './cartContext';
import * as api from '../services/api'; // 1. 引入我們的 API 服務

// Optimistic reducer：描述 UI 要怎麼「先動起來」
function optimisticReducer(state, action) {
  const items = Array.isArray(state) ? [...state] : [];

  switch (action.type) {
    case 'ADD_OR_INC': {
      const { userId, menuItem } = action.payload;
      const menuItemId = menuItem.id ?? menuItem.menuItemId;

      const idx = items.findIndex(
        (it) => it.userId === userId && it.menuItemId === menuItemId
      );

      if (idx >= 0) {
        items[idx] = {
          ...items[idx],
          quantity: Number(items[idx].quantity || 0) + 1,
        };
        return items;
      }

      return [
        ...items,
        {
          ...menuItem,
          id: `temp_${menuItemId}_${Date.now()}`,
          userId,
          menuItemId,
          quantity: 1,
          __optimistic: true,
        },
      ];
    }

    case 'SET_QTY': {
      const { itemId, quantity } = action.payload;
      const q = Math.max(0, Number(quantity || 0));

      if (q === 0) {
        return items.filter((it) => String(it.id) !== String(itemId));
      }

      return items.map((it) =>
        String(it.id) === String(itemId)
          ? { ...it, quantity: q }
          : it
      );
    }

    case 'REMOVE':
      return items.filter((it) => String(it.id) !== String(action.payload.itemId));

    case 'CLEAR':
      return [];

    default:
      return items;
  }
}

/* ===============================
   CartProvider
================================ */
export function CartProvider({ children }) {
  // 🔑 真實後端狀態
  const [cartItemsServer, setCartItemsServer] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const { user, isLoaded } = useUser();
  const userId = user?.id;

  // 🔥 Optimistic UI 狀態（UI 一律用這個）
  const [cartItems, applyOptimistic] = useOptimistic(
    cartItemsServer,
    optimisticReducer
  );

  /* ===============================
     讀取購物車
  ================================ */
  const refreshCart = useCallback(async () => {
    if (!userId) return;
    const items = await api.fetchCart(userId);
    setCartItemsServer(Array.isArray(items) ? items : []);
  }, [userId]);

  useEffect(() => {
    if (!isLoaded) return;

    if (!userId) {
      setCartItemsServer([]);
      setIsLoading(false);
      return;
    }

    (async () => {
      setIsLoading(true);
      try {
        await refreshCart();
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [userId, isLoaded, refreshCart]);

  /* ===============================
     加入購物車（Optimistic）
  ================================ */
  const addToCart = useCallback(
    async (menuItem) => {
      if (!userId) throw new Error('請先登入');

      setError(null);

      // UI 先更新
      applyOptimistic({
        type: 'ADD_OR_INC',
        payload: { userId, menuItem },
      });

      try {
        const existing = await api.findCartItemByMenuId(menuItem.id, userId);

        if (existing) {
          await api.updateCartItem(existing.id, {
            quantity: existing.quantity + 1,
          });
        } else {
          await api.addCartItem({
            ...menuItem,
            menuItemId: menuItem.id,
            userId,
            quantity: 1,
          });
        }

        await refreshCart();
      } catch (err) {
        setError(err.message);
        await refreshCart(); // rollback
        throw err;
      }
    },
    [userId, applyOptimistic, refreshCart]
  );

  /* ===============================
     更新數量（Optimistic）
  ================================ */
  const updateQuantity = useCallback(
    async (itemId, newQuantity) => {
      const quantity = Math.max(0, Number(newQuantity || 0));
      setError(null);

      applyOptimistic({
        type: 'SET_QTY',
        payload: { itemId, quantity },
      });

      try {
        if (quantity === 0) {
          await api.removeCartItem(itemId);
        } else {
          await api.updateCartItem(itemId, { quantity });
        }
        await refreshCart();
      } catch (err) {
        setError(err.message);
        await refreshCart();
        throw err;
      }
    },
    [applyOptimistic, refreshCart]
  );

  /* ===============================
     移除商品（Optimistic）
  ================================ */
  const removeFromCart = useCallback(
    async (itemId) => {
      setError(null);

      applyOptimistic({
        type: 'REMOVE',
        payload: { itemId },
      });

      try {
        await api.removeCartItem(itemId);
        await refreshCart();
      } catch (err) {
        setError(err.message);
        await refreshCart();
        throw err;
      }
    },
    [applyOptimistic, refreshCart]
  );

  /* ===============================
     清空購物車
  ================================ */
  const clearCart = useCallback(async () => {
    if (!userId) return;

    setError(null);
    applyOptimistic({ type: 'CLEAR' });

    try {
      const items = await api.fetchCart(userId);
      for (const it of items) {
        await api.removeCartItem(it.id);
      }
      await refreshCart();
    } catch (err) {
      setError(err.message);
      await refreshCart();
    }
  }, [userId, applyOptimistic, refreshCart]);

  /* ===============================
     計算衍生資料（用 optimistic）
  ================================ */
  const cartCount = useMemo(
    () => cartItems.reduce((sum, it) => sum + it.quantity, 0),
    [cartItems]
  );

  const totalAmount = useMemo(
    () => cartItems.reduce((sum, it) => sum + it.price * it.quantity, 0),
    [cartItems]
  );

  /* ===============================
     結帳
  ================================ */
  const checkout = useCallback(async () => {
    if (!userId || cartItems.length === 0) {
      throw new Error('購物車是空的或使用者未登入');
    }

    await api.createOrder({
      userId,
      items: cartItems.map((it) => ({
        menuItemId: it.menuItemId,
        name: it.name,
        price: it.price,
        quantity: it.quantity,
      })),
      totalAmount,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    await clearCart();
  }, [userId, cartItems, totalAmount, clearCart]);

  /* ===============================
     Context value
  ================================ */
  const value = useMemo(
    () => ({
      cartItems, // 🔥 UI 用 optimistic
      cartCount,
      totalAmount,
      isLoading,
      error,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      checkout,
    }),
    [
      cartItems,
      cartCount,
      totalAmount,
      isLoading,
      error,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      checkout,
    ]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}