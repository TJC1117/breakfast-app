// src/components/layout/Header.jsx
import React from 'react';
// 匯入 Link 元件
import { Link } from 'react-router-dom';
import UserMenu from './UserMenu'; // 匯入 UserMenu 
import useCart from '../../hooks/useCart'; // 1. 匯入 useCart

const Header = () => {
   const { cartCount } = useCart(); // 2. 一行程式碼取得購物車數量！
  return (
    <header className="navbar bg-base-100 shadow-lg">
      <div className="navbar-start">
        {/* 將 a 換成 Link */}
        <Link to="/" className="btn btn-ghost text-xl font-bold text-primary">
          🍳 早餐時光
        </Link>
      </div>
      <div className="navbar-center hidden md:flex">
        <ul className="menu menu-horizontal px-1">
          {/* 將 a 換成 Link */}
          <li><Link to="/">首頁</Link></li>
          <li><Link to="/menu">美味菜單</Link></li>
          <li><Link to="/about">關於我們</Link></li>
          <li><Link to="/orders">我的訂單</Link></li>
        </ul>
      </div>
      <div className="navbar-end">
        {/* 將 a 換成 Link */}
        <Link to="/cart" className="btn btn-ghost btn-circle">
          <div className="indicator">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            {/* 3. 使用真實的 cartCount */}
            {cartCount > 0 && (
              <span className="badge badge-sm indicator-item badge-primary">
                {cartCount}
              </span>
            )}
          </div>
        </Link>
        {/* 在這裡加入使用者選單 */}
        <UserMenu />
      </div>
    </header>
  );
};

export default Header;
